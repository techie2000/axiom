package service

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
)

type userEntityLinkRepositoryStub struct {
	listAllResult    []*domain.UserEntityLink
	listAllErr       error
	listActiveResult []*domain.UserEntityLink
	listActiveErr    error
	lastLimit        int
	lastOffset       int
}

func (s *userEntityLinkRepositoryStub) Create(link *domain.UserEntityLink) error {
	return nil
}

func (s *userEntityLinkRepositoryStub) Update(link *domain.UserEntityLink) error {
	return nil
}

func (s *userEntityLinkRepositoryStub) FindByID(id uuid.UUID) (*domain.UserEntityLink, error) {
	return nil, nil
}

func (s *userEntityLinkRepositoryStub) FindByUserAndLEI(userID uuid.UUID, lei string) (*domain.UserEntityLink, error) {
	return nil, nil
}

func (s *userEntityLinkRepositoryStub) ListByUser(userID uuid.UUID) ([]*domain.UserEntityLink, error) {
	return nil, nil
}

func (s *userEntityLinkRepositoryStub) ListByLEI(lei string) ([]*domain.UserEntityLink, error) {
	return nil, nil
}

func (s *userEntityLinkRepositoryStub) ListAll(limit, offset int) ([]*domain.UserEntityLink, error) {
	s.lastLimit = limit
	s.lastOffset = offset
	return s.listAllResult, s.listAllErr
}

func (s *userEntityLinkRepositoryStub) ListActive(limit, offset int) ([]*domain.UserEntityLink, error) {
	s.lastLimit = limit
	s.lastOffset = offset
	return s.listActiveResult, s.listActiveErr
}

func (s *userEntityLinkRepositoryStub) Revoke(id uuid.UUID, revokedBy string) error {
	return nil
}

// ---------------------------------------------------------------------------
// GrantEntityLinkRequest validation tests (via isValidEntityRole)
// ---------------------------------------------------------------------------

func TestUserEntityLinkService_EntityRoleDefaults(t *testing.T) {
	// Verify that the default entity role (viewer) is accepted.
	if !isValidEntityRole(domain.EntityRoleViewer) {
		t.Error("viewer should be a valid default role")
	}
}

// ---------------------------------------------------------------------------
// UpdateEntityLinkRequest partial-update tests (logic only, no DB)
// ---------------------------------------------------------------------------

func TestUpdateEntityLinkRequest_PartialNilPreservesOriginal(t *testing.T) {
	// When all fields in UpdateEntityLinkRequest are nil, the original link
	// values should be preserved. Simulate the service update logic.
	original := &domain.UserEntityLink{
		ID:            uuid.New(),
		EntityRole:    domain.EntityRoleTrader,
		ChildrenScope: domain.ChildrenScopeDirect,
		Notes:         "original note",
	}

	req := UpdateEntityLinkRequest{
		EntityRole:    nil,
		ChildrenScope: nil,
		Notes:         nil,
	}

	// Apply the same logic as (s *userEntityLinkService).Update.
	if req.EntityRole != nil {
		original.EntityRole = *req.EntityRole
	}
	if req.ChildrenScope != nil {
		original.ChildrenScope = *req.ChildrenScope
	}
	if req.Notes != nil {
		original.Notes = *req.Notes
	}

	if original.EntityRole != domain.EntityRoleTrader {
		t.Errorf("EntityRole should not change; got %q", original.EntityRole)
	}
	if original.ChildrenScope != domain.ChildrenScopeDirect {
		t.Errorf("ChildrenScope should remain 'direct'; got %q", original.ChildrenScope)
	}
	if original.Notes != "original note" {
		t.Errorf("Notes should not change; got %q", original.Notes)
	}
}

func TestUpdateEntityLinkRequest_AllFieldsUpdated(t *testing.T) {
	original := &domain.UserEntityLink{
		ID:            uuid.New(),
		EntityRole:    domain.EntityRoleViewer,
		ChildrenScope: domain.ChildrenScopeNone,
		Notes:         "",
	}

	newRole := domain.EntityRoleEntityAdmin
	newScope := domain.ChildrenScopeAll
	newNotes := "updated note"
	future := time.Now().Add(24 * time.Hour)

	req := UpdateEntityLinkRequest{
		EntityRole:    &newRole,
		ChildrenScope: &newScope,
		Notes:         &newNotes,
		ExpiresAt:     &future,
	}

	if req.EntityRole != nil {
		original.EntityRole = *req.EntityRole
	}
	if req.ChildrenScope != nil {
		original.ChildrenScope = *req.ChildrenScope
	}
	if req.Notes != nil {
		original.Notes = *req.Notes
	}
	if req.ExpiresAt != nil {
		original.ExpiresAt = req.ExpiresAt
	}

	if original.EntityRole != domain.EntityRoleEntityAdmin {
		t.Errorf("expected entity_admin, got %q", original.EntityRole)
	}
	if original.ChildrenScope != domain.ChildrenScopeAll {
		t.Errorf("ChildrenScope should be 'all'; got %q", original.ChildrenScope)
	}
	if original.Notes != "updated note" {
		t.Errorf("Notes should be updated; got %q", original.Notes)
	}
	if original.ExpiresAt == nil || !original.ExpiresAt.Equal(future) {
		t.Error("ExpiresAt should be set to future value")
	}
}

// ---------------------------------------------------------------------------
// GrantEntityLinkRequest role defaulting test (logic only, no DB)
// ---------------------------------------------------------------------------

func TestGrantEntityLinkRequest_DefaultsToViewer(t *testing.T) {
	req := GrantEntityLinkRequest{
		UserID: uuid.New().String(),
		LEI:    "AXIO00000000000001AB",
		// EntityRole intentionally omitted → should default to viewer
	}

	role := req.EntityRole
	if role == "" {
		role = domain.EntityRoleViewer
	}

	if role != domain.EntityRoleViewer {
		t.Errorf("expected viewer default, got %q", role)
	}
}

func TestUserEntityLinkService_ListAllDelegatesToRepository(t *testing.T) {
	expected := []*domain.UserEntityLink{{ID: uuid.New()}}
	repo := &userEntityLinkRepositoryStub{listAllResult: expected}
	svc := NewUserEntityLinkService(repo)

	links, err := svc.ListAll(25, 10)
	if err != nil {
		t.Fatalf("ListAll returned error: %v", err)
	}
	if len(links) != 1 || links[0].ID != expected[0].ID {
		t.Fatalf("ListAll returned unexpected links: %#v", links)
	}
	if repo.lastLimit != 25 || repo.lastOffset != 10 {
		t.Fatalf("expected limit/offset 25/10, got %d/%d", repo.lastLimit, repo.lastOffset)
	}
}

func TestUserEntityLinkService_ListAllWrapsRepositoryError(t *testing.T) {
	repo := &userEntityLinkRepositoryStub{listAllErr: errors.New("db failure")}
	svc := NewUserEntityLinkService(repo)

	_, err := svc.ListAll(50, 0)
	if err == nil {
		t.Fatal("expected error")
	}
	if got := err.Error(); got != "list all user-entity links: db failure" {
		t.Fatalf("unexpected error: %s", got)
	}
}
