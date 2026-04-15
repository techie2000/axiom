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

func TestFlushREPEXBatch_DeferredWhenLEIMissing(t *testing.T) {
	sourceFileID := uuid.New()
	leiLookup := &level2LEILookupStub{namesByLEI: map[string]string{
		"VALIDLEI00000000000001": "Valid Entity",
	}}

	repoStubREPEX := &level2REPEXFlushRepoStub{batchCreated: 1}
	svc := &leiLevel2Service{repo: repoStubREPEX, leiRepo: leiLookup}

	batch := []*domain.LEIReportingException{
		{
			LEI:               "VALIDLEI00000000000001",
			ExceptionCategory: "NO_KNOWN_PERSON",
			SourceFileID:      &sourceFileID,
		},
		{
			LEI:               "MISSINGLEI0000000002",
			ExceptionCategory: "NO_KNOWN_PERSON",
			SourceFileID:      &sourceFileID,
		},
	}

	processed, failed, err := svc.flushREPEXBatch(batch)
	if err != nil {
		t.Fatalf("flushREPEXBatch returned error: %v", err)
	}
	if processed != 1 {
		t.Fatalf("expected processed=1, got %d", processed)
	}
	if failed != 1 {
		t.Fatalf("expected failed=1, got %d", failed)
	}
	if repoStubREPEX.batchUpsertCalls != 1 {
		t.Fatalf("expected 1 batch upsert call, got %d", repoStubREPEX.batchUpsertCalls)
	}
	if len(repoStubREPEX.batchInput) != 1 {
		t.Fatalf("expected batch input len 1, got %d", len(repoStubREPEX.batchInput))
	}
	if repoStubREPEX.batchInput[0].LEI != "VALIDLEI00000000000001" {
		t.Fatalf("unexpected upserted LEI: %s", repoStubREPEX.batchInput[0].LEI)
	}
	if len(repoStubREPEX.failures) != 1 {
		t.Fatalf("expected 1 processing failure row, got %d", len(repoStubREPEX.failures))
	}
	if repoStubREPEX.failures[0].FailureStage != "FK_PREREQ" {
		t.Fatalf("expected failure stage FK_PREREQ, got %s", repoStubREPEX.failures[0].FailureStage)
	}
}

func TestFlushREPEXBatch_AllDeferredWhenNoLEIsExist(t *testing.T) {
	sourceFileID := uuid.New()
	repoStub := &level2REPEXFlushRepoStub{}
	leiLookup := &level2LEILookupStub{namesByLEI: map[string]string{}}
	svc := &leiLevel2Service{repo: repoStub, leiRepo: leiLookup}

	batch := []*domain.LEIReportingException{
		{LEI: "MISSINGLEI1000000001", ExceptionCategory: "NO_KNOWN_PERSON", SourceFileID: &sourceFileID},
		{LEI: "MISSINGLEI2000000002", ExceptionCategory: "NO_KNOWN_PERSON", SourceFileID: &sourceFileID},
	}

	processed, failed, err := svc.flushREPEXBatch(batch)
	if err != nil {
		t.Fatalf("flushREPEXBatch returned error: %v", err)
	}
	if processed != 0 {
		t.Fatalf("expected processed=0, got %d", processed)
	}
	if failed != 2 {
		t.Fatalf("expected failed=2, got %d", failed)
	}
	if repoStub.batchUpsertCalls != 0 {
		t.Fatalf("expected no batch upsert calls, got %d", repoStub.batchUpsertCalls)
	}
	if len(repoStub.failures) != 2 {
		t.Fatalf("expected 2 processing failures, got %d", len(repoStub.failures))
	}
}

func TestParseGLEIFTime_MillisecondVariants(t *testing.T) {
	tests := []struct {
		name  string
		input string
		wantY int
		wantM int
		wantD int
		wantH int
	}{
		{"whole-second Z", "2026-04-09T10:21:26Z", 2026, 4, 9, 10},
		{"millisecond .360Z", "2026-04-09T10:21:26.360Z", 2026, 4, 9, 10},
		{"millisecond .000Z", "2026-04-09T00:00:00.000Z", 2026, 4, 9, 0},
		{"date-only", "2026-04-09", 2026, 4, 9, 0},
		{"no-Z whole-second", "2026-04-09T10:21:26", 2026, 4, 9, 10},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseGLEIFTime(tt.input)
			if got == nil {
				t.Fatalf("parseGLEIFTime(%q) returned nil", tt.input)
			}
			if got.Year() != tt.wantY || int(got.Month()) != tt.wantM || got.Day() != tt.wantD || got.Hour() != tt.wantH {
				t.Fatalf("parseGLEIFTime(%q) = %v, want %04d-%02d-%02d %02d:xx", tt.input, got, tt.wantY, tt.wantM, tt.wantD, tt.wantH)
			}
		})
	}
}

type level2REPEXFlushRepoStub struct {
	repository.LEILevel2Repository
	batchUpsertCalls int
	batchInput       []*domain.LEIReportingException
	batchCreated     int
	batchUpdated     int
	batchErr         error
	failures         []*domain.LEILevel2ProcessingFailure
}

func (r *level2REPEXFlushRepoStub) BatchUpsertReportingExceptions(records []*domain.LEIReportingException) (int, int, error) {
	r.batchUpsertCalls++
	r.batchInput = append([]*domain.LEIReportingException(nil), records...)
	return r.batchCreated, r.batchUpdated, r.batchErr
}

func (r *level2REPEXFlushRepoStub) UpsertReportingException(exc *domain.LEIReportingException) error {
	return nil
}

func (r *level2REPEXFlushRepoStub) CreateProcessingFailure(failure *domain.LEILevel2ProcessingFailure) error {
	copy := *failure
	r.failures = append(r.failures, &copy)
	return nil
}

func (r *level2REPEXFlushRepoStub) BatchResolveOpenProcessingFailures(string, []string, *uuid.UUID, string) error {
	return nil
}

func (r *level2REPEXFlushRepoStub) ResolveOpenProcessingFailures(string, string, *uuid.UUID, string) error {
	return nil
}

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

func TestGleifStringList_UnmarshalAndToJSONB(t *testing.T) {
	var reasons gleifStringList
	if err := json.Unmarshal([]byte(`[{"$":"NON_CONSOLIDATING"},{"$":"NO_KNOWN_PERSON"}]`), &reasons); err != nil {
		t.Fatalf("array unmarshal failed: %v", err)
	}
	if got := string(gleifReasonsToJSONB(reasons)); got != `["NON_CONSOLIDATING","NO_KNOWN_PERSON"]` {
		t.Fatalf("unexpected JSONB multi-reasons: %s", got)
	}

	if err := json.Unmarshal([]byte(`{"$":"NON_CONSOLIDATING"}`), &reasons); err != nil {
		t.Fatalf("single unmarshal failed: %v", err)
	}
	if got := string(gleifReasonsToJSONB(reasons)); got != `["NON_CONSOLIDATING"]` {
		t.Fatalf("unexpected JSONB single-reason: %s", got)
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
	if got := string(gleifReasonsToJSONB(raw.ExceptionReason)); got != `["NON_CONSOLIDATING"]` {
		t.Fatalf("unexpected JSONB reason payload: %s", got)
	}
	if raw.ExceptionReference.String() != "Datenschutz" {
		t.Fatalf("unexpected reference: %s", raw.ExceptionReference.String())
	}
}

// --- stub for LEILevel2Repository ---

// level2RepoStub embeds the interface so only the methods under test need to be implemented.
// Fixture fields (failures, listErr, total, countErr) configure what the stub returns;
// captured fields (gotJobType, gotOpenOnly, gotLimit, gotOffset) record call arguments.
type level2RepoStub struct {
	repository.LEILevel2Repository
	// fixture data returned by stub methods
	failures []*domain.LEILevel2ProcessingFailure
	listErr  error
	total    int64
	countErr error
	// captured call arguments for assertion
	gotJobType  string
	gotOpenOnly bool
	gotLimit    int
	gotOffset   int
}

type leiRepoUpdateStub struct {
	repository.LEIRepository
	updateCalls int
	lastFile    *domain.SourceFile
	updateErr   error
	status      *domain.FileProcessingStatus
}

func (r *leiRepoUpdateStub) UpdateSourceFile(file *domain.SourceFile) error {
	r.updateCalls++
	if file != nil {
		copied := *file
		r.lastFile = &copied
	}
	return r.updateErr
}

func (r *leiRepoUpdateStub) FindProcessingStatus(jobType string) (*domain.FileProcessingStatus, error) {
	if r.status == nil {
		r.status = &domain.FileProcessingStatus{JobType: jobType}
	}
	return r.status, nil
}

func (r *leiRepoUpdateStub) UpdateProcessingStatus(status *domain.FileProcessingStatus) error {
	if status == nil {
		return nil
	}
	copy := *status
	r.status = &copy
	return nil
}

func (r *leiRepoUpdateStub) UpdateProcessingProgressMessageByJobType(jobType, progressMessage string) error {
	if r.status == nil {
		r.status = &domain.FileProcessingStatus{JobType: jobType}
	}
	r.status.JobType = jobType
	r.status.ProgressMessage = progressMessage
	return nil
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

func TestShouldPersistLevel2ProgressCheckpoint(t *testing.T) {
	tests := []struct {
		name              string
		previousProcessed int
		processed         int
		previousFailed    int
		failed            int
		force             bool
		expected          bool
	}{
		{
			name:              "no change does not persist",
			previousProcessed: 100,
			processed:         100,
			previousFailed:    0,
			failed:            0,
			force:             false,
			expected:          false,
		},
		{
			name:              "failure count change always persists",
			previousProcessed: 100,
			processed:         100,
			previousFailed:    0,
			failed:            1,
			force:             false,
			expected:          true,
		},
		{
			name:              "processed in same checkpoint interval does not persist",
			previousProcessed: 100,
			processed:         999,
			previousFailed:    0,
			failed:            0,
			force:             false,
			expected:          false,
		},
		{
			name:              "crossing checkpoint interval persists",
			previousProcessed: 999,
			processed:         1000,
			previousFailed:    0,
			failed:            0,
			force:             false,
			expected:          true,
		},
		{
			name:              "forced persist with changes",
			previousProcessed: 10,
			processed:         11,
			previousFailed:    0,
			failed:            0,
			force:             true,
			expected:          true,
		},
		{
			name:              "forced persist with no changes is skipped",
			previousProcessed: 10,
			processed:         10,
			previousFailed:    1,
			failed:            1,
			force:             true,
			expected:          false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := shouldPersistLevel2ProgressCheckpoint(
				tt.previousProcessed,
				tt.processed,
				tt.previousFailed,
				tt.failed,
				tt.force,
			)

			if got != tt.expected {
				t.Fatalf("expected %v, got %v", tt.expected, got)
			}
		})
	}
}

func TestPersistLevel2Progress(t *testing.T) {
	tests := []struct {
		name              string
		initialProcessed  int
		initialFailed     int
		initialTotal      int
		nextProcessed     int
		nextFailed        int
		force             bool
		expectedCalls     int
		expectedProcessed int
		expectedFailed    int
		expectedTotal     int
	}{
		{
			name:              "checkpoint interval not crossed does not persist",
			initialProcessed:  100,
			initialFailed:     0,
			initialTotal:      2000,
			nextProcessed:     500,
			nextFailed:        0,
			force:             false,
			expectedCalls:     0,
			expectedProcessed: 100,
			expectedFailed:    0,
			expectedTotal:     2000,
		},
		{
			name:              "crossing checkpoint persists",
			initialProcessed:  999,
			initialFailed:     0,
			initialTotal:      2000,
			nextProcessed:     1000,
			nextFailed:        0,
			force:             false,
			expectedCalls:     1,
			expectedProcessed: 1000,
			expectedFailed:    0,
			expectedTotal:     2000,
		},
		{
			name:              "failed count change persists immediately",
			initialProcessed:  200,
			initialFailed:     0,
			initialTotal:      2000,
			nextProcessed:     200,
			nextFailed:        1,
			force:             false,
			expectedCalls:     1,
			expectedProcessed: 200,
			expectedFailed:    1,
			expectedTotal:     2000,
		},
		{
			name:              "force persists changed state",
			initialProcessed:  10,
			initialFailed:     0,
			initialTotal:      2000,
			nextProcessed:     11,
			nextFailed:        0,
			force:             true,
			expectedCalls:     1,
			expectedProcessed: 11,
			expectedFailed:    0,
			expectedTotal:     2000,
		},
		{
			name:              "force without state change is skipped",
			initialProcessed:  10,
			initialFailed:     0,
			initialTotal:      2000,
			nextProcessed:     10,
			nextFailed:        0,
			force:             true,
			expectedCalls:     0,
			expectedProcessed: 10,
			expectedFailed:    0,
			expectedTotal:     2000,
		},
		{
			name:              "total records is expanded when processed exceeds total",
			initialProcessed:  5,
			initialFailed:     0,
			initialTotal:      5,
			nextProcessed:     7,
			nextFailed:        0,
			force:             true,
			expectedCalls:     1,
			expectedProcessed: 7,
			expectedFailed:    0,
			expectedTotal:     7,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			leiRepo := &leiRepoUpdateStub{}
			svc := &leiLevel2Service{leiRepo: leiRepo}
			sourceFile := &domain.SourceFile{
				ID:               uuid.New(),
				ProcessedRecords: tt.initialProcessed,
				FailedRecords:    tt.initialFailed,
				TotalRecords:     tt.initialTotal,
			}

			svc.persistLevel2Progress(sourceFile, tt.nextProcessed, tt.nextFailed, 0, tt.force)

			if leiRepo.updateCalls != tt.expectedCalls {
				t.Fatalf("expected %d update call(s), got %d", tt.expectedCalls, leiRepo.updateCalls)
			}

			if sourceFile.ProcessedRecords != tt.expectedProcessed {
				t.Fatalf("expected processed %d, got %d", tt.expectedProcessed, sourceFile.ProcessedRecords)
			}
			if sourceFile.FailedRecords != tt.expectedFailed {
				t.Fatalf("expected failed %d, got %d", tt.expectedFailed, sourceFile.FailedRecords)
			}
			if sourceFile.TotalRecords != tt.expectedTotal {
				t.Fatalf("expected total %d, got %d", tt.expectedTotal, sourceFile.TotalRecords)
			}

			if tt.expectedCalls > 0 && leiRepo.lastFile == nil {
				t.Fatal("expected repository to receive updated source file")
			}
		})
	}
}

func TestBuildLevel2ProgressMessage(t *testing.T) {
	raw := buildLevel2ProgressMessage(470651, 470651, 116, 4)
	if raw == "" {
		t.Fatal("expected non-empty progress message")
	}

	var payload level2ProgressMessage
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		t.Fatalf("expected valid JSON payload, got error: %v", err)
	}

	if payload.Kind != "level2-progress" {
		t.Fatalf("expected kind level2-progress, got %q", payload.Kind)
	}
	if payload.Evaluated != 470651 {
		t.Fatalf("expected evaluated 470651, got %d", payload.Evaluated)
	}
	if payload.Upserted != 116 {
		t.Fatalf("expected upserted 116, got %d", payload.Upserted)
	}
	if payload.Failed != 4 {
		t.Fatalf("expected failed 4, got %d", payload.Failed)
	}
	if payload.Unchanged != 470531 {
		t.Fatalf("expected unchanged 470531, got %d", payload.Unchanged)
	}
	if payload.Total != 470651 {
		t.Fatalf("expected total 470651, got %d", payload.Total)
	}
}

type level2RRFlushRepoStub struct {
	repository.LEILevel2Repository
	batchUpsertCalls int
	batchInput       []*domain.LEIRelationshipRecord
	batchCreated     int
	batchUpdated     int
	batchErr         error
	upsertCalls      int
	failures         []*domain.LEILevel2ProcessingFailure
}

func (r *level2RRFlushRepoStub) BatchUpsertRelationshipRecords(records []*domain.LEIRelationshipRecord) (int, int, error) {
	r.batchUpsertCalls++
	r.batchInput = append([]*domain.LEIRelationshipRecord(nil), records...)
	return r.batchCreated, r.batchUpdated, r.batchErr
}

func (r *level2RRFlushRepoStub) UpsertRelationshipRecord(record *domain.LEIRelationshipRecord) error {
	r.upsertCalls++
	return nil
}

func (r *level2RRFlushRepoStub) CreateProcessingFailure(failure *domain.LEILevel2ProcessingFailure) error {
	copy := *failure
	r.failures = append(r.failures, &copy)
	return nil
}

func (r *level2RRFlushRepoStub) BatchResolveOpenProcessingFailures(string, []string, *uuid.UUID, string) error {
	return nil
}

func (r *level2RRFlushRepoStub) ResolveOpenProcessingFailures(string, string, *uuid.UUID, string) error {
	return nil
}

type level2LEILookupStub struct {
	repository.LEIRepository
	namesByLEI map[string]string
	err        error
	lookups    [][]string
}

func (r *level2LEILookupStub) FindLegalNamesByLEICodes(codes []string) (map[string]string, error) {
	lookupCopy := append([]string(nil), codes...)
	r.lookups = append(r.lookups, lookupCopy)
	if r.err != nil {
		return nil, r.err
	}
	result := make(map[string]string, len(r.namesByLEI))
	for k, v := range r.namesByLEI {
		result[k] = v
	}
	return result, nil
}

func TestFlushRRBatch_DeferredWhenParentLEIMissing(t *testing.T) {
	sourceFileID := uuid.New()
	repoStub := &level2RRFlushRepoStub{batchCreated: 1}
	leiLookup := &level2LEILookupStub{namesByLEI: map[string]string{
		"VALIDSTART00000000001": "Valid Start",
		"VALIDEND0000000000002": "Valid End",
	}}
	svc := &leiLevel2Service{repo: repoStub, leiRepo: leiLookup}

	batch := []*domain.LEIRelationshipRecord{
		{
			StartNodeLEI:     "VALIDSTART00000000001",
			EndNodeLEI:       "VALIDEND0000000000002",
			RelationshipType: "IS_DIRECTLY_CONSOLIDATED_BY",
			SourceFileID:     &sourceFileID,
		},
		{
			StartNodeLEI:     "MISSINGSTART000000001",
			EndNodeLEI:       "VALIDEND0000000000002",
			RelationshipType: "IS_ULTIMATELY_CONSOLIDATED_BY",
			SourceFileID:     &sourceFileID,
		},
	}

	processed, failed, err := svc.flushRRBatch(batch)
	if err != nil {
		t.Fatalf("flushRRBatch returned error: %v", err)
	}
	if processed != 1 {
		t.Fatalf("expected processed=1, got %d", processed)
	}
	if failed != 1 {
		t.Fatalf("expected failed=1, got %d", failed)
	}
	if repoStub.batchUpsertCalls != 1 {
		t.Fatalf("expected 1 batch upsert call, got %d", repoStub.batchUpsertCalls)
	}
	if len(repoStub.batchInput) != 1 {
		t.Fatalf("expected batch input len 1, got %d", len(repoStub.batchInput))
	}
	if repoStub.batchInput[0].StartNodeLEI != "VALIDSTART00000000001" {
		t.Fatalf("unexpected upserted start LEI: %s", repoStub.batchInput[0].StartNodeLEI)
	}
	if len(repoStub.failures) != 1 {
		t.Fatalf("expected 1 processing failure row, got %d", len(repoStub.failures))
	}
	if repoStub.failures[0].FailureStage != "FK_PREREQ" {
		t.Fatalf("expected failure stage FK_PREREQ, got %s", repoStub.failures[0].FailureStage)
	}
}

func TestFlushRRBatch_AllDeferredWhenNoParentLEIsExist(t *testing.T) {
	sourceFileID := uuid.New()
	repoStub := &level2RRFlushRepoStub{}
	leiLookup := &level2LEILookupStub{namesByLEI: map[string]string{}}
	svc := &leiLevel2Service{repo: repoStub, leiRepo: leiLookup}

	batch := []*domain.LEIRelationshipRecord{
		{
			StartNodeLEI:     "MISSINGSTART000000001",
			EndNodeLEI:       "MISSINGEND00000000002",
			RelationshipType: "IS_DIRECTLY_CONSOLIDATED_BY",
			SourceFileID:     &sourceFileID,
		},
		{
			StartNodeLEI:     "MISSINGSTART000000003",
			EndNodeLEI:       "MISSINGEND00000000004",
			RelationshipType: "IS_ULTIMATELY_CONSOLIDATED_BY",
			SourceFileID:     &sourceFileID,
		},
	}

	processed, failed, err := svc.flushRRBatch(batch)
	if err != nil {
		t.Fatalf("flushRRBatch returned error: %v", err)
	}
	if processed != 0 {
		t.Fatalf("expected processed=0, got %d", processed)
	}
	if failed != 2 {
		t.Fatalf("expected failed=2, got %d", failed)
	}
	if repoStub.batchUpsertCalls != 0 {
		t.Fatalf("expected no batch upsert calls, got %d", repoStub.batchUpsertCalls)
	}
	if repoStub.upsertCalls != 0 {
		t.Fatalf("expected no row-by-row upsert calls, got %d", repoStub.upsertCalls)
	}
	if len(repoStub.failures) != 2 {
		t.Fatalf("expected 2 processing failures, got %d", len(repoStub.failures))
	}
}
