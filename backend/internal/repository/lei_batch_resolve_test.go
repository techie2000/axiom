package repository

import (
"context"
"strings"
"sync"
"testing"
"time"

"github.com/google/uuid"
"gorm.io/gorm"
"gorm.io/gorm/callbacks"
gorm_logger "gorm.io/gorm/logger"
"gorm.io/gorm/clause"
"gorm.io/gorm/schema"
)

// ---------------------------------------------------------------------------
// Minimal DryRun GORM infrastructure for batch-resolve tests.
//
// These types use distinct names from those in lei_level2_repository_test.go
// to avoid duplicate-declaration errors when both test files are compiled
// together after this branch is merged into the base.
// ---------------------------------------------------------------------------

type batchNopDialector struct{}

func (batchNopDialector) Name() string { return "nop" }
func (batchNopDialector) Initialize(db *gorm.DB) error {
callbacks.RegisterDefaultCallbacks(db, &callbacks.Config{})
return nil
}
func (batchNopDialector) Migrator(_ *gorm.DB) gorm.Migrator               { return nil }
func (batchNopDialector) DataTypeOf(_ *schema.Field) string                { return "" }
func (batchNopDialector) DefaultValueOf(_ *schema.Field) clause.Expression { return clause.Expr{SQL: "NULL"} }
func (batchNopDialector) BindVarTo(w clause.Writer, _ *gorm.Statement, _ interface{}) {
_, _ = w.WriteString("?")
}
func (batchNopDialector) QuoteTo(w clause.Writer, str string) { _, _ = w.WriteString(str) }
func (batchNopDialector) Explain(sql string, _ ...interface{}) string { return sql }

// batchSQLCapture records every SQL statement that GORM logs via Trace.
type batchSQLCapture struct {
mu      sync.Mutex
queries []string
}

func (l *batchSQLCapture) LogMode(gorm_logger.LogLevel) gorm_logger.Interface { return l }
func (l *batchSQLCapture) Info(_ context.Context, _ string, _ ...interface{})  {}
func (l *batchSQLCapture) Warn(_ context.Context, _ string, _ ...interface{})  {}
func (l *batchSQLCapture) Error(_ context.Context, _ string, _ ...interface{}) {}
func (l *batchSQLCapture) Trace(_ context.Context, _ time.Time, fc func() (string, int64), _ error) {
sql, _ := fc()
l.mu.Lock()
l.queries = append(l.queries, sql)
l.mu.Unlock()
}

func (l *batchSQLCapture) last() string {
l.mu.Lock()
defer l.mu.Unlock()
if len(l.queries) == 0 {
return ""
}
return l.queries[len(l.queries)-1]
}

func newBatchLeiRepo(t *testing.T) (*leiRepository, *batchSQLCapture) {
t.Helper()
cap := &batchSQLCapture{}
db, err := gorm.Open(batchNopDialector{}, &gorm.Config{DryRun: true, Logger: cap})
if err != nil {
t.Fatalf("newBatchLeiRepo: gorm.Open failed: %v", err)
}
return &leiRepository{db: db}, cap
}

func newBatchLevel2Repo(t *testing.T) (*leiLevel2Repository, *batchSQLCapture) {
t.Helper()
cap := &batchSQLCapture{}
db, err := gorm.Open(batchNopDialector{}, &gorm.Config{DryRun: true, Logger: cap})
if err != nil {
t.Fatalf("newBatchLevel2Repo: gorm.Open failed: %v", err)
}
return &leiLevel2Repository{db: db}, cap
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
{name: "empty slice", input: []string{}, want: []string{}},
{name: "nil slice", input: nil, want: []string{}},
{name: "all blank whitespace", input: []string{"", "  ", "\t"}, want: []string{}},
{name: "mixed blank and valid", input: []string{"", "A", "  ", "B", "\t"}, want: []string{"A", "B"}},
{name: "duplicates removed", input: []string{"A", "B", "A", "C", "B"}, want: []string{"A", "B", "C"}},
{name: "leading and trailing whitespace stripped", input: []string{"  hello  ", "world\t"}, want: []string{"hello", "world"}},
{name: "already normalized", input: []string{"x", "y", "z"}, want: []string{"x", "y", "z"}},
{name: "order preserved", input: []string{"c", "a", "b"}, want: []string{"c", "a", "b"}},
}
for _, tt := range tests {
t.Run(tt.name, func(t *testing.T) {
got := filterNonEmptyStrings(tt.input)
if len(got) != len(tt.want) {
t.Fatalf("filterNonEmptyStrings(%v) = %v, want %v", tt.input, got, tt.want)
}
for i := range got {
if got[i] != tt.want[i] {
t.Errorf("[%d] got %q, want %q", i, got[i], tt.want[i])
}
}
})
}
}

// ---------------------------------------------------------------------------
// BatchResolveOpenProcessingFailures – leiRepository (Level 1)
// ---------------------------------------------------------------------------

func TestBatchResolveLevel1_EmptySliceReturnsNil(t *testing.T) {
r := &leiRepository{}
if err := r.BatchResolveOpenProcessingFailures("LEVEL1_FULL", []string{}, nil, "note"); err != nil {
t.Fatalf("expected nil error for empty input, got %v", err)
}
}

func TestBatchResolveLevel1_AllBlankKeysReturnsNil(t *testing.T) {
r := &leiRepository{}
if err := r.BatchResolveOpenProcessingFailures("LEVEL1_FULL", []string{"", "  ", "\t"}, nil, "note"); err != nil {
t.Fatalf("expected nil error for all-blank keys, got %v", err)
}
}

func TestBatchResolveLevel1_SQLShape(t *testing.T) {
r, cap := newBatchLeiRepo(t)

sourceID := uuid.New()
_ = r.BatchResolveOpenProcessingFailures(
"LEVEL1_FULL",
[]string{"KEY1", "  KEY2  ", "KEY1"}, // duplicate + whitespace → 2 unique keys
&sourceID,
"test resolution note",
)

sql := cap.last()
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
// Deduplication: 3 inputs → 2 unique keys → IN (?,?) not IN (?,?,?)
if strings.Contains(sql, "IN (?,?,?)") {
t.Errorf("expected deduplication to produce 2 IN args (not 3), SQL: %s", sql)
}
if !strings.Contains(sql, "IN (?,?)") {
t.Errorf("expected exactly 2 IN args after dedup, SQL: %s", sql)
}
if !strings.Contains(sql, "resolved_source_file_id") {
t.Errorf("expected SQL to include resolved_source_file_id, SQL: %s", sql)
}
if !strings.Contains(sql, "resolved_note") {
t.Errorf("expected SQL SET clause to include resolved_note, SQL: %s", sql)
}
}

func TestBatchResolveLevel1_NilSourceFileIDExcludedFromSQL(t *testing.T) {
r, cap := newBatchLeiRepo(t)
_ = r.BatchResolveOpenProcessingFailures("LEVEL1_FULL", []string{"KEY1"}, nil, "")
sql := cap.last()
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
repo, cap := newBatchLevel2Repo(t)

sourceID := uuid.New()
_ = repo.BatchResolveOpenProcessingFailures(
"LEVEL2_RR",
[]string{"START1|END1|TYPE", "  START2|END2|TYPE  ", "START1|END1|TYPE"}, // duplicate
&sourceID,
"rr resolution note",
)

sql := cap.last()
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
// Deduplication: 3 inputs → 2 unique keys → IN (?,?) not IN (?,?,?)
if strings.Contains(sql, "IN (?,?,?)") {
t.Errorf("expected deduplication to produce 2 IN args (not 3), SQL: %s", sql)
}
if !strings.Contains(sql, "IN (?,?)") {
t.Errorf("expected exactly 2 IN args after dedup, SQL: %s", sql)
}
}

func TestBatchResolveLevel2_NilSourceFileIDExcludedFromSQL(t *testing.T) {
repo, cap := newBatchLevel2Repo(t)
_ = repo.BatchResolveOpenProcessingFailures("LEVEL2_REPEX", []string{"LEI|CAT"}, nil, "")
sql := cap.last()
if strings.Contains(sql, "resolved_source_file_id") {
t.Errorf("expected resolved_source_file_id to be absent when nil, SQL: %s", sql)
}
if strings.Contains(sql, "resolved_note") {
t.Errorf("expected resolved_note to be absent when empty, SQL: %s", sql)
}
}
