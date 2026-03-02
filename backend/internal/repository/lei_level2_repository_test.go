package repository

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
	"gorm.io/gorm"
	"gorm.io/gorm/callbacks"
	"gorm.io/gorm/clause"
	gorm_logger "gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
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

// ---------------------------------------------------------------------------
// DryRun infrastructure
//
// nopDialector is a minimal no-op GORM dialector that implements
// gorm.Dialector without establishing a real database connection.
// It is used together with gorm.Config{DryRun: true} to build and inspect
// SQL statements inside unit tests without requiring a running database.
// ---------------------------------------------------------------------------

type nopDialector struct{}

func (nopDialector) Name() string                                         { return "nop" }
func (nopDialector) Initialize(db *gorm.DB) error {
	// Register default GORM callbacks so that Find, Count, Create, and Update
	// build SQL statements even in DryRun mode.
	callbacks.RegisterDefaultCallbacks(db, &callbacks.Config{})
	return nil
}
func (nopDialector) Migrator(_ *gorm.DB) gorm.Migrator                  { return nil }
func (nopDialector) DataTypeOf(_ *schema.Field) string                   { return "" }
func (nopDialector) DefaultValueOf(_ *schema.Field) clause.Expression    { return clause.Expr{SQL: "NULL"} }
func (nopDialector) BindVarTo(w clause.Writer, _ *gorm.Statement, _ interface{}) {
	_, _ = w.WriteString("?")
}
func (nopDialector) QuoteTo(w clause.Writer, str string) { _, _ = w.WriteString(str) }
func (nopDialector) Explain(sql string, _ ...interface{}) string { return sql }

// sqlCaptureLogger records every SQL statement that GORM logs via its
// Trace callback so that tests can assert on generated query fragments.
type sqlCaptureLogger struct {
	mu      sync.Mutex
	queries []string
}

func (l *sqlCaptureLogger) LogMode(gorm_logger.LogLevel) gorm_logger.Interface { return l }
func (l *sqlCaptureLogger) Info(_ context.Context, _ string, _ ...interface{})  {}
func (l *sqlCaptureLogger) Warn(_ context.Context, _ string, _ ...interface{})  {}
func (l *sqlCaptureLogger) Error(_ context.Context, _ string, _ ...interface{}) {}
func (l *sqlCaptureLogger) Trace(_ context.Context, _ time.Time, fc func() (string, int64), _ error) {
	sql, _ := fc()
	l.mu.Lock()
	l.queries = append(l.queries, sql)
	l.mu.Unlock()
}

func (l *sqlCaptureLogger) last() string {
	l.mu.Lock()
	defer l.mu.Unlock()
	if len(l.queries) == 0 {
		return ""
	}
	return l.queries[len(l.queries)-1]
}

// newDryRunRepo returns a leiLevel2Repository backed by a GORM DryRun session
// and a sqlCaptureLogger that records every SQL statement GORM builds.
// No real database connection is established.
func newDryRunRepo(t *testing.T) (*leiLevel2Repository, *sqlCaptureLogger) {
	t.Helper()
	capture := &sqlCaptureLogger{}
	db, err := gorm.Open(nopDialector{}, &gorm.Config{
		DryRun: true,
		Logger: capture,
	})
	if err != nil {
		t.Fatalf("newDryRunRepo: gorm.Open failed: %v", err)
	}
	return &leiLevel2Repository{db: db}, capture
}

// ---------------------------------------------------------------------------
// ResolveOpenProcessingFailures – guard logic (no DB required)
// ---------------------------------------------------------------------------

func TestResolveOpenProcessingFailures_EmptyKey_ReturnsNilImmediately(t *testing.T) {
	// db is nil because the guard should return before any DB call.
	repo := &leiLevel2Repository{}
	if err := repo.ResolveOpenProcessingFailures("LEVEL2_RR", "", nil, "note"); err != nil {
		t.Fatalf("expected nil for empty naturalKey, got: %v", err)
	}
}

func TestResolveOpenProcessingFailures_WhitespaceKey_ReturnsNilImmediately(t *testing.T) {
	repo := &leiLevel2Repository{}
	if err := repo.ResolveOpenProcessingFailures("LEVEL2_RR", "   ", nil, "note"); err != nil {
		t.Fatalf("expected nil for whitespace-only naturalKey, got: %v", err)
	}
}

// ---------------------------------------------------------------------------
// CreateProcessingFailure – DryRun smoke test
// ---------------------------------------------------------------------------

func TestCreateProcessingFailure_DryRun_NoError(t *testing.T) {
	repo, _ := newDryRunRepo(t)
	failure := &domain.LEILevel2ProcessingFailure{
		ID:           uuid.New(),
		JobType:      "LEVEL2_RR",
		FailureStage: "UPSERT",
		NaturalKey:   "START|END|TYPE",
		ErrorMessage: "duplicate key value",
	}

	if err := repo.CreateProcessingFailure(failure); err != nil {
		t.Fatalf("unexpected error from CreateProcessingFailure in DryRun mode: %v", err)
	}
}

// ---------------------------------------------------------------------------
// ResolveOpenProcessingFailures – DryRun smoke test for non-empty key
// ---------------------------------------------------------------------------

func TestResolveOpenProcessingFailures_DryRun_NonEmptyKey_NoError(t *testing.T) {
	repo, capture := newDryRunRepo(t)
	id := uuid.New()
	if err := repo.ResolveOpenProcessingFailures("LEVEL2_RR", "START|END|TYPE", &id, "auto-resolved"); err != nil {
		t.Fatalf("unexpected error from ResolveOpenProcessingFailures in DryRun mode: %v", err)
	}

	sql := capture.last()
	if !strings.Contains(sql, "natural_key") {
		t.Errorf("expected UPDATE WHERE to filter by natural_key, got SQL: %s", sql)
	}
	if !strings.Contains(sql, "job_type") {
		t.Errorf("expected UPDATE WHERE to filter by job_type, got SQL: %s", sql)
	}
	if !strings.Contains(sql, "resolved") {
		t.Errorf("expected UPDATE WHERE to filter by resolved, got SQL: %s", sql)
	}
}

func TestResolveOpenProcessingFailures_DryRun_NilSourceFileID_NoError(t *testing.T) {
	repo, _ := newDryRunRepo(t)
	if err := repo.ResolveOpenProcessingFailures("LEVEL2_REPEX", "LEI|CATEGORY", nil, ""); err != nil {
		t.Fatalf("unexpected error when resolvedSourceFileID is nil: %v", err)
	}
}

// ---------------------------------------------------------------------------
// ListProcessingFailures – SQL query construction via DryRun
// ---------------------------------------------------------------------------

func TestListProcessingFailures_DryRun_NoFilters_ReturnsNoError(t *testing.T) {
	repo, capture := newDryRunRepo(t)
	_, err := repo.ListProcessingFailures("", false, 0, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	sql := capture.last()
	if !strings.Contains(sql, "lei_level2_processing_failures") {
		t.Errorf("expected SQL to reference failures table, got: %s", sql)
	}
	// No job_type or resolved filter expected when no filters are specified.
	if strings.Contains(sql, "job_type") {
		t.Errorf("expected SQL NOT to contain job_type filter when jobType is empty, got: %s", sql)
	}
}

func TestListProcessingFailures_DryRun_WithJobTypeFilter_IncludesWhereClause(t *testing.T) {
	repo, capture := newDryRunRepo(t)
	_, err := repo.ListProcessingFailures("LEVEL2_RR", false, 0, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	sql := capture.last()
	if !strings.Contains(sql, "job_type") {
		t.Errorf("expected SQL to filter by job_type, got: %s", sql)
	}
	if strings.Contains(sql, "resolved") {
		t.Errorf("expected SQL NOT to filter by resolved when openOnly=false, got: %s", sql)
	}
}

func TestListProcessingFailures_DryRun_WithOpenOnlyFilter_IncludesResolvedClause(t *testing.T) {
	repo, capture := newDryRunRepo(t)
	_, err := repo.ListProcessingFailures("", true, 0, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	sql := capture.last()
	if !strings.Contains(sql, "resolved") {
		t.Errorf("expected SQL to include resolved filter when openOnly=true, got: %s", sql)
	}
}

func TestListProcessingFailures_DryRun_WithWhitespaceJobType_NoJobTypeFilter(t *testing.T) {
	repo, capture := newDryRunRepo(t)
	_, err := repo.ListProcessingFailures("   ", false, 0, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	sql := capture.last()
	if strings.Contains(sql, "job_type") {
		t.Errorf("expected SQL NOT to contain job_type filter for whitespace jobType, got: %s", sql)
	}
}

func TestListProcessingFailures_DryRun_WithBothFilters_IncludesBothWhereClauses(t *testing.T) {
	repo, capture := newDryRunRepo(t)
	_, err := repo.ListProcessingFailures("LEVEL2_REPEX", true, 0, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	sql := capture.last()
	if !strings.Contains(sql, "job_type") {
		t.Errorf("expected SQL to filter by job_type, got: %s", sql)
	}
	if !strings.Contains(sql, "resolved") {
		t.Errorf("expected SQL to filter by resolved, got: %s", sql)
	}
}

func TestListProcessingFailures_DryRun_WithPagination_IncludesLimitAndOffset(t *testing.T) {
	repo, capture := newDryRunRepo(t)
	_, err := repo.ListProcessingFailures("", false, 25, 50)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	sql := capture.last()
	if !strings.Contains(sql, "LIMIT") && !strings.Contains(sql, "limit") {
		t.Errorf("expected SQL to include LIMIT clause, got: %s", sql)
	}
	if !strings.Contains(sql, "OFFSET") && !strings.Contains(sql, "offset") {
		t.Errorf("expected SQL to include OFFSET clause, got: %s", sql)
	}
}

func TestListProcessingFailures_DryRun_ZeroLimit_NoLimitClause(t *testing.T) {
	repo, capture := newDryRunRepo(t)
	_, err := repo.ListProcessingFailures("", false, 0, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	sql := capture.last()
	if strings.Contains(sql, "LIMIT 0") || strings.Contains(sql, "limit 0") {
		t.Errorf("expected SQL NOT to include LIMIT 0 (limit ≤0 should be ignored), got: %s", sql)
	}
}

// ---------------------------------------------------------------------------
// CountProcessingFailures – SQL query construction via DryRun
// ---------------------------------------------------------------------------

func TestCountProcessingFailures_DryRun_NoFilters_ReturnsNoError(t *testing.T) {
	repo, capture := newDryRunRepo(t)
	count, err := repo.CountProcessingFailures("", false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// DryRun returns 0 – verify no error and the SQL references the table.
	if count != 0 {
		t.Errorf("expected 0 from DryRun Count, got %d", count)
	}

	sql := capture.last()
	if !strings.Contains(sql, "lei_level2_processing_failures") {
		t.Errorf("expected SQL to reference failures table, got: %s", sql)
	}
	if strings.Contains(sql, "job_type") {
		t.Errorf("expected SQL NOT to contain job_type filter when jobType is empty, got: %s", sql)
	}
}

func TestCountProcessingFailures_DryRun_WithJobTypeFilter_IncludesWhereClause(t *testing.T) {
	repo, capture := newDryRunRepo(t)
	_, err := repo.CountProcessingFailures("LEVEL2_RR", false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	sql := capture.last()
	if !strings.Contains(sql, "job_type") {
		t.Errorf("expected SQL to filter by job_type, got: %s", sql)
	}
}

func TestCountProcessingFailures_DryRun_WithOpenOnlyFilter_IncludesResolvedClause(t *testing.T) {
	repo, capture := newDryRunRepo(t)
	_, err := repo.CountProcessingFailures("", true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	sql := capture.last()
	if !strings.Contains(sql, "resolved") {
		t.Errorf("expected SQL to filter by resolved when openOnly=true, got: %s", sql)
	}
}

func TestCountProcessingFailures_DryRun_WithBothFilters_IncludesBothWhereClauses(t *testing.T) {
	repo, capture := newDryRunRepo(t)
	_, err := repo.CountProcessingFailures("LEVEL2_REPEX", true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	sql := capture.last()
	if !strings.Contains(sql, "job_type") {
		t.Errorf("expected SQL to filter by job_type, got: %s", sql)
	}
	if !strings.Contains(sql, "resolved") {
		t.Errorf("expected SQL to filter by resolved, got: %s", sql)
	}
}
