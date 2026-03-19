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

func TestExactLEIMatchWhereClauseIncludesPrimaryAndIndexedSuccessorLEI(t *testing.T) {
	t.Helper()

	expectedFragments := []string{
		"lei = ?",
		"successor_lei = ?",
		"successor_lei IS NOT NULL",
		"BTRIM(successor_lei) <> ''",
	}

	for _, fragment := range expectedFragments {
		if !strings.Contains(exactLEIMatchWhereClause, fragment) {
			t.Fatalf("expected exact LEI match clause to contain fragment %q, got: %s", fragment, exactLEIMatchWhereClause)
		}
	}
}

func TestLikePatternLEISearchWhereClauseIncludesPrimaryAndSuccessorLEI(t *testing.T) {
	t.Helper()

	expectedFragments := []string{
		"lei ILIKE ?",
		"successor_lei ILIKE ?",
		"legal_name ILIKE ?",
	}

	for _, fragment := range expectedFragments {
		if !strings.Contains(likePatternLEISearchWhereClause, fragment) {
			t.Fatalf("expected ILIKE search clause to contain fragment %q, got: %s", fragment, likePatternLEISearchWhereClause)
		}
	}
}

func TestIsAlphanumericRejectsNonAlphanumericCharacters(t *testing.T) {
	t.Helper()

	// isAlphanumeric is always called with a 20-char string in practice
	// (guarded by len(search) == 20 in FindAllLEIWithFilters), so the
	// important cases are 20-char strings that are or are not alphanumeric.
	tests := []struct {
		input string
		want  bool
	}{
		{"ABCDEF1234567890ABCD", true},  // valid 20-char LEI format
		{"abcdef1234567890abcd", true},  // lowercase letters and digits
		{"12345678901234567890", true},  // digits only
		{"ABCDEF1234567890ABC!", false}, // contains special char
		{"ABCDEF 1234567890AB", false},  // contains space
	}

	for _, tt := range tests {
		got := isAlphanumeric(tt.input)
		if got != tt.want {
			t.Errorf("isAlphanumeric(%q) = %v, want %v", tt.input, got, tt.want)
		}
	}
}
