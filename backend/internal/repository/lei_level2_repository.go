package repository

import (
	"time"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// LEILevel2Repository provides persistence operations for GLEIF Level 2 data:
// Relationship Records (RR) and Reporting Exceptions (REPEX).
type LEILevel2Repository interface {
	// Relationship Records
	UpsertRelationshipRecord(record *domain.LEIRelationshipRecord) error
	BatchUpsertRelationshipRecords(records []*domain.LEIRelationshipRecord) error
	FindRelationshipsByStartLEI(lei string) ([]*domain.LEIRelationshipRecord, error)
	FindRelationshipsByEndLEI(lei string) ([]*domain.LEIRelationshipRecord, error)
	CountRelationshipRecords() (int64, error)
	DeleteRelationshipsBySourceFile(sourceFileID uuid.UUID) error

	// Reporting Exceptions
	UpsertReportingException(exc *domain.LEIReportingException) error
	BatchUpsertReportingExceptions(exceptions []*domain.LEIReportingException) error
	FindReportingExceptionsByLEI(lei string) ([]*domain.LEIReportingException, error)
	CountReportingExceptions() (int64, error)
	DeleteReportingExceptionsBySourceFile(sourceFileID uuid.UUID) error
}

type leiLevel2Repository struct {
	db *gorm.DB
}

// NewLEILevel2Repository creates a new LEILevel2Repository backed by the given database.
func NewLEILevel2Repository(db *gorm.DB) LEILevel2Repository {
	return &leiLevel2Repository{db: db}
}

// UpsertRelationshipRecord inserts a new relationship record or updates it when a row with the
// same (start_node_lei, end_node_lei, relationship_type) already exists.
func (r *leiLevel2Repository) UpsertRelationshipRecord(record *domain.LEIRelationshipRecord) error {
	now := time.Now()
	record.UpdatedAt = now
	if record.CreatedAt.IsZero() {
		record.CreatedAt = now
	}

	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "start_node_lei"},
			{Name: "end_node_lei"},
			{Name: "relationship_type"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"relationship_status",
			"relationship_periods",
			"relationship_qualifiers",
			"relationship_quantifiers",
			"registration_status",
			"initial_registration_date",
			"last_update_date",
			"next_renewal_date",
			"managing_lou",
			"validation_sources",
			"validation_documents",
			"validation_reference",
			"source_file_id",
			"updated_at",
		}),
	}).Create(record).Error
}

// BatchUpsertRelationshipRecords inserts or updates relationship records in bulk.
func (r *leiLevel2Repository) BatchUpsertRelationshipRecords(records []*domain.LEIRelationshipRecord) error {
	if len(records) == 0 {
		return nil
	}

	now := time.Now()
	for _, record := range records {
		record.UpdatedAt = now
		if record.CreatedAt.IsZero() {
			record.CreatedAt = now
		}
	}

	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "start_node_lei"},
			{Name: "end_node_lei"},
			{Name: "relationship_type"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"relationship_status",
			"relationship_periods",
			"relationship_qualifiers",
			"relationship_quantifiers",
			"registration_status",
			"initial_registration_date",
			"last_update_date",
			"next_renewal_date",
			"managing_lou",
			"validation_sources",
			"validation_documents",
			"validation_reference",
			"source_file_id",
			"updated_at",
		}),
	}).CreateInBatches(records, 500).Error
}

// FindRelationshipsByStartLEI returns all active relationship records where the child entity
// has the given LEI (i.e. where start_node_lei = lei).
func (r *leiLevel2Repository) FindRelationshipsByStartLEI(lei string) ([]*domain.LEIRelationshipRecord, error) {
	var records []*domain.LEIRelationshipRecord
	err := r.db.Where("start_node_lei = ?", lei).Find(&records).Error
	return records, err
}

// FindRelationshipsByEndLEI returns all active relationship records where the parent entity
// has the given LEI (i.e. where end_node_lei = lei).
func (r *leiLevel2Repository) FindRelationshipsByEndLEI(lei string) ([]*domain.LEIRelationshipRecord, error) {
	var records []*domain.LEIRelationshipRecord
	err := r.db.Where("end_node_lei = ?", lei).Find(&records).Error
	return records, err
}

// CountRelationshipRecords returns the total number of relationship records in the database.
func (r *leiLevel2Repository) CountRelationshipRecords() (int64, error) {
	var count int64
	err := r.db.Model(&domain.LEIRelationshipRecord{}).Count(&count).Error
	return count, err
}

// DeleteRelationshipsBySourceFile removes all relationship records that were loaded from the
// given source file. Used to roll back a partial load before re-processing.
func (r *leiLevel2Repository) DeleteRelationshipsBySourceFile(sourceFileID uuid.UUID) error {
	return r.db.Where("source_file_id = ?", sourceFileID).
		Delete(&domain.LEIRelationshipRecord{}).Error
}

// UpsertReportingException inserts a new reporting exception or updates it when a row with the
// same (lei, exception_category) already exists.
func (r *leiLevel2Repository) UpsertReportingException(exc *domain.LEIReportingException) error {
	now := time.Now()
	exc.UpdatedAt = now
	if exc.CreatedAt.IsZero() {
		exc.CreatedAt = now
	}

	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "lei"},
			{Name: "exception_category"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"exception_reason",
			"exception_reference",
			"source_file_id",
			"updated_at",
		}),
	}).Create(exc).Error
}

// BatchUpsertReportingExceptions inserts or updates reporting exceptions in bulk.
func (r *leiLevel2Repository) BatchUpsertReportingExceptions(exceptions []*domain.LEIReportingException) error {
	if len(exceptions) == 0 {
		return nil
	}

	now := time.Now()
	for _, exc := range exceptions {
		exc.UpdatedAt = now
		if exc.CreatedAt.IsZero() {
			exc.CreatedAt = now
		}
	}

	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "lei"},
			{Name: "exception_category"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"exception_reason",
			"exception_reference",
			"source_file_id",
			"updated_at",
		}),
	}).CreateInBatches(exceptions, 500).Error
}

// FindReportingExceptionsByLEI returns all reporting exceptions for the given LEI.
func (r *leiLevel2Repository) FindReportingExceptionsByLEI(lei string) ([]*domain.LEIReportingException, error) {
	var records []*domain.LEIReportingException
	err := r.db.Where("lei = ?", lei).Find(&records).Error
	return records, err
}

// CountReportingExceptions returns the total number of reporting exception records in the database.
func (r *leiLevel2Repository) CountReportingExceptions() (int64, error) {
	var count int64
	err := r.db.Model(&domain.LEIReportingException{}).Count(&count).Error
	return count, err
}

// DeleteReportingExceptionsBySourceFile removes all reporting exceptions that were loaded from
// the given source file. Used to roll back a partial load before re-processing.
func (r *leiLevel2Repository) DeleteReportingExceptionsBySourceFile(sourceFileID uuid.UUID) error {
	return r.db.Where("source_file_id = ?", sourceFileID).
		Delete(&domain.LEIReportingException{}).Error
}
