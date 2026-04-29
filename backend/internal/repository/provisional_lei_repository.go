package repository

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/techie2000/axiom/internal/domain"
	"gorm.io/gorm"
)

// ProvisionalLEIRepository handles persistence of Axiom-issued provisional LEI records.
// Provisional records live in the same lei_raw.lei_records table as official GLEIF records
// but carry is_provisional = TRUE and an AXIO-prefixed LEI code (see ADR-0018).
type ProvisionalLEIRepository interface {
	// Create persists a new provisional LEI record.
	Create(record *domain.LEIRecord) error
	// Update saves changes to an existing provisional LEI record.
	Update(record *domain.LEIRecord) error
	// FindByLEI returns a provisional LEI record by its code.
	// Returns (nil, nil) when not found.
	FindByLEI(lei string) (*domain.LEIRecord, error)
	// Succeed marks a provisional record as succeeded by an official LEI:
	// sets successor_lei = officialLEI and entity_status = "MERGED".
	Succeed(provisionalLEI, officialLEI, changedBy string) error
	// ListProvisional returns all provisional records with pagination.
	ListProvisional(limit, offset int) ([]*domain.LEIRecord, error)
	// CountProvisional returns the total number of provisional LEI records.
	CountProvisional() (int64, error)
}

type provisionalLEIRepository struct {
	db *gorm.DB
}

// NewProvisionalLEIRepository creates a ProvisionalLEIRepository backed by db.
func NewProvisionalLEIRepository(db *gorm.DB) ProvisionalLEIRepository {
	return &provisionalLEIRepository{db: db}
}

func (r *provisionalLEIRepository) Create(record *domain.LEIRecord) error {
	record.IsProvisional = true

	if err := validateLEICode(record.LEI); err != nil {
		return err
	}

	stmt, err := buildProvisionalLEIInsertStatement()
	if err != nil {
		return err
	}

	err = r.db.Exec(stmt, provisionalLEIInsertArgs(record)...).Error
	
	return err
}

var provisionalLEIInsertColumns = []string{
	"id", "lei", "legal_name", "transliterated_legal_name", "other_names",
	"legal_address_line_1", "legal_address_line_2", "legal_address_line_3", "legal_address_line_4",
	"legal_address_city", "legal_address_region", "legal_address_country", "legal_address_postal_code",
	"hq_address_line_1", "hq_address_line_2", "hq_address_line_3", "hq_address_line_4",
	"hq_address_city", "hq_address_region", "hq_address_country", "hq_address_postal_code",
	"registration_authority", "registration_authority_id", "registration_number",
	"entity_category", "entity_sub_category", "entity_legal_form", "entity_status", "legal_jurisdiction",
	"registration_status", "managing_lou", "successor_lei", "initial_registration_date", "last_update_date",
	"next_renewal_date", "validation_sources", "validation_authority", "source_file_id", "changed_fields",
	"created_by", "updated_by", "is_provisional", "provisioning_source", "created_at", "updated_at", "deleted_at",
}

// Keep NULLIF on constrained optional text columns so empty string does not violate FK/domain constraints.
var provisionalLEIInsertValues = []string{
	"?", "?", "?", "?", "?",
	"?", "?", "?", "?",
	"?", "?", "NULLIF(?, '')", "?",
	"?", "?", "?", "?",
	"?", "?", "NULLIF(?, '')", "?",
	"NULLIF(?, '')", "?", "?",
	"?", "?", "NULLIF(?, '')", "?", "?",
	"?", "NULLIF(?, '')", "NULLIF(?, '')", "?", "?",
	"?", "?", "NULLIF(?, '')", "?", "?",
	"?", "?", "?", "?", "?", "?", "?",
}

func buildProvisionalLEIInsertStatement() (string, error) {
	if len(provisionalLEIInsertColumns) != len(provisionalLEIInsertValues) {
		return "", fmt.Errorf("provisional LEI insert misconfigured: %d columns, %d values", len(provisionalLEIInsertColumns), len(provisionalLEIInsertValues))
	}

	return fmt.Sprintf(
		"INSERT INTO lei_raw.lei_records (%s) VALUES (%s)",
		strings.Join(provisionalLEIInsertColumns, ", "),
		strings.Join(provisionalLEIInsertValues, ", "),
	), nil
}

func provisionalLEIInsertArgs(record *domain.LEIRecord) []interface{} {
	return []interface{}{
		record.ID, record.LEI, record.LegalName, record.TransliteratedLegalName, record.OtherNames,
		record.LegalAddressLine1, record.LegalAddressLine2, record.LegalAddressLine3, record.LegalAddressLine4,
		record.LegalAddressCity, record.LegalAddressRegion, record.LegalAddressCountry, record.LegalAddressPostalCode,
		record.HQAddressLine1, record.HQAddressLine2, record.HQAddressLine3, record.HQAddressLine4,
		record.HQAddressCity, record.HQAddressRegion, record.HQAddressCountry, record.HQAddressPostalCode,
		record.RegistrationAuthority, record.RegistrationAuthorityID, record.RegistrationNumber,
		record.EntityCategory, record.EntitySubCategory, record.EntityLegalForm, record.EntityStatus, record.LegalJurisdiction,
		record.RegistrationStatus, record.ManagingLOU, record.SuccessorLEI, record.InitialRegistrationDate, record.LastUpdateDate,
		record.NextRenewalDate, record.ValidationSources, record.ValidationAuthority, record.SourceFileID, record.ChangedFields,
		record.CreatedBy, record.UpdatedBy, record.IsProvisional, record.ProvisioningSource, record.CreatedAt, record.UpdatedAt, record.DeletedAt,
	}
}

func validateLEICode(lei string) error {
	if len(lei) != 20 {
		return fmt.Errorf("LEI must be exactly 20 characters, got %d", len(lei))
	}
	for i, ch := range lei {
		if i < 18 {
			if !((ch >= '0' && ch <= '9') || (ch >= 'A' && ch <= 'Z')) {
				return fmt.Errorf("LEI character at position %d is invalid: %c", i, ch)
			}
			continue
		}
		if ch < '0' || ch > '9' {
			return fmt.Errorf("LEI check digit at position %d is invalid: %c", i, ch)
		}
	}
	return nil
}

func (r *provisionalLEIRepository) Update(record *domain.LEIRecord) error {
	if !record.IsProvisional {
		return errors.New("cannot update a non-provisional LEI record via ProvisionalLEIRepository")
	}
	result := r.db.Table("lei_raw.lei_records").Save(record)
	return result.Error
}

func (r *provisionalLEIRepository) FindByLEI(lei string) (*domain.LEIRecord, error) {
	var record domain.LEIRecord
	err := r.db.Table("lei_raw.lei_records").
		Where("lei = ? AND is_provisional = TRUE", lei).
		First(&record).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find provisional LEI %s: %w", lei, err)
	}
	return &record, nil
}

func (r *provisionalLEIRepository) Succeed(provisionalLEI, officialLEI, changedBy string) error {
	now := time.Now().UTC()
	result := r.db.Table("lei_raw.lei_records").
		Where("lei = ? AND is_provisional = TRUE", provisionalLEI).
		Updates(map[string]interface{}{
			"successor_lei": officialLEI,
			"entity_status": "MERGED",
			"updated_by":    changedBy,
			"updated_at":    now,
		})
	if result.Error != nil {
		return fmt.Errorf("succeed provisional LEI %s: %w", provisionalLEI, result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("provisional LEI %s not found", provisionalLEI)
	}
	return nil
}

func (r *provisionalLEIRepository) ListProvisional(limit, offset int) ([]*domain.LEIRecord, error) {
	var records []*domain.LEIRecord
	err := r.db.Table("lei_raw.lei_records").
		Where("is_provisional = TRUE").
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&records).Error
	if err != nil {
		return nil, fmt.Errorf("list provisional LEIs: %w", err)
	}
	return records, nil
}

func (r *provisionalLEIRepository) CountProvisional() (int64, error) {
	var count int64
	err := r.db.Table("lei_raw.lei_records").
		Where("is_provisional = TRUE").
		Count(&count).Error
	if err != nil {
		return 0, fmt.Errorf("count provisional LEIs: %w", err)
	}
	return count, nil
}

// Compile-time interface check.
var _ ProvisionalLEIRepository = (*provisionalLEIRepository)(nil)
