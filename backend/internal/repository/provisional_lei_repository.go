package repository

import (
	"errors"
	"fmt"
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

	return r.db.Table("lei_raw.lei_records").Create(provisionalLEIInsertPayload(record)).Error
}

func provisionalLEIInsertPayload(record *domain.LEIRecord) map[string]interface{} {
	return map[string]interface{}{
		"id":                        record.ID,
		"lei":                       record.LEI,
		"legal_name":                record.LegalName,
		"transliterated_legal_name": record.TransliteratedLegalName,
		"other_names":               record.OtherNames,
		"legal_address_line_1":      record.LegalAddressLine1,
		"legal_address_line_2":      record.LegalAddressLine2,
		"legal_address_line_3":      record.LegalAddressLine3,
		"legal_address_line_4":      record.LegalAddressLine4,
		"legal_address_city":        record.LegalAddressCity,
		"legal_address_region":      record.LegalAddressRegion,
		"legal_address_country":     nullableString(record.LegalAddressCountry),
		"legal_address_postal_code": record.LegalAddressPostalCode,
		"hq_address_line_1":         record.HQAddressLine1,
		"hq_address_line_2":         record.HQAddressLine2,
		"hq_address_line_3":         record.HQAddressLine3,
		"hq_address_line_4":         record.HQAddressLine4,
		"hq_address_city":           record.HQAddressCity,
		"hq_address_region":         record.HQAddressRegion,
		"hq_address_country":        nullableString(record.HQAddressCountry),
		"hq_address_postal_code":    record.HQAddressPostalCode,
		"registration_authority":    nullableString(record.RegistrationAuthority),
		"registration_authority_id": record.RegistrationAuthorityID,
		"registration_number":       record.RegistrationNumber,
		"entity_category":           record.EntityCategory,
		"entity_sub_category":       record.EntitySubCategory,
		"entity_legal_form":         nullableString(record.EntityLegalForm),
		"entity_status":             record.EntityStatus,
		"legal_jurisdiction":        nullableString(record.LegalJurisdiction),
		"registration_status":       record.RegistrationStatus,
		"managing_lou":              nullableString(record.ManagingLOU),
		"successor_lei":             nullableString(record.SuccessorLEI),
		"initial_registration_date": record.InitialRegistrationDate,
		"last_update_date":          record.LastUpdateDate,
		"next_renewal_date":         record.NextRenewalDate,
		"validation_sources":        record.ValidationSources,
		"validation_authority":      nullableString(record.ValidationAuthority),
		"source_file_id":            record.SourceFileID,
		"changed_fields":            record.ChangedFields,
		"created_by":                record.CreatedBy,
		"updated_by":                record.UpdatedBy,
		"is_provisional":            record.IsProvisional,
		"provisioning_source":       record.ProvisioningSource,
		"created_at":                record.CreatedAt,
		"updated_at":                record.UpdatedAt,
		"deleted_at":                nullableDeletedAt(record.DeletedAt),
	}
}

func nullableString(value string) interface{} {
	if value == "" {
		return nil
	}
	return value
}

func nullableDeletedAt(value gorm.DeletedAt) interface{} {
	if !value.Valid {
		return nil
	}
	return value.Time
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
