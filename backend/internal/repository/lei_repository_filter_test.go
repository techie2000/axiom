package repository

import (
	"strings"
	"testing"

	"github.com/techie2000/axiom/internal/domain"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func columnNames(columns []clause.Column) []string {
	names := make([]string, 0, len(columns))
	for _, col := range columns {
		names = append(names, col.Name)
	}
	return names
}

func containsColumn(columns []clause.Column, target string) bool {
	for _, col := range columns {
		if col.Name == target {
			return true
		}
	}
	return false
}

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

func TestNormalizeExactLEISearchInputUppercasesAndTrims(t *testing.T) {
	t.Helper()

	input := "  529900T8BM49AURSDO55  "
	got := normalizeExactLEISearchInput(input)
	want := "529900T8BM49AURSDO55"

	if got != want {
		t.Fatalf("normalizeExactLEISearchInput(%q) = %q, want %q", input, got, want)
	}
}

func TestValidateColumns_DefaultsAndFallbacks(t *testing.T) {
	t.Helper()

	defaults := columnNames(validateColumns(""))
	if len(defaults) == 0 {
		t.Fatalf("expected default columns for empty input")
	}
	if defaults[0] != "id" {
		t.Fatalf("expected first default column to be id, got %q", defaults[0])
	}
	if !containsColumn(validateColumns(""), "other_names") {
		t.Fatalf("expected default columns to include other_names")
	}

	fallback := columnNames(validateColumns("not_a_real_column"))
	if len(fallback) == 0 {
		t.Fatalf("expected fallback columns for invalid input")
	}
	if fallback[0] != "id" {
		t.Fatalf("expected first fallback column to be id, got %q", fallback[0])
	}
	if containsColumn(validateColumns("not_a_real_column"), "other_names") {
		t.Fatalf("did not expect fallback columns to include other_names")
	}
}

func TestValidateColumns_AlwaysIncludesIDForValidUserSelection(t *testing.T) {
	t.Helper()

	columns := validateColumns("lei, legal_name")
	if !containsColumn(columns, "id") {
		t.Fatalf("expected validated columns to always include id")
	}

	names := columnNames(columns)
	if len(names) < 3 {
		t.Fatalf("expected id + requested columns, got %v", names)
	}
	if names[0] != "id" {
		t.Fatalf("expected id prepended first, got %v", names)
	}
}

func TestEnsureLinkedLEICodeColumns_AddsRequiredColumnsWithoutDuplicates(t *testing.T) {
	t.Helper()

	base := []clause.Column{{Name: "id"}, {Name: "lei"}}
	withLinked := ensureLinkedLEICodeColumns(base)

	if !containsColumn(withLinked, "managing_lou") {
		t.Fatalf("expected managing_lou to be added")
	}
	if !containsColumn(withLinked, "successor_lei") {
		t.Fatalf("expected successor_lei to be added")
	}

	again := ensureLinkedLEICodeColumns(withLinked)
	manageCount := 0
	successorCount := 0
	for _, col := range again {
		if col.Name == "managing_lou" {
			manageCount++
		}
		if col.Name == "successor_lei" {
			successorCount++
		}
	}
	if manageCount != 1 || successorCount != 1 {
		t.Fatalf("expected linked code columns to be unique, got managing_lou=%d successor_lei=%d", manageCount, successorCount)
	}
}

func TestFindAllLEIWithFilters_IncludeLinkedNames_ForcesLinkedCodeColumnsInSelect(t *testing.T) {
	t.Helper()

	capture := &sqlCaptureLogger{}
	db, err := gorm.Open(nopDialector{}, &gorm.Config{DryRun: true, Logger: capture})
	if err != nil {
		t.Fatalf("gorm.Open failed: %v", err)
	}

	repo := &leiRepository{db: db}
	_, err = repo.FindAllLEIWithFilters(10, 0, "", "", "", "", "", "", "lei,legal_name", true)
	if err != nil {
		t.Fatalf("FindAllLEIWithFilters returned error: %v", err)
	}

	sql := strings.ToLower(capture.last())
	if !strings.Contains(sql, "managing_lou") {
		t.Fatalf("expected SQL select to include managing_lou when includeLinkedNames=true, got: %s", sql)
	}
	if !strings.Contains(sql, "successor_lei") {
		t.Fatalf("expected SQL select to include successor_lei when includeLinkedNames=true, got: %s", sql)
	}
}

func TestApplyLinkedLEINames_PopulatesLinkedLegalNameFields(t *testing.T) {
	t.Helper()

	records := []*domain.LEIRecord{
		{ManagingLOU: " 529900AAA00000000001 ", SuccessorLEI: "529900BBB00000000002"},
	}

	namesByCode := map[string]string{
		"529900AAA00000000001": "Managing LOU Name",
		"529900BBB00000000002": "Successor LEI Name",
	}

	applyLinkedLEINames(records, namesByCode)

	if records[0].ManagingLOULegalName != "Managing LOU Name" {
		t.Fatalf("expected ManagingLOULegalName to be populated, got %q", records[0].ManagingLOULegalName)
	}
	if records[0].SuccessorLEILegalName != "Successor LEI Name" {
		t.Fatalf("expected SuccessorLEILegalName to be populated, got %q", records[0].SuccessorLEILegalName)
	}
}

func TestHydrateRADetails_UsesSingleInQueryForDistinctCodes(t *testing.T) {
	t.Helper()

	capture := &sqlCaptureLogger{}
	db, err := gorm.Open(nopDialector{}, &gorm.Config{DryRun: true, Logger: capture})
	if err != nil {
		t.Fatalf("gorm.Open failed: %v", err)
	}

	repo := &leiRepository{db: db}
	records := []*domain.LEIRecord{
		{RegistrationAuthority: "RA000585"},
		{RegistrationAuthority: " RA000602 "},
		{RegistrationAuthority: "RA000585"},
		{RegistrationAuthority: ""},
	}

	if err := repo.hydrateRADetails(records); err != nil {
		t.Fatalf("hydrateRADetails returned error: %v", err)
	}

	sql := strings.ToLower(capture.last())
	if !strings.Contains(sql, "gleif_registration_authorities") {
		t.Fatalf("expected RA query against gleif_registration_authorities, got: %s", sql)
	}
	if !strings.Contains(sql, "ra_id in (?,?)") {
		t.Fatalf("expected deduplicated IN query with 2 args, got: %s", sql)
	}
	if !strings.Contains(sql, "active = true") {
		t.Fatalf("expected active filter in RA query, got: %s", sql)
	}
}

func TestApplyRADetails_PopulatesHydratedFields(t *testing.T) {
	t.Helper()

	records := []*domain.LEIRecord{{RegistrationAuthority: "RA000585"}, {RegistrationAuthority: "RA000602"}}
	rows := []raDetailRow{
		{
			RAID:              "RA000585",
			OrganizationName:  "Companies House",
			InternationalName: "Companies House",
			Website:           "https://find-and-update.company-information.service.gov.uk",
			Comments:          "Verified",
		},
	}

	applyRADetails(records, rows)

	if records[0].RegistrationAuthorityName != "Companies House" {
		t.Fatalf("expected RegistrationAuthorityName to be populated, got %q", records[0].RegistrationAuthorityName)
	}
	if records[0].RegistrationAuthorityWebsite != "https://find-and-update.company-information.service.gov.uk" {
		t.Fatalf("expected RegistrationAuthorityWebsite to be populated, got %q", records[0].RegistrationAuthorityWebsite)
	}
	if records[1].RegistrationAuthorityName != "" {
		t.Fatalf("expected unmatched RA code to remain empty, got %q", records[1].RegistrationAuthorityName)
	}
}

func TestHydrateELFNames_UsesSingleInQueryForDistinctCodes(t *testing.T) {
	t.Helper()

	capture := &sqlCaptureLogger{}
	db, err := gorm.Open(nopDialector{}, &gorm.Config{DryRun: true, Logger: capture})
	if err != nil {
		t.Fatalf("gorm.Open failed: %v", err)
	}

	repo := &leiRepository{db: db}
	records := []*domain.LEIRecord{
		{EntityLegalForm: "ABCD"},
		{EntityLegalForm: " EFGH "},
		{EntityLegalForm: "ABCD"},
		{EntityLegalForm: ""},
	}

	if err := repo.hydrateELFNames(records); err != nil {
		t.Fatalf("hydrateELFNames returned error: %v", err)
	}

	sql := strings.ToLower(capture.last())
	if !strings.Contains(sql, "gleif_entity_legal_forms") {
		t.Fatalf("expected ELF query against gleif_entity_legal_forms, got: %s", sql)
	}
	if !strings.Contains(sql, "elf_code in (?,?)") {
		t.Fatalf("expected deduplicated IN query with 2 args, got: %s", sql)
	}
}

func TestApplyELFNames_PopulatesHydratedFields(t *testing.T) {
	t.Helper()

	records := []*domain.LEIRecord{{EntityLegalForm: "ABCD"}, {EntityLegalForm: "WXYZ"}}
	rows := []elfNameRow{{ELFCode: "ABCD", EntityLegalFormName: "Limited Company"}}

	applyELFNames(records, rows)

	if records[0].EntityLegalFormName != "Limited Company" {
		t.Fatalf("expected EntityLegalFormName to be populated, got %q", records[0].EntityLegalFormName)
	}
	if records[1].EntityLegalFormName != "" {
		t.Fatalf("expected unmatched ELF code to remain empty, got %q", records[1].EntityLegalFormName)
	}
}

// TestLeiValidSortFields_AllowsExpectedColumns verifies that every non-virtual column exposed
// by the LEI records page UI is accepted by the sort allowlist (#268).
func TestLeiValidSortFields_AllowsExpectedColumns(t *testing.T) {
	expected := []string{
		// Identity
		"lei", "legal_name", "transliterated_legal_name",
		// Entity classification
		"entity_status", "entity_category", "entity_sub_category", "entity_legal_form",
		// Legal address
		"legal_address_line_1", "legal_address_line_2", "legal_address_line_3", "legal_address_line_4",
		"legal_address_city", "legal_address_region", "legal_address_country", "legal_address_postal_code",
		// HQ address
		"hq_address_line_1", "hq_address_line_2", "hq_address_line_3", "hq_address_line_4",
		"hq_address_city", "hq_address_region", "hq_address_country", "hq_address_postal_code",
		// Registration
		"registration_authority", "registration_number", "initial_registration_date", "next_renewal_date",
		// Relationships
		"managing_lou", "successor_lei", "validation_authority",
		// Timestamps
		"last_update_date", "updated_at",
	}

	for _, col := range expected {
		if !leiValidSortFields[col] {
			t.Errorf("expected column %q to be in leiValidSortFields but it was not", col)
		}
	}
}

// TestLeiValidSortFields_RejectsVirtualAndInjectionAttempts verifies that virtual columns and
// SQL-injection strings are rejected by the sort allowlist (#268).
func TestLeiValidSortFields_RejectsVirtualAndInjectionAttempts(t *testing.T) {
	rejected := []string{
		"country_flag",                          // virtual/UI-only column
		"registration_authority_name",           // computed JOIN column (gorm:"->;")
		"1; DROP TABLE lei_raw.lei_records; --", // SQL injection attempt
		"",                                      // empty string
		"unknown_column",
	}

	for _, col := range rejected {
		if leiValidSortFields[col] {
			t.Errorf("expected column %q to be rejected by leiValidSortFields but it was accepted", col)
		}
	}
}
