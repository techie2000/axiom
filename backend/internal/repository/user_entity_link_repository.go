package repository

import (
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
	"gorm.io/gorm"
)

// UserEntityLinkRepository handles persistence of user–entity identity links.
type UserEntityLinkRepository interface {
	// Create persists a new link. Returns an error if an active link for the same
	// (user_id, lei) pair already exists.
	Create(link *domain.UserEntityLink) error
	// Update saves changes to an existing link (e.g. role change, expiry update).
	Update(link *domain.UserEntityLink) error
	// FindByID returns a link by its surrogate key.
	FindByID(id uuid.UUID) (*domain.UserEntityLink, error)
	// FindByUserAndLEI returns the active link for a (user, lei) pair, or nil when absent.
	FindByUserAndLEI(userID uuid.UUID, lei string) (*domain.UserEntityLink, error)
	// ListByUser returns all links (active and revoked) for a user.
	ListByUser(userID uuid.UUID) ([]*domain.UserEntityLink, error)
	// ListByLEI returns all links (active and revoked) for a LEI entity.
	ListByLEI(lei string) ([]*domain.UserEntityLink, error)
	// ListAll returns all links, including revoked and expired, with pagination.
	ListAll(limit, offset int) ([]*domain.UserEntityLink, error)
	// ListActive returns all currently active links (not revoked, not expired).
	ListActive(limit, offset int) ([]*domain.UserEntityLink, error)
	// Revoke soft-deletes a link by setting revoked_at to now.
	Revoke(id uuid.UUID, revokedBy string) error
}

type userEntityLinkRepository struct {
	db *gorm.DB
}

// NewUserEntityLinkRepository creates a UserEntityLinkRepository backed by db.
func NewUserEntityLinkRepository(db *gorm.DB) UserEntityLinkRepository {
	return &userEntityLinkRepository{db: db}
}

func (r *userEntityLinkRepository) Create(link *domain.UserEntityLink) error {
	// Enforce uniqueness: reject if an active link already exists for this (user, lei) pair.
	existing, err := r.FindByUserAndLEI(link.UserID, link.LEI)
	if err != nil {
		return fmt.Errorf("check duplicate user-entity link: %w", err)
	}
	if existing != nil {
		return fmt.Errorf("active user-entity link already exists for user %s and LEI %s", link.UserID, link.LEI)
	}

	link.GrantedAt = time.Now().UTC()
	result := r.db.Create(link)
	return result.Error
}

func (r *userEntityLinkRepository) Update(link *domain.UserEntityLink) error {
	result := r.db.Save(link)
	return result.Error
}

func (r *userEntityLinkRepository) FindByID(id uuid.UUID) (*domain.UserEntityLink, error) {
	var link domain.UserEntityLink
	err := r.db.Where("id = ?", id).First(&link).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find user-entity link %s: %w", id, err)
	}
	return &link, nil
}

func (r *userEntityLinkRepository) FindByUserAndLEI(userID uuid.UUID, lei string) (*domain.UserEntityLink, error) {
	var link domain.UserEntityLink
	err := r.db.
		Where("user_id = ? AND lei = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())", userID, lei).
		First(&link).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find user-entity link for user %s / LEI %s: %w", userID, lei, err)
	}
	return &link, nil
}

func (r *userEntityLinkRepository) ListByUser(userID uuid.UUID) ([]*domain.UserEntityLink, error) {
	var links []*domain.UserEntityLink
	err := r.db.
		Where("user_id = ?", userID).
		Order("granted_at DESC").
		Find(&links).Error
	if err != nil {
		return nil, fmt.Errorf("list links for user %s: %w", userID, err)
	}
	return links, nil
}

func (r *userEntityLinkRepository) ListByLEI(lei string) ([]*domain.UserEntityLink, error) {
	var links []*domain.UserEntityLink
	err := r.db.
		Where("lei = ?", lei).
		Order("granted_at DESC").
		Find(&links).Error
	if err != nil {
		return nil, fmt.Errorf("list links for LEI %s: %w", lei, err)
	}
	return links, nil
}

func (r *userEntityLinkRepository) ListAll(limit, offset int) ([]*domain.UserEntityLink, error) {
	var links []*domain.UserEntityLink
	err := r.db.
		Order("granted_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&links).Error
	if err != nil {
		return nil, fmt.Errorf("list all user-entity links: %w", err)
	}
	return links, nil
}

func (r *userEntityLinkRepository) ListActive(limit, offset int) ([]*domain.UserEntityLink, error) {
	var links []*domain.UserEntityLink
	err := r.db.
		Where("revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())").
		Order("granted_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&links).Error
	if err != nil {
		return nil, fmt.Errorf("list active user-entity links: %w", err)
	}
	return links, nil
}

func (r *userEntityLinkRepository) Revoke(id uuid.UUID, revokedBy string) error {
	now := time.Now().UTC()
	result := r.db.Model(&domain.UserEntityLink{}).
		Where("id = ? AND revoked_at IS NULL", id).
		Updates(map[string]interface{}{
			"revoked_at": now,
			"notes":      gorm.Expr("COALESCE(notes, '') || ' [revoked by ' || ? || ' at ' || ? || ']'", revokedBy, now.Format(time.RFC3339)),
			"updated_at": now,
		})
	if result.Error != nil {
		return fmt.Errorf("revoke user-entity link %s: %w", id, result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("user-entity link %s not found or already revoked", id)
	}
	return nil
}

// Compile-time interface check.
var _ UserEntityLinkRepository = (*userEntityLinkRepository)(nil)
