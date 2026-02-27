package repository

import (
	"strings"
	"testing"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// Minimal DryRun GORM infrastructure for batch-resolve tests.
//
// These types alias the shared helpers defined in lei_level2_repository_test.go
// (nopDialector and sqlCaptureLogger) to avoid code duplication and divergence.
// Because they are type aliases (not new types), all methods defined on the
// originals are available here without re-declaration.
// ---------------------------------------------------------------------------

// batchNopDialector aliases the shared DryRun dialector implementation.
type batchNopDialector = nopDialector

// batchSQLCapture aliases the shared SQL capture logger implementation.
type batchSQLCapture = sqlCaptureLogger

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

// countINClauseArgs counts the number of '?' placeholders that appear inside
// the first IN(...) clause of sql.  Whitespace inside the clause is ignored so
// the helper is robust to GORM formatting differences such as "IN (?,?)" vs
// "IN(?, ?)".
func countINClauseArgs(sql string) int {
	// Find the IN keyword (case-insensitive search is not needed; GORM always uppercases SQL keywords).
	idx := strings.Index(sql, " IN ")
	if idx < 0 {
		idx = strings.Index(sql, " IN(")
	}
	if idx < 0 {
		return 0
	}
	rest := sql[idx:]
	open := strings.Index(rest, "(")
	if open < 0 {
		return 0
	}
	close := strings.Index(rest[open:], ")")
	if close < 0 {
		return 0
	}
	inClause := rest[open : open+close+1]
	return strings.Count(inClause, "?")
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
	// Deduplication check: 3 inputs contain 1 duplicate → 2 unique keys must be forwarded
	// to the IN clause, not 3.  We count '?' inside the IN(...) clause rather than
	// matching the exact rendered string ("IN (?,?)" vs "IN(?, ?)") to stay robust
	// across GORM formatting differences.
	inArgs := countINClauseArgs(sql)
	if inArgs != 2 {
		t.Errorf("expected 2 IN placeholder args after dedup (got %d); SQL: %s", inArgs, sql)
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
	// Deduplication check: 3 inputs contain 1 duplicate → 2 unique keys must be forwarded
	// to the IN clause, not 3.  We count '?' inside the IN(...) clause rather than
	// matching the exact rendered string ("IN (?,?)" vs "IN(?, ?)") to stay robust
	// across GORM formatting differences.
	inArgs := countINClauseArgs(sql)
	if inArgs != 2 {
		t.Errorf("expected 2 IN placeholder args after dedup (got %d); SQL: %s", inArgs, sql)
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
