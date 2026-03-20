package repository

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/techie2000/axiom/internal/domain"
	"gorm.io/gorm"
)

// RegistrationAuthorityRepository manages GLEIF registration authority reference data.
type RegistrationAuthorityRepository interface {
	// UpsertRegistrationAuthority inserts or updates a registration authority record.
	// Returns (isUpdated, error).  isUpdated is true when an existing record was changed.
	UpsertRegistrationAuthority(ra *domain.RegistrationAuthority) (bool, error)

	// FindByRACode looks up a registration authority by its GLEIF RA code (e.g. "RA000585").
	// Returns gorm.ErrRecordNotFound when the code is not present.
	FindByRACode(raCode string) (*domain.RegistrationAuthority, error)

	// FindAll returns all registration authority records with pagination.
	FindAll(limit, offset int) ([]*domain.RegistrationAuthority, error)

	// Count returns the total number of registration authority records.
	Count() (int64, error)
}

type registrationAuthorityRepository struct {
	db *gorm.DB
}

// NewRegistrationAuthorityRepository creates a new RegistrationAuthorityRepository.
func NewRegistrationAuthorityRepository(db *gorm.DB) RegistrationAuthorityRepository {
	return &registrationAuthorityRepository{db: db}
}

// FindByRACode looks up a single registration authority by RA code.
func (r *registrationAuthorityRepository) FindByRACode(raCode string) (*domain.RegistrationAuthority, error) {
	var ra domain.RegistrationAuthority
	if err := r.db.Where("ra_code = ?", raCode).First(&ra).Error; err != nil {
		return nil, err
	}
	return &ra, nil
}

// FindAll returns all registration authorities with pagination.
func (r *registrationAuthorityRepository) FindAll(limit, offset int) ([]*domain.RegistrationAuthority, error) {
	var ras []*domain.RegistrationAuthority
	query := r.db.Order("ra_code ASC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	if offset > 0 {
		query = query.Offset(offset)
	}
	if err := query.Find(&ras).Error; err != nil {
		return nil, err
	}
	return ras, nil
}

// Count returns the total number of registration authorities in the table.
func (r *registrationAuthorityRepository) Count() (int64, error) {
	var count int64
	if err := r.db.Model(&domain.RegistrationAuthority{}).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// UpsertRegistrationAuthority inserts or updates a registration authority row, recording an
// audit entry for every meaningful change.  Returns (true, nil) when an existing record was
// updated, (false, nil) when a new record was created, and (false, err) on failure.
func (r *registrationAuthorityRepository) UpsertRegistrationAuthority(ra *domain.RegistrationAuthority) (bool, error) {
	tx := r.db.Begin()
	if tx.Error != nil {
		return false, tx.Error
	}
	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p)
		}
	}()

	var existing domain.RegistrationAuthority
	err := tx.Where("ra_code = ?", ra.RACode).First(&existing).Error

	if err != nil && err != gorm.ErrRecordNotFound {
		tx.Rollback()
		return false, err
	}

	if err == gorm.ErrRecordNotFound {
		// New record
		ra.CreatedBy = "system"
		ra.UpdatedBy = "system"
		if createErr := tx.Create(ra).Error; createErr != nil {
			tx.Rollback()
			return false, createErr
		}

		snapshot, _ := json.Marshal(ra)
		audit := &domain.RegistrationAuthorityAudit{
			RAID:           ra.ID,
			RACode:         ra.RACode,
			Action:         "CREATE",
			RecordSnapshot: domain.JSONBString(snapshot),
			ChangedFields:  "{}",
			ChangedBy:      "system",
		}
		if auditErr := tx.Create(audit).Error; auditErr != nil {
			tx.Rollback()
			return false, fmt.Errorf("failed to create registration authority audit record: %w", auditErr)
		}

		return false, tx.Commit().Error
	}

	// Existing record — detect changes
	changes := detectRAChanges(&existing, ra)
	if len(changes) == 0 {
		tx.Rollback()
		return false, nil
	}

	changesJSON, err := json.Marshal(changes)
	if err != nil {
		tx.Rollback()
		return false, fmt.Errorf("failed to marshal RA changes: %w", err)
	}

	ra.ID = existing.ID
	ra.CreatedAt = existing.CreatedAt
	ra.CreatedBy = existing.CreatedBy
	ra.UpdatedBy = "system"
	ra.UpdatedAt = time.Now()

	if saveErr := tx.Save(ra).Error; saveErr != nil {
		tx.Rollback()
		return false, saveErr
	}

	snapshot, _ := json.Marshal(ra)
	audit := &domain.RegistrationAuthorityAudit{
		RAID:           ra.ID,
		RACode:         ra.RACode,
		Action:         "UPDATE",
		RecordSnapshot: domain.JSONBString(snapshot),
		ChangedFields:  domain.JSONBString(changesJSON),
		ChangedBy:      "system",
	}
	if auditErr := tx.Create(audit).Error; auditErr != nil {
		tx.Rollback()
		return false, fmt.Errorf("failed to create registration authority audit record: %w", auditErr)
	}

	log.Debug().
		Str("ra_code", ra.RACode).
		Int("changed_fields", len(changes)).
		Msg("Registration authority updated")

	return true, tx.Commit().Error
}

// raChangeField represents a single field change for audit purposes.
type raChangeField struct {
	Old interface{} `json:"old"`
	New interface{} `json:"new"`
}

// detectRAChanges compares old and new registration authority records and returns a map of
// changed fields in the same format used by the LEI record audit trail.
func detectRAChanges(old, new *domain.RegistrationAuthority) map[string]raChangeField {
	changes := make(map[string]raChangeField)

	if old.CountryCode != new.CountryCode {
		changes["country_code"] = raChangeField{Old: old.CountryCode, New: new.CountryCode}
	}
	if old.RAName != new.RAName {
		changes["ra_name"] = raChangeField{Old: old.RAName, New: new.RAName}
	}
	if old.InternationalName != new.InternationalName {
		changes["international_name"] = raChangeField{Old: old.InternationalName, New: new.InternationalName}
	}
	if old.Website != new.Website {
		changes["website"] = raChangeField{Old: old.Website, New: new.Website}
	}
	if old.GLEIFNotes != new.GLEIFNotes {
		changes["gleif_notes"] = raChangeField{Old: old.GLEIFNotes, New: new.GLEIFNotes}
	}
	if old.IsDeprecated != new.IsDeprecated {
		changes["is_deprecated"] = raChangeField{Old: old.IsDeprecated, New: new.IsDeprecated}
	}

	return changes
}

// GetRegistrationAuthorityNamesByCode returns a map of RA code -> display name for a slice of
// RA codes. Codes not found in the database are omitted from the result.
// This helper is used by the LEI service to enrich records without N+1 queries.
func GetRegistrationAuthorityNamesByCode(db *gorm.DB, raCodes []string) (map[string]string, error) {
	if len(raCodes) == 0 {
		return make(map[string]string), nil
	}

	type row struct {
		RACode string `gorm:"column:ra_code"`
		RAName string `gorm:"column:ra_name"`
	}
	var rows []row
	if err := db.
		Table("lei_raw.registration_authorities").
		Select("ra_code, ra_name").
		Where("ra_code IN ?", raCodes).
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	names := make(map[string]string, len(rows))
	for _, r := range rows {
		names[r.RACode] = r.RAName
	}
	return names, nil
}

// FindRegistrationAuthorityNameByCode returns the display name for a single RA code.
// Returns an empty string and nil error when the code is not found.
func FindRegistrationAuthorityNameByCode(db *gorm.DB, raCode string) (string, error) {
	if raCode == "" {
		return "", nil
	}
	var name string
	err := db.
		Table("lei_raw.registration_authorities").
		Select("ra_name").
		Where("ra_code = ?", raCode).
		Limit(1).
		Pluck("ra_name", &name).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return "", err
	}
	return name, nil
}

// RegistrationAuthorityCountByCode returns the number of registration authorities in the table.
// It is provided as a convenience function for health/status checks.
func RegistrationAuthorityCountByCode(db *gorm.DB) (int64, error) {
	var count int64
	if err := db.Table("lei_raw.registration_authorities").Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
