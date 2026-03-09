package service

import (
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
