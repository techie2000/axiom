package repository

import (
	"testing"
	"time"

	"github.com/techie2000/axiom/internal/domain"
)

// repo is a zero-value leiRepository. The db field is nil, but detectChanges is
// a pure helper that never touches the database connection.
var leiRepo = &leiRepository{}

// ---------------------------------------------------------------------------
// detectChanges – time.Time equality
// ---------------------------------------------------------------------------

// TestDetectChangesNoFalsePositiveForSameInstantDifferentLocation is the key
// regression test for the bug: time.Time values that represent the same UTC
// instant but have different *time.Location pointers (e.g. time.UTC vs a
// FixedZone with offset 0) must NOT produce a changed-field entry.
func TestDetectChangesNoFalsePositiveForSameInstantDifferentLocation(t *testing.T) {
	t.Helper()

	instant := time.Date(2025, 5, 5, 8, 12, 6, 747000000, time.UTC)

	// Simulate what the database returns: same instant but via a fixed-zone location.
	utcFixed := time.FixedZone("UTC", 0)
	instantDB := time.Date(2025, 5, 5, 8, 12, 6, 747000000, utcFixed)

	old := &domain.LEIRecord{LastUpdateDate: instantDB}
	rec := &domain.LEIRecord{LastUpdateDate: instant}

	changes := leiRepo.detectChanges(old, rec)
	if len(changes) != 0 {
		t.Fatalf("expected no changes for same-instant time values, got %d: %v", len(changes), changes)
	}
}

// TestDetectChangesNoFalsePositiveForAllThreeDateFields verifies that
// InitialRegistrationDate, LastUpdateDate and NextRenewalDate all benefit from
// the same-instant comparison – the scenario reported in the bug.
func TestDetectChangesNoFalsePositiveForAllThreeDateFields(t *testing.T) {
	t.Helper()

	utcFixed := time.FixedZone("UTC", 0)

	toFixed := func(t time.Time) time.Time {
		return time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second(), t.Nanosecond(), utcFixed)
	}

	lastUpdate := time.Date(2025, 5, 5, 8, 12, 6, 747000000, time.UTC)
	nextRenewal := time.Date(2026, 5, 29, 0, 17, 0, 0, time.UTC)
	initialReg := time.Date(2012, 6, 6, 15, 55, 0, 0, time.UTC)

	old := &domain.LEIRecord{
		LastUpdateDate:          toFixed(lastUpdate),
		NextRenewalDate:         toFixed(nextRenewal),
		InitialRegistrationDate: toFixed(initialReg),
	}
	rec := &domain.LEIRecord{
		LastUpdateDate:          lastUpdate,
		NextRenewalDate:         nextRenewal,
		InitialRegistrationDate: initialReg,
	}

	changes := leiRepo.detectChanges(old, rec)
	if len(changes) != 0 {
		t.Fatalf("expected no changes when date fields are the same instant, got %d: %v", len(changes), changes)
	}
}

// TestDetectChangesDetectsGenuineDateChange verifies that a real change to a
// time.Time field is still reported correctly.
func TestDetectChangesDetectsGenuineDateChange(t *testing.T) {
	t.Helper()

	old := &domain.LEIRecord{
		LastUpdateDate: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
	}
	rec := &domain.LEIRecord{
		LastUpdateDate: time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC),
	}

	changes := leiRepo.detectChanges(old, rec)
	if _, ok := changes["LastUpdateDate"]; !ok {
		t.Fatalf("expected LastUpdateDate to be detected as changed")
	}
	if len(changes) != 1 {
		t.Fatalf("expected exactly 1 changed field, got %d: %v", len(changes), changes)
	}
}

// TestDetectChangesZeroTimeNotFalsePositive verifies that two zero time.Time
// values are treated as equal (no change).
func TestDetectChangesZeroTimeNotFalsePositive(t *testing.T) {
	t.Helper()

	old := &domain.LEIRecord{LastUpdateDate: time.Time{}}
	rec := &domain.LEIRecord{LastUpdateDate: time.Time{}}

	changes := leiRepo.detectChanges(old, rec)
	if len(changes) != 0 {
		t.Fatalf("expected no changes for two zero time values, got %d: %v", len(changes), changes)
	}
}

// TestDetectChangesNoChangesReturnEmpty verifies that identical records produce
// no changes (sanity check covering all fields at once).
func TestDetectChangesNoChangesReturnEmpty(t *testing.T) {
	t.Helper()

	ts := time.Date(2025, 5, 5, 8, 12, 6, 747000000, time.UTC)
	rec := &domain.LEIRecord{
		LEI:                     "GUNTJCA81C7IHNBGI392",
		LegalName:               "GFI SECURITIES LIMITED",
		EntityStatus:            "ACTIVE",
		LastUpdateDate:          ts,
		NextRenewalDate:         time.Date(2026, 5, 29, 0, 17, 0, 0, time.UTC),
		InitialRegistrationDate: time.Date(2012, 6, 6, 15, 55, 0, 0, time.UTC),
	}

	changes := leiRepo.detectChanges(rec, rec)
	if len(changes) != 0 {
		t.Fatalf("expected no changes for identical records, got %d: %v", len(changes), changes)
	}
}

// TestDetectChangesDetectsStringFieldChange verifies that a genuine string field
// change is still correctly reported.
func TestDetectChangesDetectsStringFieldChange(t *testing.T) {
	t.Helper()

	old := &domain.LEIRecord{LegalName: "Old Name Ltd"}
	rec := &domain.LEIRecord{LegalName: "New Name Ltd"}

	changes := leiRepo.detectChanges(old, rec)
	if _, ok := changes["LegalName"]; !ok {
		t.Fatalf("expected LegalName to be detected as changed")
	}
	if len(changes) != 1 {
		t.Fatalf("expected exactly 1 changed field, got %d: %v", len(changes), changes)
	}
}
