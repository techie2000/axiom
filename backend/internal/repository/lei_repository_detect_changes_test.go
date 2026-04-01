package repository

import (
	"testing"
	"time"

	"github.com/techie2000/axiom/internal/domain"
)

// leiRepo is a zero-value leiRepository. The db field is nil, but detectChanges
// is a pure helper that never touches the database connection.
var leiRepo = &leiRepository{}

// TestDetectChangesUsesJSONTagKeys verifies that detectChanges keys its result
// map using the JSON tag name (snake_case) rather than the Go struct field name
// (PascalCase).  This ensures the frontend can correlate changed_fields entries
// with the record_snapshot, which is serialised using JSON tags.
func TestDetectChangesUsesJSONTagKeys(t *testing.T) {
	old := &domain.LEIRecord{LegalName: "Old Name", HQAddressLine1: "123 Main St"}
	nw := &domain.LEIRecord{LegalName: "New Name", HQAddressLine1: "456 Oak Ave"}

	changes := leiRepo.detectChanges(old, nw)

	// Keys must be the JSON tag names, not the struct field names.
	if _, ok := changes["LegalName"]; ok {
		t.Error("changed_fields must not use Go struct field name 'LegalName'; want 'legal_name'")
	}
	if _, ok := changes["HQAddressLine1"]; ok {
		t.Error("changed_fields must not use Go struct field name 'HQAddressLine1'; want 'hq_address_line_1'")
	}
	if _, ok := changes["legal_name"]; !ok {
		t.Error("expected key 'legal_name' in changes (JSON tag), not found")
	}
	if _, ok := changes["hq_address_line_1"]; !ok {
		t.Error("expected key 'hq_address_line_1' in changes (JSON tag), not found")
	}
}

// TestDetectChangesFieldNameMatchesKey verifies that the FieldName inside each
// LEIChangeDetection entry equals its map key (both use the JSON tag name).
func TestDetectChangesFieldNameMatchesKey(t *testing.T) {
	old := &domain.LEIRecord{LegalName: "Foo"}
	nw := &domain.LEIRecord{LegalName: "Bar"}

	changes := leiRepo.detectChanges(old, nw)
	entry, ok := changes["legal_name"]
	if !ok {
		t.Fatal("expected 'legal_name' key in changes")
	}
	if entry.FieldName != "legal_name" {
		t.Errorf("FieldName = %q, want %q", entry.FieldName, "legal_name")
	}
}

// TestDetectChangesReturnsEmptyWhenNothingChanged verifies the no-op path.
func TestDetectChangesReturnsEmptyWhenNothingChanged(t *testing.T) {
	rec := &domain.LEIRecord{LegalName: "Same", EntityStatus: "ACTIVE"}
	changes := leiRepo.detectChanges(rec, rec)
	if len(changes) != 0 {
		t.Fatalf("expected no changes, got %d: %v", len(changes), changes)
	}
}

// TestDetectChangesBothZeroTimesProducesNoChange mirrors the level-2 test for
// the zero-time special case.
func TestDetectChangesBothZeroTimesProducesNoChange(t *testing.T) {
	var zero time.Time
	old := &domain.LEIRecord{LastUpdateDate: zero}
	nw := &domain.LEIRecord{LastUpdateDate: zero}

	changes := leiRepo.detectChanges(old, nw)
	if _, ok := changes["last_update_date"]; ok {
		t.Error("two zero time.Time values should not be reported as a change")
	}
}
