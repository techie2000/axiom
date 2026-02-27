package service

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/repository"
)

func TestShouldSkipDuplicateHash(t *testing.T) {
	tests := []struct {
		name     string
		existing *domain.SourceFile
		expected bool
	}{
		{
			name:     "nil source file does not skip",
			existing: nil,
			expected: false,
		},
		{
			name: "non-completed status does not skip",
			existing: &domain.SourceFile{
				ProcessingStatus: "FAILED",
				ProcessedRecords: 100,
				FailedRecords:    0,
			},
			expected: false,
		},
		{
			name: "completed with failed records does not skip",
			existing: &domain.SourceFile{
				ProcessingStatus: "COMPLETED",
				ProcessedRecords: 0,
				FailedRecords:    1,
			},
			expected: false,
		},
		{
			name: "completed with zero processed does not skip",
			existing: &domain.SourceFile{
				ProcessingStatus: "COMPLETED",
				ProcessedRecords: 0,
				FailedRecords:    0,
			},
			expected: false,
		},
		{
			name: "completed with processed and no failures skips",
			existing: &domain.SourceFile{
				ProcessingStatus: "COMPLETED",
				TotalRecords:     10,
				ProcessedRecords: 10,
				FailedRecords:    0,
			},
			expected: true,
		},
		{
			name: "completed but incomplete total records does not skip",
			existing: &domain.SourceFile{
				ProcessingStatus: "COMPLETED",
				TotalRecords:     100,
				ProcessedRecords: 1,
				FailedRecords:    0,
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := shouldSkipDuplicateHash(tt.existing)
			if actual != tt.expected {
				t.Fatalf("expected %v, got %v", tt.expected, actual)
			}
		})
	}
}

func TestMapRawRRToRelationshipRecord_WrappedSchema(t *testing.T) {
	rawJSON := `{
		"RelationshipRecord": {
			"Relationship": {
				"StartNode": {"NodeID": {"$": "001GPB6A9XPE8XJICC14"}},
				"EndNode": {"NodeID": {"$": "5493001Z012YSB2A0K51"}},
				"RelationshipType": {"$": "IS_FUND-MANAGED_BY"},
				"RelationshipStatus": {"$": "ACTIVE"},
				"RelationshipPeriods": {"RelationshipPeriod": {"StartDate": {"$": "2012-11-29T00:00:00.000Z"}}}
			},
			"Registration": {
				"InitialRegistrationDate": {"$": "2022-11-14T09:59:48.000Z"},
				"LastUpdateDate": {"$": "2025-04-19T13:30:05.472Z"},
				"RegistrationStatus": {"$": "LAPSED"},
				"ManagingLOU": {"$": "5493001KJTIIGC8Y1R12"}
			}
		}
	}`

	var raw rawRRRecord
	if err := json.Unmarshal([]byte(rawJSON), &raw); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	record, err := mapRawRRToRelationshipRecord(&raw, uuid.New())
	if err != nil {
		t.Fatalf("mapping failed: %v", err)
	}

	if record.StartNodeLEI != "001GPB6A9XPE8XJICC14" || record.EndNodeLEI != "5493001Z012YSB2A0K51" {
		t.Fatalf("unexpected mapped LEIs: start=%s end=%s", record.StartNodeLEI, record.EndNodeLEI)
	}

	if record.RelationshipType != "IS_FUND-MANAGED_BY" || record.RelationshipStatus != "ACTIVE" {
		t.Fatalf("unexpected relationship fields: type=%s status=%s", record.RelationshipType, record.RelationshipStatus)
	}

	if record.RegistrationStatus != "LAPSED" {
		t.Fatalf("unexpected registration status: %s", record.RegistrationStatus)
	}
}

func TestGleifStringList_UnmarshalAndJoin(t *testing.T) {
	var reasons gleifStringList
	if err := json.Unmarshal([]byte(`[{"$":"NON_CONSOLIDATING"},{"$":"NO_KNOWN_PERSON"}]`), &reasons); err != nil {
		t.Fatalf("array unmarshal failed: %v", err)
	}
	if got := joinGLEIFReasons(reasons); got != "NON_CONSOLIDATING,NO_KNOWN_PERSON" {
		t.Fatalf("unexpected joined reasons: %s", got)
	}

	if err := json.Unmarshal([]byte(`{"$":"NON_CONSOLIDATING"}`), &reasons); err != nil {
		t.Fatalf("single unmarshal failed: %v", err)
	}
	if got := joinGLEIFReasons(reasons); got != "NON_CONSOLIDATING" {
		t.Fatalf("unexpected single reason: %s", got)
	}
}

func TestGleifString_UnmarshalArrayWrapped(t *testing.T) {
	var value gleifString
	if err := json.Unmarshal([]byte(`[{"$":"Datenschutz"}]`), &value); err != nil {
		t.Fatalf("array wrapped unmarshal failed: %v", err)
	}
	if got := value.String(); got != "Datenschutz" {
		t.Fatalf("unexpected array wrapped value: %s", got)
	}

	if err := json.Unmarshal([]byte(`[{"$":"One"}, {"$":"Two"}]`), &value); err != nil {
		t.Fatalf("multi array wrapped unmarshal failed: %v", err)
	}
	if got := value.String(); got != "One,Two" {
		t.Fatalf("unexpected multi array wrapped value: %s", got)
	}
}

func TestRawREPEXRecord_UnmarshalArrayWrappedReference(t *testing.T) {
	rawJSON := `{
		"LEI": {"$": "5493001KJTIIGC8Y1R12"},
		"ExceptionCategory": {"$": "NON_PUBLIC"},
		"ExceptionReason": [{"$": "NON_CONSOLIDATING"}],
		"ExceptionReference": [{"$": "Datenschutz"}]
	}`

	var raw rawREPEXRecord
	if err := json.Unmarshal([]byte(rawJSON), &raw); err != nil {
		t.Fatalf("raw REPEX unmarshal failed: %v", err)
	}

	if raw.LEI.String() != "5493001KJTIIGC8Y1R12" {
		t.Fatalf("unexpected LEI: %s", raw.LEI.String())
	}
	if raw.ExceptionCategory.String() != "NON_PUBLIC" {
		t.Fatalf("unexpected category: %s", raw.ExceptionCategory.String())
	}
	if got := joinGLEIFReasons(raw.ExceptionReason); got != "NON_CONSOLIDATING" {
		t.Fatalf("unexpected reason: %s", got)
	}
	if raw.ExceptionReference.String() != "Datenschutz" {
		t.Fatalf("unexpected reference: %s", raw.ExceptionReference.String())
	}
}

// ---------------------------------------------------------------------------
// batchResolveOpenProcessingFailures (leiLevel2Service) – stub-based tests
// ---------------------------------------------------------------------------

// level2RepoStub embeds the full LEILevel2Repository interface so that only the
// methods under test need to be overridden.
type level2RepoStub struct {
	repository.LEILevel2Repository
	calledJobType  string
	calledKeys     []string
	calledSourceID *uuid.UUID
	calledNote     string
	returnErr      error
	callCount      int
}

func (s *level2RepoStub) BatchResolveOpenProcessingFailures(
	jobType string,
	naturalKeys []string,
	resolvedSourceFileID *uuid.UUID,
	resolvedNote string,
) error {
	s.callCount++
	s.calledJobType = jobType
	s.calledKeys = naturalKeys
	s.calledSourceID = resolvedSourceFileID
	s.calledNote = resolvedNote
	return s.returnErr
}

func newLevel2ServiceWithStub(stub *level2RepoStub) *leiLevel2Service {
	return &leiLevel2Service{repo: stub}
}

func TestBatchResolveLevel2Service_EmptyKeys(t *testing.T) {
	stub := &level2RepoStub{}
	svc := newLevel2ServiceWithStub(stub)
	sourceID := uuid.New()

	svc.batchResolveOpenProcessingFailures("LEVEL2_RR", []string{}, &sourceID)

	if stub.callCount != 0 {
		t.Fatalf("expected repo not to be called for empty key slice, got %d calls", stub.callCount)
	}
}

func TestBatchResolveLevel2Service_ValidKeys(t *testing.T) {
	stub := &level2RepoStub{}
	svc := newLevel2ServiceWithStub(stub)
	sourceID := uuid.New()

	keys := []string{"START1|END1|IS_ULTIMATELY_CONSOLIDATED_BY", "START2|END2|IS_FUND-MANAGED_BY"}
	svc.batchResolveOpenProcessingFailures("LEVEL2_RR", keys, &sourceID)

	if stub.callCount != 1 {
		t.Fatalf("expected exactly 1 repo call, got %d", stub.callCount)
	}
	if stub.calledJobType != "LEVEL2_RR" {
		t.Errorf("expected calledJobType LEVEL2_RR, got %q", stub.calledJobType)
	}
	if len(stub.calledKeys) != len(keys) {
		t.Errorf("expected %d keys forwarded, got %d", len(keys), len(stub.calledKeys))
	}
	if stub.calledSourceID != &sourceID {
		t.Errorf("sourceFileID not forwarded correctly")
	}
}

func TestBatchResolveLevel2Service_CorrectJobType(t *testing.T) {
	// Verify that the REPEX job type is forwarded unchanged.
	stub := &level2RepoStub{}
	svc := newLevel2ServiceWithStub(stub)

	svc.batchResolveOpenProcessingFailures("LEVEL2_REPEX", []string{"LEI|ULTIMATE_ACCOUNTING_CONSOLIDATION_PARENT"}, nil)

	if stub.calledJobType != "LEVEL2_REPEX" {
		t.Errorf("expected calledJobType LEVEL2_REPEX, got %q", stub.calledJobType)
	}
}

func TestBatchResolveLevel2Service_RepoErrorIsLogged(t *testing.T) {
	// When the repo returns an error the service must not panic or propagate it.
	stub := &level2RepoStub{returnErr: errors.New("db failure")}
	svc := newLevel2ServiceWithStub(stub)

	// Should not panic.
	svc.batchResolveOpenProcessingFailures("LEVEL2_RR", []string{"START1|END1|TYPE"}, nil)

	if stub.callCount != 1 {
		t.Fatalf("expected 1 repo call even when it fails, got %d", stub.callCount)
	}
}
