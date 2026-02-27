package service

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

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
// Shared stub for LEILevel2Repository tests
// ---------------------------------------------------------------------------

// level2RepoStub embeds the interface so only the methods under test need to be implemented.
// Fixture fields configure what the stub returns; captured fields record call arguments.
type level2RepoStub struct {
	repository.LEILevel2Repository
	// fixture data for GetProcessingFailures
	failures []*domain.LEILevel2ProcessingFailure
	listErr  error
	total    int64
	countErr error
	// captured call arguments for GetProcessingFailures
	gotJobType  string
	gotOpenOnly bool
	gotLimit    int
	gotOffset   int
	// captured call arguments for BatchResolveOpenProcessingFailures
	calledJobType  string
	calledKeys     []string
	calledSourceID *uuid.UUID
	calledNote     string
	returnErr      error
	callCount      int
}

func (r *level2RepoStub) ListProcessingFailures(jobType string, openOnly bool, limit, offset int) ([]*domain.LEILevel2ProcessingFailure, error) {
	r.gotJobType = jobType
	r.gotOpenOnly = openOnly
	r.gotLimit = limit
	r.gotOffset = offset
	return r.failures, r.listErr
}

func (r *level2RepoStub) CountProcessingFailures(jobType string, openOnly bool) (int64, error) {
	return r.total, r.countErr
}

func (r *level2RepoStub) BatchResolveOpenProcessingFailures(
	jobType string,
	naturalKeys []string,
	resolvedSourceFileID *uuid.UUID,
	resolvedNote string,
) error {
	r.callCount++
	r.calledJobType = jobType
	r.calledKeys = naturalKeys
	r.calledSourceID = resolvedSourceFileID
	r.calledNote = resolvedNote
	return r.returnErr
}

func newLevel2ServiceWithStub(stub *level2RepoStub) *leiLevel2Service {
	return &leiLevel2Service{repo: stub}
}

// --- TestGetProcessingFailures ---

func TestGetProcessingFailures_ReturnsFailuresAndTotal(t *testing.T) {
	sfID := uuid.New()
	expected := []*domain.LEILevel2ProcessingFailure{
		{
			ID:           uuid.New(),
			JobType:      "LEVEL2_RR",
			SourceFileID: &sfID,
			FailureStage: "UPSERT",
			NaturalKey:   "AAA:BBB:IS_DIRECTLY_CONSOLIDATED_BY",
			ErrorMessage: "db timeout",
			Resolved:     false,
			CreatedAt:    time.Now(),
		},
	}

	stub := &level2RepoStub{failures: expected, total: 1}
	svc := newLevel2ServiceWithStub(stub)

	failures, total, err := svc.GetProcessingFailures("LEVEL2_RR", true, 10, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 1 {
		t.Fatalf("expected total 1, got %d", total)
	}
	if len(failures) != 1 {
		t.Fatalf("expected 1 failure, got %d", len(failures))
	}
	if failures[0].JobType != "LEVEL2_RR" {
		t.Fatalf("unexpected job type: %s", failures[0].JobType)
	}
}

func TestGetProcessingFailures_ForwardsFiltersToRepository(t *testing.T) {
	tests := []struct {
		name     string
		jobType  string
		openOnly bool
		limit    int
		offset   int
	}{
		{"all types open only", "", true, 25, 0},
		{"LEVEL2_RR all resolved", "LEVEL2_RR", false, 50, 50},
		{"LEVEL2_REPEX open page 2", "LEVEL2_REPEX", true, 10, 10},
		{"all types second page", "", false, 100, 200},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stub := &level2RepoStub{failures: nil, total: 0}
			svc := newLevel2ServiceWithStub(stub)

			_, _, err := svc.GetProcessingFailures(tt.jobType, tt.openOnly, tt.limit, tt.offset)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if stub.gotJobType != tt.jobType {
				t.Errorf("jobType: got %q, want %q", stub.gotJobType, tt.jobType)
			}
			if stub.gotOpenOnly != tt.openOnly {
				t.Errorf("openOnly: got %v, want %v", stub.gotOpenOnly, tt.openOnly)
			}
			if stub.gotLimit != tt.limit {
				t.Errorf("limit: got %d, want %d", stub.gotLimit, tt.limit)
			}
			if stub.gotOffset != tt.offset {
				t.Errorf("offset: got %d, want %d", stub.gotOffset, tt.offset)
			}
		})
	}
}

func TestGetProcessingFailures_EmptyResult(t *testing.T) {
	stub := &level2RepoStub{failures: nil, total: 0}
	svc := newLevel2ServiceWithStub(stub)

	failures, total, err := svc.GetProcessingFailures("LEVEL2_RR", true, 10, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 0 {
		t.Fatalf("expected total 0, got %d", total)
	}
	if len(failures) != 0 {
		t.Fatalf("expected 0 failures, got %d", len(failures))
	}
}

func TestGetProcessingFailures_ListError(t *testing.T) {
	listErr := errors.New("db connection lost")
	stub := &level2RepoStub{listErr: listErr}
	svc := newLevel2ServiceWithStub(stub)

	failures, total, err := svc.GetProcessingFailures("LEVEL2_RR", true, 10, 0)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if err.Error() != listErr.Error() {
		t.Fatalf("expected error %q, got %q", listErr.Error(), err.Error())
	}
	if failures != nil {
		t.Fatalf("expected nil failures on error, got %v", failures)
	}
	if total != 0 {
		t.Fatalf("expected zero total on error, got %d", total)
	}
}

func TestGetProcessingFailures_CountError(t *testing.T) {
	countErr := errors.New("count query failed")
	sfID := uuid.New()
	stub := &level2RepoStub{
		failures: []*domain.LEILevel2ProcessingFailure{
			{
				ID:           uuid.New(),
				JobType:      "LEVEL2_REPEX",
				SourceFileID: &sfID,
				FailureStage: "UPSERT",
				NaturalKey:   "5493001KJTIIGC8Y1R12:NON_PUBLIC",
				ErrorMessage: "constraint violation",
				Resolved:     false,
				CreatedAt:    time.Now(),
			},
		},
		countErr: countErr,
	}
	svc := newLevel2ServiceWithStub(stub)

	failures, total, err := svc.GetProcessingFailures("LEVEL2_REPEX", false, 10, 0)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if err.Error() != countErr.Error() {
		t.Fatalf("expected error %q, got %q", countErr.Error(), err.Error())
	}
	if failures != nil {
		t.Fatalf("expected nil failures on count error, got %v", failures)
	}
	if total != 0 {
		t.Fatalf("expected zero total on count error, got %d", total)
	}
}

func TestGetProcessingFailures_ResolvedAndOpenFailures(t *testing.T) {
	resolvedAt := time.Now()
	resolvedSfID := uuid.New()
	failures := []*domain.LEILevel2ProcessingFailure{
		{
			JobType:  "LEVEL2_RR",
			Resolved: false,
		},
		{
			JobType:              "LEVEL2_RR",
			Resolved:             true,
			ResolvedAt:           &resolvedAt,
			ResolvedSourceFileID: &resolvedSfID,
			ResolvedNote:         "Resolved by subsequent successful upsert",
		},
	}

	stub := &level2RepoStub{failures: failures, total: 2}
	svc := newLevel2ServiceWithStub(stub)

	got, total, err := svc.GetProcessingFailures("LEVEL2_RR", false, 50, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 2 {
		t.Fatalf("expected total 2, got %d", total)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 failures, got %d", len(got))
	}
	if got[1].Resolved != true || got[1].ResolvedNote != "Resolved by subsequent successful upsert" {
		t.Fatalf("second failure should be resolved: %+v", got[1])
	}
}

// ---------------------------------------------------------------------------
// batchResolveOpenProcessingFailures (leiLevel2Service) – stub-based tests
// ---------------------------------------------------------------------------

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
