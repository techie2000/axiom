package repository

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
)

// repo is a zero-value leiLevel2Repository. The db field is nil, but all of the
// methods under test (detectRRChanges, detectRepexChanges, rrToJSON, repexToJSON)
// are pure helpers that never touch the database connection.
var level2Repo = &leiLevel2Repository{}

// ---------------------------------------------------------------------------
// detectRRChanges
// ---------------------------------------------------------------------------

func TestDetectRRChangesReturnsEmptyWhenNothingChanged(t *testing.T) {
	t.Helper()

	rec := &domain.LEIRelationshipRecord{
		RelationshipStatus:  "ACTIVE",
		RegistrationStatus:  "PUBLISHED",
		ManagingLOU:         "ABCDEFGHIJ1234567890",
		ValidationSources:   "FULLY_CORROBORATED",
		ValidationDocuments: "REGULATORY_FILING",
		ValidationReference: "ref",
	}
	changes := level2Repo.detectRRChanges(rec, rec)
	if len(changes) != 0 {
		t.Fatalf("expected no changes, got %d: %v", len(changes), changes)
	}
}

func TestDetectRRChangesDetectsStringFieldChange(t *testing.T) {
	t.Helper()

	old := &domain.LEIRelationshipRecord{RelationshipStatus: "ACTIVE"}
	new := &domain.LEIRelationshipRecord{RelationshipStatus: "INACTIVE"}

	changes := level2Repo.detectRRChanges(old, new)
	if _, ok := changes["RelationshipStatus"]; !ok {
		t.Fatalf("expected RelationshipStatus to be detected as changed")
	}
	if len(changes) != 1 {
		t.Fatalf("expected exactly 1 changed field, got %d", len(changes))
	}
}

func TestDetectRRChangesDetectsJSONBFieldChange(t *testing.T) {
	t.Helper()

	old := &domain.LEIRelationshipRecord{
		RelationshipPeriods: domain.JSONBString(`[{"startDate":"2020-01-01"}]`),
	}
	new := &domain.LEIRelationshipRecord{
		RelationshipPeriods: domain.JSONBString(`[{"startDate":"2021-01-01"}]`),
	}

	changes := level2Repo.detectRRChanges(old, new)
	if _, ok := changes["RelationshipPeriods"]; !ok {
		t.Fatalf("expected RelationshipPeriods to be detected as changed")
	}
}

func TestDetectRRChangesAllThreeJSONBFieldsChecked(t *testing.T) {
	t.Helper()

	old := &domain.LEIRelationshipRecord{
		RelationshipPeriods:     domain.JSONBString(`[]`),
		RelationshipQualifiers:  domain.JSONBString(`[]`),
		RelationshipQuantifiers: domain.JSONBString(`[]`),
	}
	new := &domain.LEIRelationshipRecord{
		RelationshipPeriods:     domain.JSONBString(`[{"startDate":"2020-01-01"}]`),
		RelationshipQualifiers:  domain.JSONBString(`[{"qualifier":"A"}]`),
		RelationshipQuantifiers: domain.JSONBString(`[{"amount":"100"}]`),
	}

	changes := level2Repo.detectRRChanges(old, new)
	for _, field := range []string{"RelationshipPeriods", "RelationshipQualifiers", "RelationshipQuantifiers"} {
		if _, ok := changes[field]; !ok {
			t.Fatalf("expected %s to be detected as changed", field)
		}
	}
}

func TestDetectRRChangesDetectsTimeFieldChange(t *testing.T) {
	t.Helper()

	t1 := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)
	t2 := time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC)

	old := &domain.LEIRelationshipRecord{LastUpdateDate: &t1}
	new := &domain.LEIRelationshipRecord{LastUpdateDate: &t2}

	changes := level2Repo.detectRRChanges(old, new)
	if _, ok := changes["LastUpdateDate"]; !ok {
		t.Fatalf("expected LastUpdateDate to be detected as changed")
	}
}

func TestDetectRRChangesNilVsNonNilTimeIsDetected(t *testing.T) {
	t.Helper()

	t1 := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)

	old := &domain.LEIRelationshipRecord{LastUpdateDate: nil}
	new := &domain.LEIRelationshipRecord{LastUpdateDate: &t1}

	changes := level2Repo.detectRRChanges(old, new)
	if _, ok := changes["LastUpdateDate"]; !ok {
		t.Fatalf("expected nil→value LastUpdateDate to be detected as changed")
	}
}

func TestDetectRRChangesBothNilTimesProducesNoChange(t *testing.T) {
	t.Helper()

	old := &domain.LEIRelationshipRecord{LastUpdateDate: nil}
	new := &domain.LEIRelationshipRecord{LastUpdateDate: nil}

	changes := level2Repo.detectRRChanges(old, new)
	if _, ok := changes["LastUpdateDate"]; ok {
		t.Fatalf("nil==nil should not produce a LastUpdateDate change entry")
	}
}

func TestDetectRRChangesDetectsSourceFileIDChange(t *testing.T) {
	t.Helper()

	id1 := uuid.New()
	id2 := uuid.New()

	old := &domain.LEIRelationshipRecord{SourceFileID: &id1}
	new := &domain.LEIRelationshipRecord{SourceFileID: &id2}

	changes := level2Repo.detectRRChanges(old, new)
	if _, ok := changes["SourceFileID"]; !ok {
		t.Fatalf("expected SourceFileID to be detected as changed")
	}
}

func TestDetectRRChangesMultipleFieldsChanged(t *testing.T) {
	t.Helper()

	old := &domain.LEIRelationshipRecord{
		RelationshipStatus: "ACTIVE",
		ManagingLOU:        "OLD_LOU",
		ValidationSources:  "FULLY_CORROBORATED",
	}
	new := &domain.LEIRelationshipRecord{
		RelationshipStatus: "INACTIVE",
		ManagingLOU:        "NEW_LOU",
		ValidationSources:  "PARTIALLY_CORROBORATED",
	}

	changes := level2Repo.detectRRChanges(old, new)
	for _, field := range []string{"RelationshipStatus", "ManagingLOU", "ValidationSources"} {
		if _, ok := changes[field]; !ok {
			t.Fatalf("expected %s to be detected as changed", field)
		}
	}
	if len(changes) != 3 {
		t.Fatalf("expected exactly 3 changed fields, got %d: %v", len(changes), changes)
	}
}

// ---------------------------------------------------------------------------
// detectRepexChanges
// ---------------------------------------------------------------------------

func TestDetectRepexChangesReturnsEmptyWhenNothingChanged(t *testing.T) {
	t.Helper()

	exc := &domain.LEIReportingException{
		ExceptionReason:    "NO_KNOWN_PERSON",
		ExceptionReference: "ref",
	}
	changes := level2Repo.detectRepexChanges(exc, exc)
	if len(changes) != 0 {
		t.Fatalf("expected no changes, got %d: %v", len(changes), changes)
	}
}

func TestDetectRepexChangesDetectsExceptionReasonChange(t *testing.T) {
	t.Helper()

	old := &domain.LEIReportingException{ExceptionReason: "NO_KNOWN_PERSON"}
	new := &domain.LEIReportingException{ExceptionReason: "NATURAL_PERSONS"}

	changes := level2Repo.detectRepexChanges(old, new)
	if _, ok := changes["ExceptionReason"]; !ok {
		t.Fatalf("expected ExceptionReason to be detected as changed")
	}
	if len(changes) != 1 {
		t.Fatalf("expected exactly 1 changed field, got %d", len(changes))
	}
}

func TestDetectRepexChangesDetectsExceptionReferenceChange(t *testing.T) {
	t.Helper()

	old := &domain.LEIReportingException{ExceptionReference: "old-ref"}
	new := &domain.LEIReportingException{ExceptionReference: "new-ref"}

	changes := level2Repo.detectRepexChanges(old, new)
	if _, ok := changes["ExceptionReference"]; !ok {
		t.Fatalf("expected ExceptionReference to be detected as changed")
	}
}

func TestDetectRepexChangesDetectsSourceFileIDChange(t *testing.T) {
	t.Helper()

	id1 := uuid.New()
	id2 := uuid.New()

	old := &domain.LEIReportingException{SourceFileID: &id1}
	new := &domain.LEIReportingException{SourceFileID: &id2}

	changes := level2Repo.detectRepexChanges(old, new)
	if _, ok := changes["SourceFileID"]; !ok {
		t.Fatalf("expected SourceFileID to be detected as changed")
	}
}

func TestDetectRepexChangesNilToNonNilSourceFileIDIsDetected(t *testing.T) {
	t.Helper()

	id := uuid.New()
	old := &domain.LEIReportingException{SourceFileID: nil}
	new := &domain.LEIReportingException{SourceFileID: &id}

	changes := level2Repo.detectRepexChanges(old, new)
	if _, ok := changes["SourceFileID"]; !ok {
		t.Fatalf("expected nil→non-nil SourceFileID to be detected as changed")
	}
}

func TestDetectRepexChangesBothNilSourceFileIDProducesNoChange(t *testing.T) {
	t.Helper()

	old := &domain.LEIReportingException{SourceFileID: nil}
	new := &domain.LEIReportingException{SourceFileID: nil}

	changes := level2Repo.detectRepexChanges(old, new)
	if _, ok := changes["SourceFileID"]; ok {
		t.Fatalf("nil==nil SourceFileID should not produce a change entry")
	}
}

func TestDetectRepexChangesAllFieldsChecked(t *testing.T) {
	t.Helper()

	id1 := uuid.New()
	id2 := uuid.New()

	old := &domain.LEIReportingException{
		ExceptionReason:    "NO_KNOWN_PERSON",
		ExceptionReference: "ref1",
		SourceFileID:       &id1,
	}
	new := &domain.LEIReportingException{
		ExceptionReason:    "NATURAL_PERSONS",
		ExceptionReference: "ref2",
		SourceFileID:       &id2,
	}

	changes := level2Repo.detectRepexChanges(old, new)
	for _, field := range []string{"ExceptionReason", "ExceptionReference", "SourceFileID"} {
		if _, ok := changes[field]; !ok {
			t.Fatalf("expected %s to be detected as changed", field)
		}
	}
	if len(changes) != 3 {
		t.Fatalf("expected exactly 3 changed fields, got %d: %v", len(changes), changes)
	}
}

// ---------------------------------------------------------------------------
// rrToJSON / repexToJSON
// ---------------------------------------------------------------------------

func TestRRToJSONProducesValidJSON(t *testing.T) {
	t.Helper()

	rec := &domain.LEIRelationshipRecord{
		StartNodeLEI:       "AAAAAAAAAAAAAAAAAA01",
		EndNodeLEI:         "BBBBBBBBBBBBBBBBBB01",
		RelationshipType:   "IS_ULTIMATELY_CONSOLIDATED_BY",
		RelationshipStatus: "ACTIVE",
	}

	snapshot := level2Repo.rrToJSON(rec)
	if string(snapshot) == "{}" {
		t.Fatalf("rrToJSON returned fallback empty object for a valid record")
	}
	if len(snapshot) == 0 {
		t.Fatalf("rrToJSON returned empty snapshot")
	}
}

func TestRepexToJSONProducesValidJSON(t *testing.T) {
	t.Helper()

	exc := &domain.LEIReportingException{
		LEI:               "AAAAAAAAAAAAAAAAAA01",
		ExceptionCategory: "ULTIMATE_ACCOUNTING_CONSOLIDATION_PARENT",
		ExceptionReason:   "NO_KNOWN_PERSON",
	}

	snapshot := level2Repo.repexToJSON(exc)
	if string(snapshot) == "{}" {
		t.Fatalf("repexToJSON returned fallback empty object for a valid record")
	}
	if len(snapshot) == 0 {
		t.Fatalf("repexToJSON returned empty snapshot")
	}
}
