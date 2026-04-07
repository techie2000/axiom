package testutil

import (
	"fmt"
	"math/rand"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/techie2000/axiom/internal/domain"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

const TestDatabaseURLEnv = "AXIOM_TEST_DATABASE_URL"

// OpenMasterDataPostgresDB opens an isolated Postgres schema for integration tests.
// Tests are skipped when AXIOM_TEST_DATABASE_URL is not configured.
func OpenMasterDataPostgresDB(t *testing.T) *gorm.DB {
	t.Helper()

	baseDSN := strings.TrimSpace(os.Getenv(TestDatabaseURLEnv))
	if baseDSN == "" {
		t.Skipf("integration test skipped: %s is not set", TestDatabaseURLEnv)
	}

	adminDB, err := gorm.Open(postgres.Open(baseDSN), &gorm.Config{})
	if err != nil {
		t.Fatalf("open admin postgres connection: %v", err)
	}

	schemaName := randomSchemaName()

	if err := adminDB.Exec("CREATE EXTENSION IF NOT EXISTS pgcrypto").Error; err != nil {
		t.Fatalf("ensure pgcrypto extension: %v", err)
	}
	if err := adminDB.Exec(fmt.Sprintf("CREATE SCHEMA IF NOT EXISTS \"%s\"", schemaName)).Error; err != nil {
		t.Fatalf("create isolated schema: %v", err)
	}

	isolatedDSN, err := withSearchPath(baseDSN, schemaName)
	if err != nil {
		t.Fatalf("build isolated dsn: %v", err)
	}

	testDB, err := gorm.Open(postgres.Open(isolatedDSN), &gorm.Config{})
	if err != nil {
		t.Fatalf("open isolated postgres connection: %v", err)
	}

	if err := migrateMasterDataTables(testDB); err != nil {
		t.Fatalf("migrate master data tables: %v", err)
	}

	t.Cleanup(func() {
		_ = adminDB.Exec(fmt.Sprintf("DROP SCHEMA IF EXISTS \"%s\" CASCADE", schemaName)).Error
	})

	return testDB
}

func migrateMasterDataTables(db *gorm.DB) error {
	return db.AutoMigrate(
		&domain.Continent{},
		&domain.Language{},
		&domain.Currency{},
		&domain.Country{},
		&domain.CodeMapping{},
		&domain.ContinentAudit{},
		&domain.LanguageAudit{},
		&domain.CurrencyAudit{},
		&domain.CountryAudit{},
		&domain.CodeMappingAudit{},
	)
}

func randomSchemaName() string {
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	return fmt.Sprintf("it_%d_%d", time.Now().UnixNano(), rng.Intn(100000))
}

func withSearchPath(dsn, searchPath string) (string, error) {
	parsed, err := url.Parse(dsn)
	if err != nil {
		return "", fmt.Errorf("parse dsn: %w", err)
	}

	query := parsed.Query()
	query.Set("search_path", searchPath)
	parsed.RawQuery = query.Encode()
	return parsed.String(), nil
}
