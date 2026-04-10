package service

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/testutil"
)

func TestLoadContinents_NoDeleteAuditWhenDeleteFails(t *testing.T) {
	db := testutil.OpenMasterDataPostgresDB(t)
	dataDir := t.TempDir()
	writeJSONFile(t, dataDir, "continents.json", `{"AF":"Africa"}`)

	if err := db.Create(&domain.Continent{Code: "ZZ", Name: "To Delete"}).Error; err != nil {
		t.Fatalf("seed stale continent: %v", err)
	}

	if err := db.Exec(`
		CREATE OR REPLACE FUNCTION block_delete_zz_continent()
		RETURNS trigger AS $$
		BEGIN
			IF OLD.code = 'ZZ' THEN
				RAISE EXCEPTION 'intentional delete failure for integration test';
			END IF;
			RETURN OLD;
		END;
		$$ LANGUAGE plpgsql;
	`).Error; err != nil {
		t.Fatalf("create delete-failure trigger function: %v", err)
	}

	if err := db.Exec(`
		CREATE TRIGGER continents_block_delete_zz
		BEFORE DELETE ON continents
		FOR EACH ROW EXECUTE FUNCTION block_delete_zz_continent();
	`).Error; err != nil {
		t.Fatalf("create delete-failure trigger: %v", err)
	}

	svc := NewMasterDataService(db, dataDir)
	if err := svc.LoadContinents(); err != nil {
		t.Fatalf("LoadContinents failed: %v", err)
	}

	var stale domain.Continent
	if err := db.Where("code = ?", "ZZ").First(&stale).Error; err != nil {
		t.Fatalf("expected stale continent to remain after forced delete failure: %v", err)
	}

	var deleteAuditCount int64
	if err := db.Model(&domain.ContinentAudit{}).Where("continent_code = ? AND action = ?", "ZZ", "DELETE").Count(&deleteAuditCount).Error; err != nil {
		t.Fatalf("count continent delete audits: %v", err)
	}
	if deleteAuditCount != 0 {
		t.Fatalf("expected no DELETE audit for continent ZZ when delete fails, got %d", deleteAuditCount)
	}
}

func TestLoadCurrencies_NoDeleteAuditWhenDeactivateFails(t *testing.T) {
	db := testutil.OpenMasterDataPostgresDB(t)
	dataDir := t.TempDir()
	writeJSONFile(t, dataDir, "currencies.json", `{"USD":{"code":"USD","name":"US Dollar","symbol":"$","symbol_native":"$","decimal_digits":2,"rounding":0,"name_plural":"US dollars","is_alert_cls_allowed":true,"is_ofac_sanctioned":false}}`)

	if err := db.Create(&domain.Currency{Code: "ZZZ", Name: "To Deactivate", Active: true}).Error; err != nil {
		t.Fatalf("seed stale currency: %v", err)
	}

	if err := db.Exec(`
		CREATE OR REPLACE FUNCTION block_deactivate_zzz_currency()
		RETURNS trigger AS $$
		BEGIN
			IF NEW.code = 'ZZZ' AND NEW.active = false THEN
				RAISE EXCEPTION 'intentional update failure for integration test';
			END IF;
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql;
	`).Error; err != nil {
		t.Fatalf("create update-failure trigger function: %v", err)
	}

	if err := db.Exec(`
		CREATE TRIGGER currencies_block_deactivate_zzz
		BEFORE UPDATE ON currencies
		FOR EACH ROW EXECUTE FUNCTION block_deactivate_zzz_currency();
	`).Error; err != nil {
		t.Fatalf("create update-failure trigger: %v", err)
	}

	svc := NewMasterDataService(db, dataDir)
	if err := svc.LoadCurrencies(); err != nil {
		t.Fatalf("LoadCurrencies failed: %v", err)
	}

	var stale domain.Currency
	if err := db.Where("code = ?", "ZZZ").First(&stale).Error; err != nil {
		t.Fatalf("load stale currency after sync: %v", err)
	}
	if !stale.Active {
		t.Fatal("expected stale currency ZZZ to remain active after forced update failure")
	}

	var deleteAuditCount int64
	if err := db.Model(&domain.CurrencyAudit{}).Where("code = ? AND action = ?", "ZZZ", "DELETE").Count(&deleteAuditCount).Error; err != nil {
		t.Fatalf("count currency delete audits: %v", err)
	}
	if deleteAuditCount != 0 {
		t.Fatalf("expected no DELETE audit for currency ZZZ when deactivate fails, got %d", deleteAuditCount)
	}
}

func TestLoadCountries_NoDeleteAuditWhenDeactivateFails(t *testing.T) {
	db := testutil.OpenMasterDataPostgresDB(t)
	dataDir := t.TempDir()
	writeJSONFile(t, dataDir, "countries.json", `[{"code":"US","alpha3_code":"USA","name":"United States","native_name":"United States","phone_codes":[1],"continent":"NA","capital":"Washington","currency_codes":["USD"],"languages":["en"],"region":"North America"}]`)

	if err := db.Create(&domain.Country{Code: "ZZ", Name: "To Deactivate", Active: true}).Error; err != nil {
		t.Fatalf("seed stale country: %v", err)
	}

	if err := db.Exec(`
		CREATE OR REPLACE FUNCTION block_deactivate_zz_country()
		RETURNS trigger AS $$
		BEGIN
			IF NEW.code = 'ZZ' AND NEW.active = false THEN
				RAISE EXCEPTION 'intentional update failure for integration test';
			END IF;
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql;
	`).Error; err != nil {
		t.Fatalf("create update-failure trigger function: %v", err)
	}

	if err := db.Exec(`
		CREATE TRIGGER countries_block_deactivate_zz
		BEFORE UPDATE ON countries
		FOR EACH ROW EXECUTE FUNCTION block_deactivate_zz_country();
	`).Error; err != nil {
		t.Fatalf("create update-failure trigger: %v", err)
	}

	svc := NewMasterDataService(db, dataDir)
	if err := svc.LoadCountries(); err != nil {
		t.Fatalf("LoadCountries failed: %v", err)
	}

	var stale domain.Country
	if err := db.Where("code = ?", "ZZ").First(&stale).Error; err != nil {
		t.Fatalf("load stale country after sync: %v", err)
	}
	if !stale.Active {
		t.Fatal("expected stale country ZZ to remain active after forced update failure")
	}

	var deleteAuditCount int64
	if err := db.Model(&domain.CountryAudit{}).Where("code = ? AND action = ?", "ZZ", "DELETE").Count(&deleteAuditCount).Error; err != nil {
		t.Fatalf("count country delete audits: %v", err)
	}
	if deleteAuditCount != 0 {
		t.Fatalf("expected no DELETE audit for country ZZ when deactivate fails, got %d", deleteAuditCount)
	}
}

func writeJSONFile(t *testing.T, dir, name, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o644); err != nil {
		t.Fatalf("write %s: %v", name, err)
	}
}
