package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/techie2000/axiom/modules/reference/countries/internal/model"
)

// CountryRepository handles database operations for countries
type CountryRepository struct {
	db *sql.DB
}

// NewCountryRepository creates a new repository instance
func NewCountryRepository(db *sql.DB) *CountryRepository {
	return &CountryRepository{db: db}
}

// SetAuditContext sets PostgreSQL session variables for audit trail tracking
func (r *CountryRepository) SetAuditContext(ctx context.Context, sourceSystem, sourceUser string) (sql.Result, error) {
	// Set source_system for audit trail
	if _, err := r.db.ExecContext(ctx, "SELECT set_config('app.source_system', $1, false)", sourceSystem); err != nil {
		return nil, fmt.Errorf("failed to set source_system: %w", err)
	}

	// Set source_user for audit trail
	result, err := r.db.ExecContext(ctx, "SELECT set_config('app.source_user', $1, false)", sourceUser)
	if err != nil {
		return nil, fmt.Errorf("failed to set source_user: %w", err)
	}

	return result, nil
}

// Create inserts a new country record
func (r *CountryRepository) Create(ctx context.Context, country *model.Country) error {
	query := `
		INSERT INTO reference.countries (
			alpha2, alpha3, numeric, 
			name_english, name_french, status, 
			start_date, end_date, remarks
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING created_at, updated_at
	`

	err := r.db.QueryRowContext(
		ctx, query,
		country.Alpha2,
		nullString(country.Alpha3),
		nullString(country.Numeric),
		nullString(country.NameEnglish),
		nullString(country.NameFrench),
		country.Status,
		country.StartDate,
		country.EndDate,
		nullString(country.Remarks),
	).Scan(&country.CreatedAt, &country.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create country: %w", err)
	}

	return nil
}

// Update modifies an existing country record
func (r *CountryRepository) Update(ctx context.Context, country *model.Country) error {
	query := `
		UPDATE reference.countries
		SET alpha3 = $2, numeric = $3,
		    name_english = $4, name_french = $5, status = $6,
		    start_date = $7, end_date = $8, remarks = $9
		WHERE alpha2 = $1
		RETURNING updated_at
	`

	err := r.db.QueryRowContext(
		ctx, query,
		country.Alpha2,
		nullString(country.Alpha3),
		nullString(country.Numeric),
		nullString(country.NameEnglish),
		nullString(country.NameFrench),
		country.Status,
		country.StartDate,
		country.EndDate,
		nullString(country.Remarks),
	).Scan(&country.UpdatedAt)

	if err == sql.ErrNoRows {
		return fmt.Errorf("country not found: %s", country.Alpha2)
	}
	if err != nil {
		return fmt.Errorf("failed to update country: %w", err)
	}

	return nil
}

// Upsert creates or updates a country record
func (r *CountryRepository) Upsert(ctx context.Context, country *model.Country) error {
	query := `
		INSERT INTO reference.countries (
			alpha2, alpha3, numeric,
			name_english, name_french, status,
			start_date, end_date, remarks
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (alpha2) DO UPDATE SET
			alpha3 = EXCLUDED.alpha3,
			numeric = EXCLUDED.numeric,
			name_english = EXCLUDED.name_english,
			name_french = EXCLUDED.name_french,
			status = EXCLUDED.status,
			start_date = EXCLUDED.start_date,
			end_date = EXCLUDED.end_date,
			remarks = EXCLUDED.remarks
		RETURNING created_at, updated_at
	`

	err := r.db.QueryRowContext(
		ctx, query,
		country.Alpha2,
		nullString(country.Alpha3),
		nullString(country.Numeric),
		nullString(country.NameEnglish),
		nullString(country.NameFrench),
		country.Status,
		country.StartDate,
		country.EndDate,
		nullString(country.Remarks),
	).Scan(&country.CreatedAt, &country.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to upsert country: %w", err)
	}

	return nil
}

// GetByAlpha2 retrieves a country by its alpha-2 code
func (r *CountryRepository) GetByAlpha2(ctx context.Context, alpha2 string) (*model.Country, error) {
	query := `
		SELECT alpha2, alpha3, numeric,
		       name_english, name_french, status,
		       start_date, end_date, remarks,
		       created_at, updated_at
		FROM reference.countries
		WHERE alpha2 = $1
	`

	country := &model.Country{}
	var alpha3, numeric, nameEnglish, nameFrench, remarks sql.NullString
	err := r.db.QueryRowContext(ctx, query, alpha2).Scan(
		&country.Alpha2, &alpha3, &numeric,
		&nameEnglish, &nameFrench, &country.Status,
		&country.StartDate, &country.EndDate, &remarks,
		&country.CreatedAt, &country.UpdatedAt,
	)

	if err == nil {
		country.Alpha3 = alpha3.String
		country.Numeric = numeric.String
		country.NameEnglish = nameEnglish.String
		country.NameFrench = nameFrench.String
		country.Remarks = remarks.String
	}

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("country not found: %s", alpha2)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get country: %w", err)
	}

	return country, nil
}

// GetByAlpha3 retrieves a country by its alpha-3 code
func (r *CountryRepository) GetByAlpha3(ctx context.Context, alpha3 string) (*model.Country, error) {
	query := `
		SELECT alpha2, alpha3, numeric,
		       name_english, name_french, status,
		       start_date, end_date, remarks,
		       created_at, updated_at
		FROM reference.countries
		WHERE alpha3 = $1
	`

	country := &model.Country{}
	var alpha3Var, numeric, nameEnglish, nameFrench, remarks sql.NullString
	err := r.db.QueryRowContext(ctx, query, alpha3).Scan(
		&country.Alpha2, &alpha3Var, &numeric,
		&nameEnglish, &nameFrench, &country.Status,
		&country.StartDate, &country.EndDate, &remarks,
		&country.CreatedAt, &country.UpdatedAt,
	)

	if err == nil {
		country.Alpha3 = alpha3Var.String
		country.Numeric = numeric.String
		country.NameEnglish = nameEnglish.String
		country.NameFrench = nameFrench.String
		country.Remarks = remarks.String
	}

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("country not found: %s", alpha3)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get country: %w", err)
	}

	return country, nil
}

// ListActive retrieves all currently active countries
func (r *CountryRepository) ListActive(ctx context.Context) ([]*model.Country, error) {
	query := `
		SELECT alpha2, alpha3, numeric,
		       name_english, name_french, status,
		       start_date, end_date, remarks,
		       created_at, updated_at
		FROM reference.countries
		WHERE status = 'officially_assigned'
		  AND (start_date IS NULL OR start_date <= $1)
		  AND (end_date IS NULL OR end_date > $1)
		ORDER BY name_english
	`

	rows, err := r.db.QueryContext(ctx, query, time.Now())
	if err != nil {
		return nil, fmt.Errorf("failed to list active countries: %w", err)
	}
	defer rows.Close()

	countries := make([]*model.Country, 0)
	for rows.Next() {
		country := &model.Country{}
		var alpha3, numeric, nameEnglish, nameFrench, remarks sql.NullString
		err := rows.Scan(
			&country.Alpha2, &alpha3, &numeric,
			&nameEnglish, &nameFrench, &country.Status,
			&country.StartDate, &country.EndDate, &remarks,
			&country.CreatedAt, &country.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan country: %w", err)
		}
		country.Alpha3 = alpha3.String
		country.Numeric = numeric.String
		country.NameEnglish = nameEnglish.String
		country.NameFrench = nameFrench.String
		country.Remarks = remarks.String
		countries = append(countries, country)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating countries: %w", err)
	}

	return countries, nil
}

// ListAll retrieves all countries regardless of status
func (r *CountryRepository) ListAll(ctx context.Context) ([]*model.Country, error) {
	query := `
		SELECT alpha2, alpha3, numeric,
		       name_english, name_french, status,
		       start_date, end_date, remarks,
		       created_at, updated_at
		FROM reference.countries
		ORDER BY name_english
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list all countries: %w", err)
	}
	defer rows.Close()

	countries := make([]*model.Country, 0)
	for rows.Next() {
		country := &model.Country{}
		var alpha3, numeric, nameEnglish, nameFrench, remarks sql.NullString
		err := rows.Scan(
			&country.Alpha2, &alpha3, &numeric,
			&nameEnglish, &nameFrench, &country.Status,
			&country.StartDate, &country.EndDate, &remarks,
			&country.CreatedAt, &country.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan country: %w", err)
		}
		country.Alpha3 = alpha3.String
		country.Numeric = numeric.String
		country.NameEnglish = nameEnglish.String
		country.NameFrench = nameFrench.String
		country.Remarks = remarks.String
		countries = append(countries, country)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating countries: %w", err)
	}

	return countries, nil
}

// Delete removes a country record (soft delete by setting end_date recommended)
func (r *CountryRepository) Delete(ctx context.Context, alpha2 string) error {
	query := `DELETE FROM reference.countries WHERE alpha2 = $1`

	result, err := r.db.ExecContext(ctx, query, alpha2)
	if err != nil {
		return fmt.Errorf("failed to delete country: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("country not found: %s", alpha2)
	}

	return nil
}

// nullString converts empty strings to sql.NullString for nullable database columns
func nullString(s string) sql.NullString {
	return sql.NullString{
		String: s,
		Valid:  s != "",
	}
}
