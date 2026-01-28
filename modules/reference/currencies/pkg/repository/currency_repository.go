package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/techie2000/axiom/modules/reference/currencies/pkg/transform"
)

// CurrencyRepository handles database operations for currencies
type CurrencyRepository struct {
	db *sql.DB
}

// NewCurrencyRepository creates a new currency repository
func NewCurrencyRepository(db *sql.DB) *CurrencyRepository {
	return &CurrencyRepository{db: db}
}

// SetAuditContext sets the audit trail context for provenance tracking
func (r *CurrencyRepository) SetAuditContext(ctx context.Context, source, user string) (context.Context, error) {
	_, err := r.db.ExecContext(ctx, "SELECT set_config('app.source_system', $1, false)", source)
	if err != nil {
		return ctx, fmt.Errorf("failed to set source_system: %w", err)
	}

	_, err = r.db.ExecContext(ctx, "SELECT set_config('app.source_user', $1, false)", user)
	if err != nil {
		return ctx, fmt.Errorf("failed to set source_user: %w", err)
	}

	return ctx, nil
}

// Upsert inserts or updates a currency record
func (r *CurrencyRepository) Upsert(ctx context.Context, currency *transform.Currency) error {
	query := `
		INSERT INTO reference.currencies (
			code, number, name, alpha2, minor_units,
			start_date, end_date, remarks, status,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9,
			$10, $11
		)
		ON CONFLICT (code) DO UPDATE SET
			number = EXCLUDED.number,
			name = EXCLUDED.name,
			alpha2 = EXCLUDED.alpha2,
			minor_units = EXCLUDED.minor_units,
			start_date = EXCLUDED.start_date,
			end_date = EXCLUDED.end_date,
			remarks = EXCLUDED.remarks,
			status = EXCLUDED.status,
			updated_at = EXCLUDED.updated_at
	`

	_, err := r.db.ExecContext(ctx, query,
		currency.Code,
		currency.Number,
		currency.Name,
		currency.Alpha2,
		currency.MinorUnits,
		currency.StartDate,
		currency.EndDate,
		currency.Remarks,
		currency.Status,
		currency.CreatedAt,
		currency.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to upsert currency %s: %w", currency.Code, err)
	}

	return nil
}
