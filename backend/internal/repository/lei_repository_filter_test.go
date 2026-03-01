package repository

import (
	"strings"
	"testing"

	"gorm.io/gorm"
)

func TestIsNotSetStatusFilter(t *testing.T) {
	t.Helper()

	if !isNotSetStatusFilter("NULL") {
		t.Fatalf("expected NULL to be treated as not-set filter")
	}

	if !isNotSetStatusFilter(" null ") {
		t.Fatalf("expected trimmed/case-insensitive null to be treated as not-set filter")
	}

	if !isNotSetStatusFilter("NOT_SET") {
		t.Fatalf("expected NOT_SET to be treated as not-set filter")
	}

	if !isNotSetStatusFilter("Not Set") {
		t.Fatalf("expected Not Set label token to be treated as not-set filter")
	}

	if isNotSetStatusFilter("ACTIVE") {
		t.Fatalf("did not expect ACTIVE to be treated as not-set filter")
	}
}

func TestNotSetEntityStatusWhereClauseCoversNullAndEmptyRepresentations(t *testing.T) {
	t.Helper()

	expectedFragments := []string{
		"entity_status IS NULL",
		"BTRIM(entity_status) = ''",
		"UPPER(BTRIM(entity_status)) = 'NULL'",
	}

	for _, fragment := range expectedFragments {
		if !strings.Contains(notSetEntityStatusWhereClause, fragment) {
			t.Fatalf("expected where clause to contain fragment %q, got: %s", fragment, notSetEntityStatusWhereClause)
		}
	}
}

func TestNormalizedEntityCategoryMatchWhereClauseUsesTrimmedCaseInsensitiveComparison(t *testing.T) {
	t.Helper()

	expectedFragments := []string{
		"UPPER(BTRIM(entity_category))",
		"UPPER(BTRIM(?))",
	}

	for _, fragment := range expectedFragments {
		if !strings.Contains(normalizedEntityCategoryMatchWhereClause, fragment) {
			t.Fatalf("expected category where clause to contain fragment %q, got: %s", fragment, normalizedEntityCategoryMatchWhereClause)
		}
	}
}

// newDryRunLEIRepo returns a leiRepository backed by a GORM DryRun session and
// a sqlCaptureLogger that records every SQL statement GORM builds. No real
// database connection is established. It reuses the nopDialector and
// sqlCaptureLogger helpers defined in lei_level2_repository_test.go (same package).
func newDryRunLEIRepo(t *testing.T) (*leiRepository, *sqlCaptureLogger) {
	t.Helper()
	capture := &sqlCaptureLogger{}
	db, err := gorm.Open(nopDialector{}, &gorm.Config{
		DryRun: true,
		Logger: capture,
	})
	if err != nil {
		t.Fatalf("newDryRunLEIRepo: gorm.Open failed: %v", err)
	}
	return &leiRepository{db: db}, capture
}

func TestGetDistinctCategories_QueryFiltersBlanksAndNullLikes(t *testing.T) {
	repo, capture := newDryRunLEIRepo(t)

	// DryRun mode builds the query without executing it; we expect no error and
	// inspect the generated SQL to ensure the correct filters are applied.
	_, err := repo.GetDistinctCategories()
	if err != nil {
		t.Fatalf("GetDistinctCategories returned error in DryRun mode: %v", err)
	}

	sql := capture.last()
	expectedFragments := []string{
		"BTRIM(entity_category)",
		"entity_category IS NOT NULL",
		"BTRIM(entity_category) <> ''",
		"UPPER(BTRIM(entity_category)) <> 'NULL'",
	}
	for _, fragment := range expectedFragments {
		if !strings.Contains(sql, fragment) {
			t.Fatalf("expected generated SQL to contain %q, got: %s", fragment, sql)
		}
	}
}
