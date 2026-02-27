package repository

import (
	"strings"
	"testing"
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
		"TRIM(entity_status) = ''",
		"UPPER(TRIM(entity_status)) = 'NULL'",
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
