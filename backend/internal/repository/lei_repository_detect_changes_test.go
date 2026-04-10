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
	if _, ok := changes["last_update_date"]; !ok {
		t.Fatalf("expected last_update_date to be detected as changed")
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
	if _, ok := changes["legal_name"]; !ok {
		t.Fatalf("expected legal_name to be detected as changed")
	}
	if len(changes) != 1 {
		t.Fatalf("expected exactly 1 changed field, got %d: %v", len(changes), changes)
	}
}

// ---------------------------------------------------------------------------
// detectChanges – JSONBString semantic equality (OtherNames / ValidationSources)
// ---------------------------------------------------------------------------

// TestDetectChangesNoFalsePositiveForOtherNamesKeyOrdering is the regression
// test for the OtherNames bug: Go's json.Marshal serialises map[string]string
// with keys in alphabetical order (language < name < type), but the string
// already stored in PostgreSQL preserves the original insertion order.  The raw
// JSONBString values therefore differ even when the content is identical.
func TestDetectChangesNoFalsePositiveForOtherNamesKeyOrdering(t *testing.T) {
	t.Helper()

	// Simulate what PostgreSQL returns: original insertion key ordering.
	dbOrder := domain.JSONBString(`[{"name":"Capsugel Holdings S.A.","type":"PREVIOUS_LEGAL_NAME","language":"lb"},{"name":"Chester Holdings S.à r.l.","type":"PREVIOUS_LEGAL_NAME","language":"lb"}]`)

	// Simulate what json.Marshal produces for the same data: alphabetical key ordering.
	goOrder := domain.JSONBString(`[{"language":"lb","name":"Capsugel Holdings S.A.","type":"PREVIOUS_LEGAL_NAME"},{"language":"lb","name":"Chester Holdings S.à r.l.","type":"PREVIOUS_LEGAL_NAME"}]`)

	old := &domain.LEIRecord{OtherNames: dbOrder}
	rec := &domain.LEIRecord{OtherNames: goOrder}

	changes := leiRepo.detectChanges(old, rec)
	if _, ok := changes["OtherNames"]; ok {
		t.Fatalf("expected no change for OtherNames with different key ordering but identical content, got: %v", changes)
	}
}

// TestDetectChangesDetectsGenuineOtherNamesChange verifies that a real change
// to OtherNames is still reported correctly after the semantic comparison fix.
func TestDetectChangesDetectsGenuineOtherNamesChange(t *testing.T) {
	t.Helper()

	old := &domain.LEIRecord{OtherNames: domain.JSONBString(`[{"language":"lb","name":"Old Name Ltd","type":"PREVIOUS_LEGAL_NAME"}]`)}
	rec := &domain.LEIRecord{OtherNames: domain.JSONBString(`[{"language":"lb","name":"New Name Ltd","type":"PREVIOUS_LEGAL_NAME"}]`)}

	changes := leiRepo.detectChanges(old, rec)
	if _, ok := changes["other_names"]; !ok {
		t.Fatal("expected other_names to be detected as changed when name value differs")
	}
}

// TestDetectChangesOtherNamesEmptyArrayEqual verifies that two empty
// OtherNames arrays are considered equal.
func TestDetectChangesOtherNamesEmptyArrayEqual(t *testing.T) {
	t.Helper()

	old := &domain.LEIRecord{OtherNames: domain.JSONBString(`[]`)}
	rec := &domain.LEIRecord{OtherNames: domain.JSONBString(`[]`)}

	changes := leiRepo.detectChanges(old, rec)
	if _, ok := changes["OtherNames"]; ok {
		t.Fatalf("expected no change for two empty OtherNames arrays, got: %v", changes)
	}
}

// TestDetectChangesMixedGenuineAndFalsePositive verifies the scenario from the
// bug report: a record with genuine changes (EntityStatus, address) alongside
// false-positive fields (OtherNames with different key ordering, date fields
// with different *Location).  Only the genuine changes should be detected.
func TestDetectChangesMixedGenuineAndFalsePositive(t *testing.T) {
	t.Helper()

	utcFixed := time.FixedZone("UTC", 0)
	sameInstant := time.Date(2018, 7, 19, 15, 49, 0, 0, time.UTC)

	// OtherNames: same content but different key ordering.
	dbOtherNames := domain.JSONBString(`[{"name":"Capsugel Holdings S.A.","type":"PREVIOUS_LEGAL_NAME","language":"lb"}]`)
	goOtherNames := domain.JSONBString(`[{"language":"lb","name":"Capsugel Holdings S.A.","type":"PREVIOUS_LEGAL_NAME"}]`)

	old := &domain.LEIRecord{
		EntityStatus:    "ACTIVE",
		HQAddressLine1:  "63, rue de Rollingergrund",
		NextRenewalDate: time.Date(2018, 7, 19, 15, 49, 0, 0, utcFixed), // same instant, fixed zone
		OtherNames:      dbOtherNames,
	}
	rec := &domain.LEIRecord{
		EntityStatus:    "INACTIVE",
		HQAddressLine1:  "2, Rue Edward Steichen",
		NextRenewalDate: sameInstant,
		OtherNames:      goOtherNames,
	}

	changes := leiRepo.detectChanges(old, rec)

	if _, ok := changes["entity_status"]; !ok {
		t.Error("expected entity_status to be detected as changed")
	}
	if _, ok := changes["hq_address_line_1"]; !ok {
		t.Error("expected hq_address_line_1 to be detected as changed")
	}
	if _, ok := changes["next_renewal_date"]; ok {
		t.Error("expected next_renewal_date NOT to be detected as changed (same instant, different *Location)")
	}
	if _, ok := changes["other_names"]; ok {
		t.Error("expected other_names NOT to be detected as changed (same content, different key ordering)")
	}
	if len(changes) != 2 {
		t.Fatalf("expected exactly 2 changed fields (entity_status, hq_address_line_1), got %d: %v", len(changes), changes)
	}
}

// ---------------------------------------------------------------------------
// jsonBStringsSemanticEqual (package-level helper)
// ---------------------------------------------------------------------------

func TestJSONBStringsSemanticEqualIdentical(t *testing.T) {
	a := domain.JSONBString(`[{"language":"lb","name":"A","type":"T"}]`)
	if !jsonBStringsSemanticEqual(a, a) {
		t.Fatal("expected identical JSONBStrings to be equal")
	}
}

func TestJSONBStringsSemanticEqualDifferentKeyOrder(t *testing.T) {
	a := domain.JSONBString(`{"name":"A","type":"T","language":"lb"}`)
	b := domain.JSONBString(`{"language":"lb","name":"A","type":"T"}`)
	if !jsonBStringsSemanticEqual(a, b) {
		t.Fatal("expected objects with different key ordering but same content to be equal")
	}
}

func TestJSONBStringsSemanticEqualDifferentContent(t *testing.T) {
	a := domain.JSONBString(`{"name":"A"}`)
	b := domain.JSONBString(`{"name":"B"}`)
	if jsonBStringsSemanticEqual(a, b) {
		t.Fatal("expected objects with different content to be not equal")
	}
}

func TestJSONBStringsSemanticEqualInvalidJSON(t *testing.T) {
	a := domain.JSONBString(`not-json`)
	b := domain.JSONBString(`{"name":"A"}`)
	if jsonBStringsSemanticEqual(a, b) {
		t.Fatal("expected invalid JSON to compare as not equal")
	}
}
