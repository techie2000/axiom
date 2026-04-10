package service

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeMasterDataFixtureFiles(t *testing.T, dir string, suffix string) {
	t.Helper()

	files := map[string]string{
		"continents.json":          "{\"AF\":\"Africa\"}" + suffix,
		"languages.json":           "{\"en\":{\"code\":\"en\",\"name\":\"English\",\"native\":\"English\"}}" + suffix,
		"currencies.json":          "{\"USD\":{\"code\":\"USD\",\"name\":\"US Dollar\",\"symbol\":\"$\",\"symbol_native\":\"$\",\"decimal_digits\":2,\"rounding\":0,\"name_plural\":\"US dollars\",\"is_alert_cls_allowed\":true,\"is_ofac_sanctioned\":false}}" + suffix,
		"countries.json":           "[{\"code\":\"US\",\"alpha3_code\":\"USA\",\"name\":\"United States\",\"native_name\":\"United States\",\"phone_codes\":[1],\"continent\":\"NA\",\"capital\":\"Washington\",\"currency_codes\":[\"USD\"],\"languages\":[\"en\"],\"region\":\"North America\"}]" + suffix,
		"alert_country_codes.json": "[{\"from_system\":\"ALERT\",\"to_system\":\"ISO\",\"from_code_type\":\"ALERT_DIRECT_COUNTRY_CODE\",\"to_code_type\":\"ISO_3166_ALPHA2\",\"from_code\":\"US\",\"to_code\":\"US\",\"description\":\"United States\"}]" + suffix,
	}

	for fileName, content := range files {
		if err := os.WriteFile(filepath.Join(dir, fileName), []byte(content), 0o644); err != nil {
			t.Fatalf("failed writing fixture %s: %v", fileName, err)
		}
	}
}

func TestComputeDataFingerprint_StableForIdenticalContent(t *testing.T) {
	tmpDir := t.TempDir()
	writeMasterDataFixtureFiles(t, tmpDir, "")

	svc := &masterDataService{dataDir: tmpDir}
	fingerprintOne, err := svc.computeDataFingerprint()
	if err != nil {
		t.Fatalf("computeDataFingerprint failed: %v", err)
	}

	fingerprintTwo, err := svc.computeDataFingerprint()
	if err != nil {
		t.Fatalf("computeDataFingerprint second call failed: %v", err)
	}

	if fingerprintOne != fingerprintTwo {
		t.Fatalf("expected stable fingerprint, got %s then %s", fingerprintOne, fingerprintTwo)
	}
}

func TestCheckForUpdates_DetectsChanges(t *testing.T) {
	tmpDir := t.TempDir()
	writeMasterDataFixtureFiles(t, tmpDir, "")

	svc := &masterDataService{dataDir: tmpDir}

	updated, err := svc.CheckForUpdates()
	if err != nil {
		t.Fatalf("initial CheckForUpdates failed: %v", err)
	}
	if updated {
		t.Fatal("expected no update on first fingerprint initialization")
	}

	updated, err = svc.CheckForUpdates()
	if err != nil {
		t.Fatalf("second CheckForUpdates failed: %v", err)
	}
	if updated {
		t.Fatal("expected no update when content is unchanged")
	}

	if err := os.WriteFile(filepath.Join(tmpDir, "countries.json"), []byte(`[{"code":"CA"}]`), 0o644); err != nil {
		t.Fatalf("failed to modify countries.json: %v", err)
	}

	updated, err = svc.CheckForUpdates()
	if err != nil {
		t.Fatalf("third CheckForUpdates failed: %v", err)
	}
	if !updated {
		t.Fatal("expected update detection after file content changes")
	}
}

func TestCheckForUpdates_MissingFileReturnsError(t *testing.T) {
	tmpDir := t.TempDir()
	writeMasterDataFixtureFiles(t, tmpDir, "")

	svc := &masterDataService{dataDir: tmpDir}

	updated, err := svc.CheckForUpdates()
	if err != nil {
		t.Fatalf("initial CheckForUpdates failed: %v", err)
	}
	if updated {
		t.Fatal("expected no update on first fingerprint initialization")
	}

	if err := os.Remove(filepath.Join(tmpDir, "currencies.json")); err != nil {
		t.Fatalf("failed to remove currencies.json: %v", err)
	}

	_, err = svc.CheckForUpdates()
	if err == nil {
		t.Fatal("expected error when a required masterdata file is missing")
	}
	if !strings.Contains(err.Error(), "failed to read currencies.json") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestResolveLanguageCode_UsesJSONCodeWhenPresent(t *testing.T) {
	code := resolveLanguageCode("en", languageEntry{Code: " fr "})

	if code != "fr" {
		t.Fatalf("code = %q, want %q", code, "fr")
	}
}

func TestResolveLanguageCode_FallsBackToMapKey(t *testing.T) {
	code := resolveLanguageCode(" es ", languageEntry{Code: ""})

	if code != "es" {
		t.Fatalf("code = %q, want %q", code, "es")
	}
}

func TestResolveLanguageCode_ReturnsEmptyWhenNoCodeAvailable(t *testing.T) {
	code := resolveLanguageCode("   ", languageEntry{Code: ""})

	if code != "" {
		t.Fatalf("code = %q, want empty string", code)
	}
}

func TestNormalizeContinentEntry_Valid(t *testing.T) {
	code, name, ok := normalizeContinentEntry(" EU ", " Europe ")
	if !ok {
		t.Fatal("expected continent entry to be valid")
	}
	if code != "EU" || name != "Europe" {
		t.Fatalf("got (%q, %q), want (%q, %q)", code, name, "EU", "Europe")
	}
}

func TestNormalizeContinentEntry_InvalidWhenEmpty(t *testing.T) {
	_, _, ok := normalizeContinentEntry(" ", "Europe")
	if ok {
		t.Fatal("expected continent entry with empty code to be invalid")
	}
}

func TestNormalizeCodeMappingEntry_Valid(t *testing.T) {
	m, ok := normalizeCodeMappingEntry(CodeMappingData{
		FromSystem:   " ALERT ",
		ToSystem:     " ISO ",
		FromCodeType: " ALERT_DIRECT_COUNTRY_CODE ",
		ToCodeType:   " ISO_3166_ALPHA2 ",
		FromCode:     " US ",
		ToCode:       " US ",
		Description:  " United States ",
	})
	if !ok {
		t.Fatal("expected code mapping entry to be valid")
	}
	if m.FromSystem != "ALERT" || m.ToSystem != "ISO" || m.FromCode != "US" || m.Description != "United States" {
		t.Fatalf("unexpected normalized mapping: %+v", m)
	}
}

func TestNormalizeCodeMappingEntry_InvalidWhenRequiredFieldMissing(t *testing.T) {
	_, ok := normalizeCodeMappingEntry(CodeMappingData{
		FromSystem:   "ALERT",
		ToSystem:     "ISO",
		FromCodeType: "ALERT_DIRECT_COUNTRY_CODE",
		ToCodeType:   "ISO_3166_ALPHA2",
		FromCode:     "",
		ToCode:       "US",
	})
	if ok {
		t.Fatal("expected code mapping with empty from_code to be invalid")
	}
}

func TestAddChange_OnlyAddsWhenDifferent(t *testing.T) {
	changes := make(map[string]map[string]interface{})
	addChange(changes, "name", "alpha", "alpha")
	if len(changes) != 0 {
		t.Fatalf("expected no changes when values match, got %d", len(changes))
	}

	addChange(changes, "name", "alpha", "beta")
	if len(changes) != 1 {
		t.Fatalf("expected one change, got %d", len(changes))
	}
}

func TestToChangedFieldsJSON_EmptyReturnsObject(t *testing.T) {
	if got := toChangedFieldsJSON(map[string]map[string]interface{}{}); got != "{}" {
		t.Fatalf("empty changed fields = %q, want {}", got)
	}
}

func TestToChangedFieldsJSON_SerializesChanges(t *testing.T) {
	changes := map[string]map[string]interface{}{
		"name": {"old": "alpha", "new": "beta"},
	}
	raw := toChangedFieldsJSON(changes)

	var parsed map[string]map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		t.Fatalf("changed fields should be valid JSON: %v", err)
	}

	if parsed["name"]["old"] != "alpha" || parsed["name"]["new"] != "beta" {
		t.Fatalf("unexpected parsed changed fields: %+v", parsed)
	}
}

func TestCodeMappingKey_CreatesStableCompositeKey(t *testing.T) {
	key := codeMappingKey("ALERT", "ISO", "ALERT_DIRECT_COUNTRY_CODE", "ISO_3166_ALPHA2", "US")
	want := "ALERT|ISO|ALERT_DIRECT_COUNTRY_CODE|ISO_3166_ALPHA2|US"

	if key != want {
		t.Fatalf("code mapping key = %q, want %q", key, want)
	}
}
