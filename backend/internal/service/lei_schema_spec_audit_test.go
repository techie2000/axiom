package service

import (
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"runtime"
	"strings"
	"testing"

	"github.com/techie2000/axiom/internal/domain"
)

func repoRootFromTestFile(t *testing.T) string {
	t.Helper()
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("failed to resolve test file path")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(filename), "..", ".."))
}

func readRepoFile(t *testing.T, root string, relParts ...string) string {
	t.Helper()
	path := filepath.Join(append([]string{root}, relParts...)...)
	bytes, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read %s: %v", path, err)
	}
	return string(bytes)
}

func TestLEIFieldReferenceDocumentsPersistedLevel1Fields(t *testing.T) {
	root := repoRootFromTestFile(t)
	content := readRepoFile(t, root, "..", "docs", "lei", "gleif-specs", "LEI-CDF-v3-1-field-reference.md")

	for _, snippet := range []string{
		"EntitySubCategory",
		"LegalJurisdiction",
		"RegistrationStatus",
		"`lei_records.entity_sub_category`",
		"`lei_records.legal_jurisdiction`",
		"`lei_records.registration_status`",
	} {
		if !strings.Contains(content, snippet) {
			t.Fatalf("expected LEI field reference to contain %q", snippet)
		}
	}
}

func TestLEIRecordIncludesSpecAlignedLevel1Fields(t *testing.T) {
	typeOf := reflect.TypeOf(domain.LEIRecord{})
	for _, field := range []string{"EntitySubCategory", "LegalJurisdiction", "RegistrationStatus"} {
		if _, ok := typeOf.FieldByName(field); !ok {
			t.Fatalf("expected domain.LEIRecord to contain field %s", field)
		}
	}
}

func TestREPEXModelPreservesRepeatableReasons(t *testing.T) {
	if field, ok := reflect.TypeOf(domain.LEIReportingException{}).FieldByName("ExceptionReasons"); !ok {
		t.Fatal("expected domain.LEIReportingException to contain ExceptionReasons")
	} else if field.Type != reflect.TypeOf(domain.JSONBString("")) {
		t.Fatalf("expected ExceptionReasons to use domain.JSONBString, got %s", field.Type)
	}

	field, ok := reflect.TypeOf(rawREPEXRecord{}).FieldByName("ExceptionReason")
	if !ok {
		t.Fatal("expected rawREPEXRecord to contain ExceptionReason")
	}
	if field.Type != reflect.TypeOf(gleifStringList{}) {
		t.Fatalf("expected rawREPEXRecord.ExceptionReason to be gleifStringList, got %s", field.Type)
	}
}

func TestREPEXMigrationsAvoidFragileReasonCheckConstraints(t *testing.T) {
	root := repoRootFromTestFile(t)
	migrationsDir := filepath.Join(root, "migrations")
	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		t.Fatalf("failed to read migrations dir: %v", err)
	}

	forbidden := regexp.MustCompile(`(?is)check\s*\([^;]*(exception_reason|exception_reasons)|(exception_reason|exception_reasons)[^;]*check`)
	foundJSONBMigration := false

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		content := readRepoFile(t, root, "migrations", entry.Name())
		if forbidden.MatchString(content) {
			t.Fatalf("migration %s introduces a CHECK constraint on REPEX reasons; use JSONB array semantics instead", entry.Name())
		}
		if strings.Contains(entry.Name(), "000055_add_repex_exception_reasons_jsonb.up.sql") &&
			strings.Contains(content, "exception_reasons JSONB") {
			foundJSONBMigration = true
		}
	}

	if !foundJSONBMigration {
		t.Fatal("expected additive REPEX exception_reasons JSONB migration to exist")
	}
}
