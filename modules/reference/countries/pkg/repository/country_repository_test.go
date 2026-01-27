package repository

import (
	"context"
	"database/sql"
	"testing"
	"time"

	_ "github.com/lib/pq"
	"github.com/techie2000/axiom/modules/reference/countries/internal/model"
)

// TestCountryRepository_Create tests the Create operation
func TestCountryRepository_Create(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	db := setupTestDB(t)
	defer teardownTestDB(t, db)

	repo := NewCountryRepository(db)
	ctx := context.Background()

	country := &model.Country{
		Alpha2:      "US",
		Alpha3:      "USA",
		Numeric:     "840",
		NameEnglish: "United States of America",
		NameFrench:  "États-Unis d'Amérique",
		Status:      model.StatusOfficiallyAssigned,
	}

	err := repo.Create(ctx, country)
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	// Verify it was created
	retrieved, err := repo.GetByAlpha2(ctx, "US")
	if err != nil {
		t.Fatalf("GetByAlpha2() error = %v", err)
	}

	if retrieved.Alpha2 != country.Alpha2 {
		t.Errorf("Alpha2 = %v, want %v", retrieved.Alpha2, country.Alpha2)
	}
	if retrieved.Alpha3 != country.Alpha3 {
		t.Errorf("Alpha3 = %v, want %v", retrieved.Alpha3, country.Alpha3)
	}
	if retrieved.Numeric != country.Numeric {
		t.Errorf("Numeric = %v, want %v", retrieved.Numeric, country.Numeric)
	}
}

// TestCountryRepository_Upsert tests the Upsert operation
func TestCountryRepository_Upsert(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	db := setupTestDB(t)
	defer teardownTestDB(t, db)

	repo := NewCountryRepository(db)
	ctx := context.Background()

	country := &model.Country{
		Alpha2:      "FR",
		Alpha3:      "FRA",
		Numeric:     "250",
		NameEnglish: "France",
		NameFrench:  "France",
		Status:      model.StatusOfficiallyAssigned,
	}

	// First upsert (insert)
	err := repo.Upsert(ctx, country)
	if err != nil {
		t.Fatalf("Upsert() error = %v", err)
	}

	// Second upsert (update)
	country.NameEnglish = "French Republic"
	err = repo.Upsert(ctx, country)
	if err != nil {
		t.Fatalf("Upsert() error on update = %v", err)
	}

	// Verify update
	retrieved, err := repo.GetByAlpha2(ctx, "FR")
	if err != nil {
		t.Fatalf("GetByAlpha2() error = %v", err)
	}

	if retrieved.NameEnglish != "French Republic" {
		t.Errorf("NameEnglish = %v, want %v", retrieved.NameEnglish, "French Republic")
	}
}

// TestCountryRepository_ListActive tests the ListActive operation
func TestCountryRepository_ListActive(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	db := setupTestDB(t)
	defer teardownTestDB(t, db)

	repo := NewCountryRepository(db)
	ctx := context.Background()

	// Insert active country
	active := &model.Country{
		Alpha2:      "DE",
		Alpha3:      "DEU",
		Numeric:     "276",
		NameEnglish: "Germany",
		NameFrench:  "Allemagne",
		Status:      model.StatusOfficiallyAssigned,
	}
	repo.Create(ctx, active)

	// Insert inactive country
	endDate := time.Now().Add(-24 * time.Hour)
	inactive := &model.Country{
		Alpha2:      "DD",
		Alpha3:      "DDR",
		Numeric:     "278",
		NameEnglish: "East Germany",
		NameFrench:  "Allemagne de l'Est",
		Status:      model.StatusFormerlyUsed,
		EndDate:     &endDate,
	}
	repo.Create(ctx, inactive)

	// List active countries
	countries, err := repo.ListActive(ctx)
	if err != nil {
		t.Fatalf("ListActive() error = %v", err)
	}

	// Should only return the active country
	if len(countries) != 1 {
		t.Errorf("ListActive() returned %d countries, want 1", len(countries))
	}

	if len(countries) > 0 && countries[0].Alpha2 != "DE" {
		t.Errorf("ListActive() returned %v, want DE", countries[0].Alpha2)
	}
}

// TestDatabaseConstraints tests that database constraints are enforced
func TestDatabaseConstraints(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	db := setupTestDB(t)
	defer teardownTestDB(t, db)

	repo := NewCountryRepository(db)
	ctx := context.Background()

	tests := []struct {
		name    string
		country *model.Country
		wantErr bool
	}{
		{
			name: "invalid numeric format - not padded",
			country: &model.Country{
				Alpha2:      "TS",
				Alpha3:      "TST",
				Numeric:     "1", // Should be "001"
				NameEnglish: "Test",
				NameFrench:  "Test",
				Status:      model.StatusOfficiallyAssigned,
			},
			wantErr: true,
		},
		{
			name: "invalid numeric format - letters",
			country: &model.Country{
				Alpha2:      "TS",
				Alpha3:      "TST",
				Numeric:     "abc",
				NameEnglish: "Test",
				NameFrench:  "Test",
				Status:      model.StatusOfficiallyAssigned,
			},
			wantErr: true,
		},
		{
			name: "invalid alpha2 - lowercase",
			country: &model.Country{
				Alpha2:      "ts", // Should be uppercase
				Alpha3:      "TST",
				Numeric:     "999",
				NameEnglish: "Test",
				NameFrench:  "Test",
				Status:      model.StatusOfficiallyAssigned,
			},
			wantErr: true,
		},
		{
			name: "valid country",
			country: &model.Country{
				Alpha2:      "GB",
				Alpha3:      "GBR",
				Numeric:     "826",
				NameEnglish: "United Kingdom",
				NameFrench:  "Royaume-Uni",
				Status:      model.StatusOfficiallyAssigned,
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := repo.Create(ctx, tt.country)
			if (err != nil) != tt.wantErr {
				t.Errorf("Create() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

// setupTestDB creates a test database connection
// NOTE: This requires a running PostgreSQL instance
// You can skip these tests with: go test -short
func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()

	// Use environment variables or test database
	connStr := "postgres://postgres:postgres@localhost:5432/axiom_test?sslmode=disable"

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		t.Fatalf("Failed to connect to test database: %v", err)
	}

	// Create schema and table
	setupSQL := `
		CREATE SCHEMA IF NOT EXISTS reference;
		
		DO $$ BEGIN
			CREATE TYPE reference.country_code_status AS ENUM (
				'officially_assigned',
				'exceptionally_reserved',
				'transitionally_reserved',
				'indeterminately_reserved',
				'formerly_used',
				'unassigned'
			);
		EXCEPTION
			WHEN duplicate_object THEN null;
		END $$;

		CREATE TABLE IF NOT EXISTS reference.countries (
			alpha2 CHAR(2) PRIMARY KEY,
			alpha3 CHAR(3) NOT NULL UNIQUE,
			numeric CHAR(3) NOT NULL UNIQUE,
			name_english VARCHAR(255) NOT NULL,
			name_french VARCHAR(255) NOT NULL,
			status reference.country_code_status NOT NULL,
			start_date DATE,
			end_date DATE,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT alpha2_uppercase CHECK (alpha2 = UPPER(alpha2)),
			CONSTRAINT alpha3_uppercase CHECK (alpha3 = UPPER(alpha3)),
			CONSTRAINT numeric_format CHECK (numeric ~ '^[0-9]{3}$'),
			CONSTRAINT valid_date_range CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
		);

		CREATE INDEX IF NOT EXISTS idx_countries_alpha3 ON reference.countries(alpha3);
		CREATE INDEX IF NOT EXISTS idx_countries_numeric ON reference.countries(numeric);
		CREATE INDEX IF NOT EXISTS idx_countries_status ON reference.countries(status);
		CREATE INDEX IF NOT EXISTS idx_countries_name_english ON reference.countries(name_english);
		CREATE INDEX IF NOT EXISTS idx_countries_active ON reference.countries(status, end_date) 
			WHERE status = 'officially_assigned' AND end_date IS NULL;
	`

	_, err = db.Exec(setupSQL)
	if err != nil {
		t.Fatalf("Failed to setup test database: %v", err)
	}

	return db
}

// teardownTestDB cleans up the test database
func teardownTestDB(t *testing.T, db *sql.DB) {
	t.Helper()

	// Clean up test data
	_, err := db.Exec("TRUNCATE reference.countries CASCADE")
	if err != nil {
		t.Logf("Warning: Failed to truncate test table: %v", err)
	}

	db.Close()
}
