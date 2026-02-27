package repository

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
	"gorm.io/gorm"
	"gorm.io/gorm/callbacks"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

// repo is a zero-value leiLevel2Repository. The db field is nil, but all of the
// methods under test (detectRRChanges, detectRepexChanges, rrToJSON, repexToJSON)
// are pure helpers that never touch the database connection.
var level2Repo = &leiLevel2Repository{}

// ---------------------------------------------------------------------------
// DryRun test infrastructure
// ---------------------------------------------------------------------------

// nopDialector is a minimal GORM dialector that registers default callbacks but
// never opens a real database connection. Use it together with gorm.Config{DryRun:
// true} so that GORM builds SQL statements without executing them.
type nopDialector struct{}

func (nopDialector) Name() string { return "nop" }
func (nopDialector) Initialize(db *gorm.DB) error {
	callbacks.RegisterDefaultCallbacks(db, &callbacks.Config{})
	return nil
}
func (nopDialector) Migrator(*gorm.DB) gorm.Migrator { return nil }
func (nopDialector) DataTypeOf(*schema.Field) string  { return "nop" }
func (nopDialector) DefaultValueOf(*schema.Field) clause.Expression {
	return clause.Expr{SQL: "DEFAULT"}
}
func (nopDialector) BindVarTo(w clause.Writer, _ *gorm.Statement, _ interface{}) {
	_ = w.WriteByte('?')
}
func (nopDialector) QuoteTo(w clause.Writer, str string) { w.WriteString(str) }
func (nopDialector) Explain(sql string, vars ...interface{}) string {
	return logger.ExplainSQL(sql, nil, `'`, vars...)
}

// sqlCaptureLogger implements gorm.Logger and records the last SQL statement
// built by GORM's callbacks so tests can assert on its structure.
type sqlCaptureLogger struct {
	LastSQL string
}

func (l *sqlCaptureLogger) LogMode(logger.LogLevel) logger.Interface { return l }
func (l *sqlCaptureLogger) Info(_ context.Context, _ string, _ ...interface{})  {}
func (l *sqlCaptureLogger) Warn(_ context.Context, _ string, _ ...interface{})  {}
func (l *sqlCaptureLogger) Error(_ context.Context, _ string, _ ...interface{}) {}
func (l *sqlCaptureLogger) Trace(_ context.Context, _ time.Time, fc func() (string, int64), _ error) {
	l.LastSQL, _ = fc()
}

func newDryRunDB(t *testing.T, capture *sqlCaptureLogger) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(nopDialector{}, &gorm.Config{DryRun: true, Logger: capture})
	if err != nil {
		t.Fatalf("gorm.Open(nopDialector): %v", err)
	}
	return db
}

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
// filterNonEmptyStrings
// ---------------------------------------------------------------------------

func TestFilterNonEmptyStrings(t *testing.T) {
	tests := []struct {
		name  string
		input []string
		want  []string
	}{
		{
			name:  "empty slice",
			input: []string{},
			want:  []string{},
		},
		{
			name:  "nil slice",
			input: nil,
			want:  []string{},
		},
		{
			name:  "all blank whitespace",
			input: []string{"", "  ", "\t"},
			want:  []string{},
		},
		{
			name:  "mixed blank and valid",
			input: []string{"", "KEY1", "  ", "KEY2"},
			want:  []string{"KEY1", "KEY2"},
		},
		{
			name:  "deduplicates identical strings",
			input: []string{"KEY1", "KEY2", "KEY1"},
			want:  []string{"KEY1", "KEY2"},
		},
		{
			name:  "trims leading and trailing whitespace",
			input: []string{"  KEY1  ", "KEY1", " KEY2 "},
			want:  []string{"KEY1", "KEY2"},
		},
		{
			name:  "preserves already-normalised strings",
			input: []string{"A|B|C", "D|E|F"},
			want:  []string{"A|B|C", "D|E|F"},
		},
		{
			name:  "preserves order of first occurrence",
			input: []string{"B", "A", "B", "C", "A"},
			want:  []string{"B", "A", "C"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := filterNonEmptyStrings(tt.input)
			if len(got) != len(tt.want) {
				t.Fatalf("expected len %d, got len %d: %v", len(tt.want), len(got), got)
			}
			for i, w := range tt.want {
				if got[i] != w {
					t.Fatalf("index %d: expected %q, got %q", i, w, got[i])
				}
			}
		})
	}
}

// ---------------------------------------------------------------------------
// BatchResolveOpenProcessingFailures – leiRepository (Level 1)
// ---------------------------------------------------------------------------

func TestBatchResolveLevel1_EmptySliceReturnsNil(t *testing.T) {
	// With an empty input slice the function short-circuits before touching the
	// database, so a nil-db repository is safe to use here.
	r := &leiRepository{}
	if err := r.BatchResolveOpenProcessingFailures("LEVEL1_FULL", []string{}, nil, "note"); err != nil {
		t.Fatalf("expected nil error for empty input, got %v", err)
	}
}

func TestBatchResolveLevel1_AllBlankKeysReturnsNil(t *testing.T) {
	// All keys normalise to empty strings; filterNonEmptyStrings returns an
	// empty slice so the function returns nil without hitting the database.
	r := &leiRepository{}
	if err := r.BatchResolveOpenProcessingFailures("LEVEL1_FULL", []string{"", "  ", "\t"}, nil, "note"); err != nil {
		t.Fatalf("expected nil error for all-blank keys, got %v", err)
	}
}

func TestBatchResolveLevel1_SQLShape(t *testing.T) {
	capture := &sqlCaptureLogger{}
	db := newDryRunDB(t, capture)
	r := &leiRepository{db: db}

	sourceID := uuid.New()
	_ = r.BatchResolveOpenProcessingFailures(
		"LEVEL1_FULL",
		[]string{"KEY1", "  KEY2  ", "KEY1"}, // duplicate + whitespace → deduplicated
		&sourceID,
		"test resolution note",
	)

	sql := capture.LastSQL
	if sql == "" {
		t.Fatal("expected GORM to build a SQL statement, but captured SQL is empty")
	}
	if !strings.Contains(sql, "job_type") {
		t.Errorf("expected WHERE clause to filter by job_type, SQL: %s", sql)
	}
	if !strings.Contains(sql, "natural_key") {
		t.Errorf("expected WHERE clause to filter by natural_key, SQL: %s", sql)
	}
	if !strings.Contains(sql, "IN") {
		t.Errorf("expected SQL to use IN clause, SQL: %s", sql)
	}
	// Verify deduplication: KEY1 should appear exactly once despite being supplied
	// twice. Avoid quoting assumptions by matching the raw key string.
	if strings.Count(sql, "KEY1") != 1 {
		t.Errorf("expected duplicate key KEY1 to appear only once, SQL: %s", sql)
	}
	// resolved_source_file_id should be included when non-nil.
	if !strings.Contains(sql, "resolved_source_file_id") {
		t.Errorf("expected SQL to include resolved_source_file_id, SQL: %s", sql)
	}
	// resolved_note should be included when non-empty.
	if !strings.Contains(sql, "test resolution note") {
		t.Errorf("expected SQL to include the resolved note, SQL: %s", sql)
	}
}

func TestBatchResolveLevel1_NilSourceFileIDExcludedFromSQL(t *testing.T) {
	capture := &sqlCaptureLogger{}
	db := newDryRunDB(t, capture)
	r := &leiRepository{db: db}

	_ = r.BatchResolveOpenProcessingFailures("LEVEL1_FULL", []string{"KEY1"}, nil, "")

	sql := capture.LastSQL
	if strings.Contains(sql, "resolved_source_file_id") {
		t.Errorf("expected resolved_source_file_id to be absent when nil, SQL: %s", sql)
	}
	if strings.Contains(sql, "resolved_note") {
		t.Errorf("expected resolved_note to be absent when empty, SQL: %s", sql)
	}
}

// ---------------------------------------------------------------------------
// BatchResolveOpenProcessingFailures – leiLevel2Repository (Level 2)
// ---------------------------------------------------------------------------

func TestBatchResolveLevel2_EmptySliceReturnsNil(t *testing.T) {
	r := &leiLevel2Repository{}
	if err := r.BatchResolveOpenProcessingFailures("LEVEL2_RR", []string{}, nil, "note"); err != nil {
		t.Fatalf("expected nil error for empty input, got %v", err)
	}
}

func TestBatchResolveLevel2_AllBlankKeysReturnsNil(t *testing.T) {
	r := &leiLevel2Repository{}
	if err := r.BatchResolveOpenProcessingFailures("LEVEL2_RR", []string{"", "  "}, nil, "note"); err != nil {
		t.Fatalf("expected nil error for all-blank keys, got %v", err)
	}
}

func TestBatchResolveLevel2_SQLShape(t *testing.T) {
	capture := &sqlCaptureLogger{}
	db := newDryRunDB(t, capture)
	r := &leiLevel2Repository{db: db}

	sourceID := uuid.New()
	_ = r.BatchResolveOpenProcessingFailures(
		"LEVEL2_RR",
		[]string{"START1|END1|TYPE", "  START2|END2|TYPE  ", "START1|END1|TYPE"}, // duplicate
		&sourceID,
		"rr resolution note",
	)

	sql := capture.LastSQL
	if sql == "" {
		t.Fatal("expected GORM to build a SQL statement, but captured SQL is empty")
	}
	if !strings.Contains(sql, "job_type") {
		t.Errorf("expected WHERE clause to filter by job_type, SQL: %s", sql)
	}
	if !strings.Contains(sql, "natural_key") {
		t.Errorf("expected WHERE clause to filter by natural_key, SQL: %s", sql)
	}
	if !strings.Contains(sql, "IN") {
		t.Errorf("expected SQL to use IN clause, SQL: %s", sql)
	}
	// Verify deduplication: the duplicated key should appear exactly once.
	// Match on a stable substring that uniquely identifies the key without
	// relying on quote style.
	if strings.Count(sql, "START1|END1|TYPE") != 1 {
		t.Errorf("expected duplicate key to appear only once, SQL: %s", sql)
	}
}

func TestBatchResolveLevel2_NilSourceFileIDExcludedFromSQL(t *testing.T) {
	capture := &sqlCaptureLogger{}
	db := newDryRunDB(t, capture)
	r := &leiLevel2Repository{db: db}

	_ = r.BatchResolveOpenProcessingFailures("LEVEL2_REPEX", []string{"LEI|CAT"}, nil, "")

	sql := capture.LastSQL
	if strings.Contains(sql, "resolved_source_file_id") {
		t.Errorf("expected resolved_source_file_id to be absent when nil, SQL: %s", sql)
	}
	if strings.Contains(sql, "resolved_note") {
		t.Errorf("expected resolved_note to be absent when empty, SQL: %s", sql)
	}
}
