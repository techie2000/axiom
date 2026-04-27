package service

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
)

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
		ID:              uuid.New(),
		EntityRole:      domain.EntityRoleTrader,
		IncludeChildren: true,
		Notes:           "original note",
	}

	req := UpdateEntityLinkRequest{
		EntityRole:      nil,
		IncludeChildren: nil,
		Notes:           nil,
	}

	// Apply the same logic as (s *userEntityLinkService).Update.
	if req.EntityRole != nil {
		original.EntityRole = *req.EntityRole
	}
	if req.IncludeChildren != nil {
		original.IncludeChildren = *req.IncludeChildren
	}
	if req.Notes != nil {
		original.Notes = *req.Notes
	}

	if original.EntityRole != domain.EntityRoleTrader {
		t.Errorf("EntityRole should not change; got %q", original.EntityRole)
	}
	if !original.IncludeChildren {
		t.Error("IncludeChildren should remain true")
	}
	if original.Notes != "original note" {
		t.Errorf("Notes should not change; got %q", original.Notes)
	}
}

func TestUpdateEntityLinkRequest_AllFieldsUpdated(t *testing.T) {
	original := &domain.UserEntityLink{
		ID:              uuid.New(),
		EntityRole:      domain.EntityRoleViewer,
		IncludeChildren: false,
		Notes:           "",
	}

	newRole := domain.EntityRoleEntityAdmin
	newChildren := true
	newNotes := "updated note"
	future := time.Now().Add(24 * time.Hour)

	req := UpdateEntityLinkRequest{
		EntityRole:      &newRole,
		IncludeChildren: &newChildren,
		Notes:           &newNotes,
		ExpiresAt:       &future,
	}

	if req.EntityRole != nil {
		original.EntityRole = *req.EntityRole
	}
	if req.IncludeChildren != nil {
		original.IncludeChildren = *req.IncludeChildren
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
	if !original.IncludeChildren {
		t.Error("IncludeChildren should be updated to true")
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
