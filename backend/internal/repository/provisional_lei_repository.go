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
	result := r.db.Table("lei_raw.lei_records").Create(record)
	return result.Error
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
