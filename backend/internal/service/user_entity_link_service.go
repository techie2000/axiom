package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/repository"
)

// UserEntityLinkService manages user–entity identity links.
// See ADR-0018 for the design rationale.
type UserEntityLinkService interface {
	// Grant creates a new link between a user and a LEI entity.
	Grant(req GrantEntityLinkRequest, adminUserID string) (*domain.UserEntityLink, error)
	// Revoke soft-deletes an active link.
	Revoke(linkID string, adminUserID string) error
	// Unrevoke restores a previously revoked link.
	Unrevoke(linkID string, adminUserID string) error
	// Update changes the mutable attributes of an existing link (role, children scope, expiry, notes).
	Update(linkID string, req UpdateEntityLinkRequest, adminUserID string) (*domain.UserEntityLink, error)
	// GetByID returns a single link by its surrogate key.
	GetByID(linkID string) (*domain.UserEntityLink, error)
	// ListByUser returns all links for a given user.
	ListByUser(userID string) ([]*domain.UserEntityLink, error)
	// ListByLEI returns all links for a given LEI entity.
	ListByLEI(lei string) ([]*domain.UserEntityLink, error)
	// ListAll returns all links, including revoked and expired, with pagination.
	ListAll(limit, offset int) ([]*domain.UserEntityLink, error)
	// ListActive returns all currently effective links with pagination.
	ListActive(limit, offset int) ([]*domain.UserEntityLink, error)
}

// GrantEntityLinkRequest holds the fields required to grant a user–entity link.
type GrantEntityLinkRequest struct {
	UserID        string               `json:"user_id" binding:"required"`
	LEI           string               `json:"lei" binding:"required"`
	EntityRole    domain.EntityRole    `json:"entity_role"`
	ChildrenScope domain.ChildrenScope `json:"children_scope"`
	ExpiresAt     *time.Time           `json:"expires_at,omitempty"`
	Notes         string               `json:"notes,omitempty"`
}

// UpdateEntityLinkRequest holds the fields that may be changed after creation.
type UpdateEntityLinkRequest struct {
	EntityRole    *domain.EntityRole    `json:"entity_role,omitempty"`
	ChildrenScope *domain.ChildrenScope `json:"children_scope,omitempty"`
	ExpiresAt     *time.Time            `json:"expires_at,omitempty"`
	Notes         *string               `json:"notes,omitempty"`
}

type userEntityLinkService struct {
	repo repository.UserEntityLinkRepository
}

// NewUserEntityLinkService creates a UserEntityLinkService.
func NewUserEntityLinkService(repo repository.UserEntityLinkRepository) UserEntityLinkService {
	return &userEntityLinkService{repo: repo}
}

func (s *userEntityLinkService) Grant(req GrantEntityLinkRequest, adminUserID string) (*domain.UserEntityLink, error) {
	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id %q: %w", req.UserID, err)
	}
	adminID, err := uuid.Parse(adminUserID)
	if err != nil {
		return nil, fmt.Errorf("invalid admin user_id %q: %w", adminUserID, err)
	}

	role := req.EntityRole
	if role == "" {
		role = domain.EntityRoleViewer
	}
	if !isValidEntityRole(role) {
		return nil, fmt.Errorf("invalid entity_role %q: must be one of viewer, trader, entity_admin", role)
	}

	scope := req.ChildrenScope
	if scope == "" {
		scope = domain.ChildrenScopeNone
	}

	link := &domain.UserEntityLink{
		UserID:        userID,
		LEI:           req.LEI,
		EntityRole:    role,
		ChildrenScope: scope,
		GrantedBy:     adminID,
		ExpiresAt:     req.ExpiresAt,
		Notes:         req.Notes,
	}

	if err := s.repo.Create(link); err != nil {
		return nil, fmt.Errorf("grant user-entity link: %w", err)
	}

	// Log audit: CREATE action
	snapshot, _ := json.Marshal(link)
	audit := &domain.UserEntityLinkAudit{
		UserEntityLinkID: link.ID,
		Action:           "CREATE",
		RecordSnapshot:   string(snapshot),
		ChangedBy:        adminUserID,
	}
	if err := s.repo.CreateAudit(audit); err != nil {
		log.Warn().Err(err).Str("link_id", link.ID.String()).Msg("failed to create audit record for granted user-entity link")
	}

	log.Info().
		Str("user_id", req.UserID).
		Str("lei", req.LEI).
		Str("entity_role", string(role)).
		Str("granted_by", adminUserID).
		Msg("user-entity link granted")

	return link, nil
}

func (s *userEntityLinkService) Revoke(linkID string, adminUserID string) error {
	id, err := uuid.Parse(linkID)
	if err != nil {
		return fmt.Errorf("invalid link ID %q: %w", linkID, err)
	}

	// Fetch the link before revoking to capture the snapshot
	link, err := s.repo.FindByID(id)
	if err != nil {
		return fmt.Errorf("fetch user-entity link %s: %w", linkID, err)
	}
	if link == nil {
		return fmt.Errorf("user-entity link %s not found", linkID)
	}

	if err := s.repo.Revoke(id, adminUserID); err != nil {
		return fmt.Errorf("revoke user-entity link %s: %w", linkID, err)
	}

	// Log audit: DELETE action (soft-delete via revoke)
	snapshot, _ := json.Marshal(link)
	audit := &domain.UserEntityLinkAudit{
		UserEntityLinkID: id,
		Action:           "DELETE",
		RecordSnapshot:   string(snapshot),
		ChangedBy:        adminUserID,
	}
	if err := s.repo.CreateAudit(audit); err != nil {
		log.Warn().Err(err).Str("link_id", linkID).Msg("failed to create audit record for revoked user-entity link")
	}

	log.Info().Str("link_id", linkID).Str("revoked_by", adminUserID).Msg("user-entity link revoked")
	return nil
}

func (s *userEntityLinkService) Unrevoke(linkID string, adminUserID string) error {
	id, err := uuid.Parse(linkID)
	if err != nil {
		return fmt.Errorf("invalid link ID %q: %w", linkID, err)
	}

	// Fetch the link before unrevoking to capture before state
	linkBefore, err := s.repo.FindByID(id)
	if err != nil {
		return fmt.Errorf("fetch user-entity link %s: %w", linkID, err)
	}
	if linkBefore == nil {
		return fmt.Errorf("user-entity link %s not found", linkID)
	}

	if err := s.repo.Unrevoke(id, adminUserID); err != nil {
		return fmt.Errorf("unrevoke user-entity link %s: %w", linkID, err)
	}

	// Fetch the link after unrevoking to capture after state
	linkAfter, err := s.repo.FindByID(id)
	if err != nil {
		log.Warn().Err(err).Str("link_id", linkID).Msg("failed to fetch user-entity link after unrevoke for audit")
	}

	// Log audit: UPDATE action (marking as unrevoked)
	if linkAfter != nil {
		snapshot, _ := json.Marshal(linkAfter)
		changedFields := map[string]interface{}{
			"revoked_at": map[string]interface{}{
				"before": linkBefore.RevokedAt,
				"after":  linkAfter.RevokedAt,
			},
		}
		changedFieldsJSON, _ := json.Marshal(changedFields)
		audit := &domain.UserEntityLinkAudit{
			UserEntityLinkID: id,
			Action:           "UPDATE",
			RecordSnapshot:   string(snapshot),
			ChangedFields:    string(changedFieldsJSON),
			ChangedBy:        adminUserID,
		}
		if err := s.repo.CreateAudit(audit); err != nil {
			log.Warn().Err(err).Str("link_id", linkID).Msg("failed to create audit record for unrevoked user-entity link")
		}
	}

	log.Info().Str("link_id", linkID).Str("unrevoked_by", adminUserID).Msg("user-entity link unrevoked")
	return nil
}

func (s *userEntityLinkService) Update(linkID string, req UpdateEntityLinkRequest, adminUserID string) (*domain.UserEntityLink, error) {
	id, err := uuid.Parse(linkID)
	if err != nil {
		return nil, fmt.Errorf("invalid link ID %q: %w", linkID, err)
	}

	link, err := s.repo.FindByID(id)
	if err != nil {
		return nil, fmt.Errorf("fetch user-entity link %s: %w", linkID, err)
	}
	if link == nil {
		return nil, errors.New("user-entity link not found")
	}

	// Capture before state for audit
	linkBefore := *link

	if req.EntityRole != nil {
		if !isValidEntityRole(*req.EntityRole) {
			return nil, fmt.Errorf("invalid entity_role %q", *req.EntityRole)
		}
		link.EntityRole = *req.EntityRole
	}
	if req.ChildrenScope != nil {
		link.ChildrenScope = *req.ChildrenScope
	}
	if req.ExpiresAt != nil {
		link.ExpiresAt = req.ExpiresAt
	}
	if req.Notes != nil {
		link.Notes = *req.Notes
	}
	link.UpdatedAt = time.Now().UTC()

	if err := s.repo.Update(link); err != nil {
		return nil, fmt.Errorf("update user-entity link %s: %w", linkID, err)
	}

	// Log audit: UPDATE action with changed fields
	snapshot, _ := json.Marshal(link)
	changedFields := make(map[string]interface{})
	if req.EntityRole != nil && linkBefore.EntityRole != link.EntityRole {
		changedFields["entity_role"] = map[string]interface{}{
			"before": linkBefore.EntityRole,
			"after":  link.EntityRole,
		}
	}
	if req.ChildrenScope != nil && linkBefore.ChildrenScope != link.ChildrenScope {
		changedFields["children_scope"] = map[string]interface{}{
			"before": linkBefore.ChildrenScope,
			"after":  link.ChildrenScope,
		}
	}
	if req.ExpiresAt != nil {
		changedFields["expires_at"] = map[string]interface{}{
			"before": linkBefore.ExpiresAt,
			"after":  link.ExpiresAt,
		}
	}
	if req.Notes != nil && linkBefore.Notes != link.Notes {
		changedFields["notes"] = map[string]interface{}{
			"before": linkBefore.Notes,
			"after":  link.Notes,
		}
	}

	changedFieldsJSON, _ := json.Marshal(changedFields)
	audit := &domain.UserEntityLinkAudit{
		UserEntityLinkID: id,
		Action:           "UPDATE",
		RecordSnapshot:   string(snapshot),
		ChangedFields:    string(changedFieldsJSON),
		ChangedBy:        adminUserID,
	}
	if err := s.repo.CreateAudit(audit); err != nil {
		log.Warn().Err(err).Str("link_id", linkID).Msg("failed to create audit record for updated user-entity link")
	}

	log.Info().Str("link_id", linkID).Str("updated_by", adminUserID).Msg("user-entity link updated")
	return link, nil
}

func (s *userEntityLinkService) GetByID(linkID string) (*domain.UserEntityLink, error) {
	id, err := uuid.Parse(linkID)
	if err != nil {
		return nil, fmt.Errorf("invalid link ID %q: %w", linkID, err)
	}
	link, err := s.repo.FindByID(id)
	if err != nil {
		return nil, fmt.Errorf("get user-entity link %s: %w", linkID, err)
	}
	return link, nil
}

func (s *userEntityLinkService) ListByUser(userID string) ([]*domain.UserEntityLink, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID %q: %w", userID, err)
	}
	links, err := s.repo.ListByUser(id)
	if err != nil {
		return nil, fmt.Errorf("list links for user %s: %w", userID, err)
	}
	return links, nil
}

func (s *userEntityLinkService) ListByLEI(lei string) ([]*domain.UserEntityLink, error) {
	links, err := s.repo.ListByLEI(lei)
	if err != nil {
		return nil, fmt.Errorf("list links for LEI %s: %w", lei, err)
	}
	return links, nil
}

func (s *userEntityLinkService) ListAll(limit, offset int) ([]*domain.UserEntityLink, error) {
	links, err := s.repo.ListAll(limit, offset)
	if err != nil {
		return nil, fmt.Errorf("list all user-entity links: %w", err)
	}
	return links, nil
}

func (s *userEntityLinkService) ListActive(limit, offset int) ([]*domain.UserEntityLink, error) {
	links, err := s.repo.ListActive(limit, offset)
	if err != nil {
		return nil, fmt.Errorf("list active user-entity links: %w", err)
	}
	return links, nil
}

func isValidEntityRole(role domain.EntityRole) bool {
	switch role {
	case domain.EntityRoleViewer, domain.EntityRoleTrader, domain.EntityRoleEntityAdmin:
		return true
	}
	return false
}
