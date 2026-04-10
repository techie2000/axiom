package repository

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"github.com/techie2000/axiom/internal/domain"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// LEILevel2Repository provides persistence operations for GLEIF Level 2 data:
// Relationship Records (RR) and Reporting Exceptions (REPEX).
type LEILevel2Repository interface {
	// Relationship Records
	UpsertRelationshipRecord(record *domain.LEIRelationshipRecord) error
	BatchUpsertRelationshipRecords(records []*domain.LEIRelationshipRecord) (int, int, error)
	FindRelationshipsByStartLEI(lei string) ([]*domain.LEIRelationshipRecord, error)
	FindRelationshipsByEndLEI(lei string) ([]*domain.LEIRelationshipRecord, error)
	CountRelationshipRecords() (int64, error)
	DeleteRelationshipsBySourceFile(sourceFileID uuid.UUID) error

	// Reporting Exceptions
	UpsertReportingException(exc *domain.LEIReportingException) error
	BatchUpsertReportingExceptions(exceptions []*domain.LEIReportingException) (int, int, error)
	FindReportingExceptionsByLEI(lei string) ([]*domain.LEIReportingException, error)
	CountReportingExceptions() (int64, error)
	DeleteReportingExceptionsBySourceFile(sourceFileID uuid.UUID) error

	// Audit operations
	CreateRelationshipRecordAudit(audit *domain.LEIRelationshipRecordAudit) error
	FindAuditHistoryByRelationship(startLEI, endLEI, relType string, limit int) ([]*domain.LEIRelationshipRecordAudit, error)
	CreateReportingExceptionAudit(audit *domain.LEIReportingExceptionAudit) error
	FindAuditHistoryByREPEXLEI(lei string, limit int) ([]*domain.LEIReportingExceptionAudit, error)

	// Processing failures lifecycle
	CreateProcessingFailure(failure *domain.LEILevel2ProcessingFailure) error
	ResolveOpenProcessingFailures(jobType, naturalKey string, resolvedSourceFileID *uuid.UUID, resolvedNote string) error
	BatchResolveOpenProcessingFailures(jobType string, naturalKeys []string, resolvedSourceFileID *uuid.UUID, resolvedNote string) error
	ListProcessingFailures(jobType string, openOnly bool, limit, offset int) ([]*domain.LEILevel2ProcessingFailure, error)
	CountProcessingFailures(jobType string, openOnly bool) (int64, error)
}

type leiLevel2Repository struct {
	db *gorm.DB
}

// NewLEILevel2Repository creates a new LEILevel2Repository backed by the given database.
func NewLEILevel2Repository(db *gorm.DB) LEILevel2Repository {
	return &leiLevel2Repository{db: db}
}

// UpsertRelationshipRecord inserts a new relationship record or updates it when a row with the
// same (start_node_lei, end_node_lei, relationship_type) already exists. An audit record is
// created for every CREATE or UPDATE action, consistent with the Level 1 LEI audit pattern.
// The select, upsert, and audit insert are wrapped in a single transaction for atomicity.
func (r *leiLevel2Repository) UpsertRelationshipRecord(record *domain.LEIRelationshipRecord) error {
	now := time.Now()
	record.UpdatedAt = now
	if record.CreatedAt.IsZero() {
		record.CreatedAt = now
	}

	tx := r.db.Begin()
	if tx.Error != nil {
		return tx.Error
	}
	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
		}
	}()

	// Check for an existing row so we can detect changes and determine the audit action.
	var existing domain.LEIRelationshipRecord
	err := tx.Where(
		"start_node_lei = ? AND end_node_lei = ? AND relationship_type = ?",
		record.StartNodeLEI, record.EndNodeLEI, record.RelationshipType,
	).First(&existing).Error

	if err != nil && err != gorm.ErrRecordNotFound {
		tx.Rollback()
		return fmt.Errorf("failed to query existing relationship record: %w", err)
	}

	isNew := err == gorm.ErrRecordNotFound

	// Assign a stable UUID before insert so we can reference it in the audit record.
	if isNew && record.ID == uuid.Nil {
		record.ID = uuid.New()
	}

	// Perform the upsert.
	if upsertErr := tx.Clauses(clause.OnConflict{
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
	}).Create(record).Error; upsertErr != nil {
		tx.Rollback()
		return upsertErr
	}

	// Build and persist the audit record.
	var audit domain.LEIRelationshipRecordAudit
	if isNew {
		audit = domain.LEIRelationshipRecordAudit{
			RRRecordID:       record.ID,
			StartNodeLEI:     record.StartNodeLEI,
			EndNodeLEI:       record.EndNodeLEI,
			RelationshipType: record.RelationshipType,
			Action:           "CREATE",
			RecordSnapshot:   r.rrToJSON(record),
			ChangedFields:    "{}",
			SourceFileID:     record.SourceFileID,
			ChangedBy:        "system",
		}
	} else {
		changes := r.detectRRChanges(&existing, record)
		if len(changes) == 0 {
			// No actual change – rollback the upsert (no-op write) and skip audit.
			tx.Rollback()
			return nil
		}
		changesJSON, jsonErr := json.Marshal(changes)
		if jsonErr != nil {
			tx.Rollback()
			return fmt.Errorf("failed to marshal RR changes: %w", jsonErr)
		}
		audit = domain.LEIRelationshipRecordAudit{
			RRRecordID:       existing.ID,
			StartNodeLEI:     record.StartNodeLEI,
			EndNodeLEI:       record.EndNodeLEI,
			RelationshipType: record.RelationshipType,
			Action:           "UPDATE",
			RecordSnapshot:   r.rrToJSON(record),
			ChangedFields:    domain.JSONBString(changesJSON),
			SourceFileID:     record.SourceFileID,
			ChangedBy:        "system",
		}
	}

	if err := tx.Create(&audit).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to create RR audit record: %w", err)
	}

	return tx.Commit().Error
}

// BatchUpsertRelationshipRecords inserts or updates relationship records in bulk.
// An audit record is created for every CREATE or UPDATE action, consistent with the
// Level 1 LEI batch audit pattern.
// Returns (created_count, updated_count, error).
func (r *leiLevel2Repository) BatchUpsertRelationshipRecords(records []*domain.LEIRelationshipRecord) (int, int, error) {
	if len(records) == 0 {
		return 0, 0, nil
	}

	now := time.Now()
	for _, record := range records {
		record.UpdatedAt = now
		if record.CreatedAt.IsZero() {
			record.CreatedAt = now
		}
		// Pre-assign a UUID so we know the ID for new records before the upsert.
		if record.ID == uuid.Nil {
			record.ID = uuid.New()
		}
	}

	// Build a natural-key lookup for the incoming batch.
	type rrKey struct{ start, end, relType string }
	keyOf := func(r *domain.LEIRelationshipRecord) rrKey {
		return rrKey{r.StartNodeLEI, r.EndNodeLEI, r.RelationshipType}
	}

	// Collect start and end LEIs for a more targeted pre-fetch query.
	startLEIs := make([]string, 0, len(records))
	endLEIs := make([]string, 0, len(records))
	for _, rec := range records {
		startLEIs = append(startLEIs, rec.StartNodeLEI)
		endLEIs = append(endLEIs, rec.EndNodeLEI)
	}

	var existingSlice []domain.LEIRelationshipRecord
	if err := r.db.Where("start_node_lei IN ? AND end_node_lei IN ?", startLEIs, endLEIs).
		Find(&existingSlice).Error; err != nil {
		return 0, 0, fmt.Errorf("failed to pre-fetch existing RR records: %w", err)
	}
	existingMap := make(map[rrKey]*domain.LEIRelationshipRecord, len(existingSlice))
	for idx := range existingSlice {
		existingMap[keyOf(&existingSlice[idx])] = &existingSlice[idx]
	}

	// Use a transaction so records and their audit rows are committed atomically.
	tx := r.db.Begin()
	if tx.Error != nil {
		return 0, 0, tx.Error
	}
	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
		}
	}()

	// Perform the batch upsert inside the transaction.
	if err := tx.Clauses(clause.OnConflict{
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
	}).CreateInBatches(records, 500).Error; err != nil {
		tx.Rollback()
		return 0, 0, err
	}

	// Build audit records and count creates vs updates.
	audits := make([]domain.LEIRelationshipRecordAudit, 0, len(records))
	createdCount := 0
	updatedCount := 0
	for _, record := range records {
		existing, wasExisting := existingMap[keyOf(record)]

		if !wasExisting {
			createdCount++
			audits = append(audits, domain.LEIRelationshipRecordAudit{
				RRRecordID:       record.ID,
				StartNodeLEI:     record.StartNodeLEI,
				EndNodeLEI:       record.EndNodeLEI,
				RelationshipType: record.RelationshipType,
				Action:           "CREATE",
				RecordSnapshot:   r.rrToJSON(record),
				ChangedFields:    "{}",
				SourceFileID:     record.SourceFileID,
				ChangedBy:        "system",
			})
			continue
		}

		changes := r.detectRRChanges(existing, record)
		if len(changes) == 0 {
			continue // no meaningful change
		}
		changesJSON, jsonErr := json.Marshal(changes)
		if jsonErr != nil {
			tx.Rollback()
			return 0, 0, fmt.Errorf("failed to marshal RR changes: %w", jsonErr)
		}
		updatedCount++
		audits = append(audits, domain.LEIRelationshipRecordAudit{
			RRRecordID:       existing.ID,
			StartNodeLEI:     record.StartNodeLEI,
			EndNodeLEI:       record.EndNodeLEI,
			RelationshipType: record.RelationshipType,
			Action:           "UPDATE",
			RecordSnapshot:   r.rrToJSON(record),
			ChangedFields:    domain.JSONBString(changesJSON),
			SourceFileID:     record.SourceFileID,
			ChangedBy:        "system",
		})
	}

	// Batch-insert audit records (100 at a time).
	const auditBatchSize = 100
	for i := 0; i < len(audits); i += auditBatchSize {
		end := i + auditBatchSize
		if end > len(audits) {
			end = len(audits)
		}
		batch := audits[i:end]
		if err := tx.Create(&batch).Error; err != nil {
			tx.Rollback()
			log.Error().Err(err).Int("batch_start", i).Int("batch_end", end).
				Msg("CRITICAL: RR audit record creation failed")
			return 0, 0, fmt.Errorf("failed to create RR audit records: %w", err)
		}
	}

	if err := tx.Commit().Error; err != nil {
		return 0, 0, fmt.Errorf("failed to commit RR batch upsert: %w", err)
	}

	log.Debug().Int("created", createdCount).Int("updated", updatedCount).Int("audits", len(audits)).
		Msg("RR batch upsert with audit trail completed")

	return createdCount, updatedCount, nil
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
// same (lei, exception_category) already exists. An audit record is created for every CREATE
// or UPDATE action, consistent with the Level 1 LEI audit pattern.
// The select, upsert, and audit insert are wrapped in a single transaction for atomicity.
func (r *leiLevel2Repository) UpsertReportingException(exc *domain.LEIReportingException) error {
	now := time.Now()
	exc.UpdatedAt = now
	if exc.CreatedAt.IsZero() {
		exc.CreatedAt = now
	}

	tx := r.db.Begin()
	if tx.Error != nil {
		return tx.Error
	}
	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
		}
	}()

	// Check for an existing row so we can detect changes and determine the audit action.
	var existing domain.LEIReportingException
	err := tx.Where("lei = ? AND exception_category = ?", exc.LEI, exc.ExceptionCategory).
		First(&existing).Error

	if err != nil && err != gorm.ErrRecordNotFound {
		tx.Rollback()
		return fmt.Errorf("failed to query existing reporting exception: %w", err)
	}

	isNew := err == gorm.ErrRecordNotFound

	// Assign a stable UUID before insert so we can reference it in the audit record.
	if isNew && exc.ID == uuid.Nil {
		exc.ID = uuid.New()
	}

	// Perform the upsert.
	if upsertErr := tx.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "lei"},
			{Name: "exception_category"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"exception_reference",
			"source_file_id",
			"updated_at",
		}),
	}).Create(exc).Error; upsertErr != nil {
		tx.Rollback()
		return upsertErr
	}

	// Build and persist the audit record.
	var audit domain.LEIReportingExceptionAudit
	if isNew {
		audit = domain.LEIReportingExceptionAudit{
			RepexRecordID:     exc.ID,
			LEI:               exc.LEI,
			ExceptionCategory: exc.ExceptionCategory,
			Action:            "CREATE",
			RecordSnapshot:    r.repexToJSON(exc),
			ChangedFields:     "{}",
			SourceFileID:      exc.SourceFileID,
			ChangedBy:         "system",
		}
	} else {
		changes := r.detectRepexChanges(&existing, exc)
		if len(changes) == 0 {
			// No actual change – rollback the upsert (no-op write) and skip audit.
			tx.Rollback()
			return nil
		}
		changesJSON, jsonErr := json.Marshal(changes)
		if jsonErr != nil {
			tx.Rollback()
			return fmt.Errorf("failed to marshal REPEX changes: %w", jsonErr)
		}
		audit = domain.LEIReportingExceptionAudit{
			RepexRecordID:     existing.ID,
			LEI:               exc.LEI,
			ExceptionCategory: exc.ExceptionCategory,
			Action:            "UPDATE",
			RecordSnapshot:    r.repexToJSON(exc),
			ChangedFields:     domain.JSONBString(changesJSON),
			SourceFileID:      exc.SourceFileID,
			ChangedBy:         "system",
		}
	}

	if err := tx.Create(&audit).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to create REPEX audit record: %w", err)
	}

	return tx.Commit().Error
}

// BatchUpsertReportingExceptions inserts or updates reporting exceptions in bulk.
// An audit record is created for every CREATE or UPDATE action, consistent with the
// Level 1 LEI batch audit pattern.
// Returns (created_count, updated_count, error).
func (r *leiLevel2Repository) BatchUpsertReportingExceptions(exceptions []*domain.LEIReportingException) (int, int, error) {
	if len(exceptions) == 0 {
		return 0, 0, nil
	}

	now := time.Now()
	for _, exc := range exceptions {
		exc.UpdatedAt = now
		if exc.CreatedAt.IsZero() {
			exc.CreatedAt = now
		}
		// Pre-assign a UUID so we know the ID for new records before the upsert.
		if exc.ID == uuid.Nil {
			exc.ID = uuid.New()
		}
	}

	// Build a natural-key lookup for the incoming batch.
	type repexKey struct{ lei, category string }
	keyOf := func(e *domain.LEIReportingException) repexKey {
		return repexKey{e.LEI, e.ExceptionCategory}
	}

	// Collect all LEIs in this batch for the pre-fetch query.
	leis := make([]string, 0, len(exceptions))
	for _, exc := range exceptions {
		leis = append(leis, exc.LEI)
	}

	var existingSlice []domain.LEIReportingException
	if err := r.db.Where("lei IN ?", leis).Find(&existingSlice).Error; err != nil {
		return 0, 0, fmt.Errorf("failed to pre-fetch existing REPEX records: %w", err)
	}
	existingMap := make(map[repexKey]*domain.LEIReportingException, len(existingSlice))
	for idx := range existingSlice {
		existingMap[keyOf(&existingSlice[idx])] = &existingSlice[idx]
	}

	// Use a transaction so records and their audit rows are committed atomically.
	tx := r.db.Begin()
	if tx.Error != nil {
		return 0, 0, tx.Error
	}
	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
		}
	}()

	// Perform the batch upsert inside the transaction.
	if err := tx.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "lei"},
			{Name: "exception_category"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"exception_reasons",
			"exception_reference",
			"source_file_id",
			"updated_at",
		}),
	}).CreateInBatches(exceptions, 500).Error; err != nil {
		tx.Rollback()
		return 0, 0, err
	}

	// Build audit records and count creates vs updates.
	audits := make([]domain.LEIReportingExceptionAudit, 0, len(exceptions))
	createdCount := 0
	updatedCount := 0
	for _, exc := range exceptions {
		existing, wasExisting := existingMap[keyOf(exc)]

		if !wasExisting {
			createdCount++
			audits = append(audits, domain.LEIReportingExceptionAudit{
				RepexRecordID:     exc.ID,
				LEI:               exc.LEI,
				ExceptionCategory: exc.ExceptionCategory,
				Action:            "CREATE",
				RecordSnapshot:    r.repexToJSON(exc),
				ChangedFields:     "{}",
				SourceFileID:      exc.SourceFileID,
				ChangedBy:         "system",
			})
			continue
		}

		changes := r.detectRepexChanges(existing, exc)
		if len(changes) == 0 {
			continue // no meaningful change
		}
		changesJSON, jsonErr := json.Marshal(changes)
		if jsonErr != nil {
			tx.Rollback()
			return 0, 0, fmt.Errorf("failed to marshal REPEX changes: %w", jsonErr)
		}
		updatedCount++
		audits = append(audits, domain.LEIReportingExceptionAudit{
			RepexRecordID:     existing.ID,
			LEI:               exc.LEI,
			ExceptionCategory: exc.ExceptionCategory,
			Action:            "UPDATE",
			RecordSnapshot:    r.repexToJSON(exc),
			ChangedFields:     domain.JSONBString(changesJSON),
			SourceFileID:      exc.SourceFileID,
			ChangedBy:         "system",
		})
	}

	// Batch-insert audit records (100 at a time).
	const auditBatchSize = 100
	for i := 0; i < len(audits); i += auditBatchSize {
		end := i + auditBatchSize
		if end > len(audits) {
			end = len(audits)
		}
		batch := audits[i:end]
		if err := tx.Create(&batch).Error; err != nil {
			tx.Rollback()
			log.Error().Err(err).Int("batch_start", i).Int("batch_end", end).
				Msg("CRITICAL: REPEX audit record creation failed")
			return 0, 0, fmt.Errorf("failed to create REPEX audit records: %w", err)
		}
	}

	if err := tx.Commit().Error; err != nil {
		return 0, 0, fmt.Errorf("failed to commit REPEX batch upsert: %w", err)
	}

	log.Debug().Int("created", createdCount).Int("updated", updatedCount).Int("audits", len(audits)).
		Msg("REPEX batch upsert with audit trail completed")

	return createdCount, updatedCount, nil
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

// CreateRelationshipRecordAudit persists an audit record for a relationship record change.
func (r *leiLevel2Repository) CreateRelationshipRecordAudit(audit *domain.LEIRelationshipRecordAudit) error {
	return r.db.Create(audit).Error
}

// FindAuditHistoryByRelationship retrieves audit history for a specific relationship identified
// by its natural key (start_node_lei, end_node_lei, relationship_type), ordered newest-first.
func (r *leiLevel2Repository) FindAuditHistoryByRelationship(startLEI, endLEI, relType string, limit int) ([]*domain.LEIRelationshipRecordAudit, error) {
	var audits []*domain.LEIRelationshipRecordAudit
	query := r.db.Where(
		"start_node_lei = ? AND end_node_lei = ? AND relationship_type = ?",
		startLEI, endLEI, relType,
	).Order("created_at DESC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	if err := query.Find(&audits).Error; err != nil {
		return nil, err
	}
	return audits, nil
}

// CreateReportingExceptionAudit persists an audit record for a reporting exception change.
func (r *leiLevel2Repository) CreateReportingExceptionAudit(audit *domain.LEIReportingExceptionAudit) error {
	return r.db.Create(audit).Error
}

// FindAuditHistoryByREPEXLEI retrieves audit history for all reporting exceptions associated
// with the given LEI, ordered newest-first.
func (r *leiLevel2Repository) FindAuditHistoryByREPEXLEI(lei string, limit int) ([]*domain.LEIReportingExceptionAudit, error) {
	var audits []*domain.LEIReportingExceptionAudit
	query := r.db.Where("lei = ?", lei).Order("created_at DESC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	if err := query.Find(&audits).Error; err != nil {
		return nil, err
	}
	return audits, nil
}

// CreateProcessingFailure persists a single Level 2 processing failure event.
func (r *leiLevel2Repository) CreateProcessingFailure(failure *domain.LEILevel2ProcessingFailure) error {
	return r.db.Create(failure).Error
}

// ResolveOpenProcessingFailures marks all unresolved failure rows for the same natural key as resolved.
func (r *leiLevel2Repository) ResolveOpenProcessingFailures(jobType, naturalKey string, resolvedSourceFileID *uuid.UUID, resolvedNote string) error {
	normalizedKey := strings.TrimSpace(naturalKey)
	if normalizedKey == "" {
		return nil
	}

	now := time.Now()
	updates := map[string]interface{}{
		"resolved":    true,
		"resolved_at": now,
		"updated_at":  now,
	}
	if resolvedSourceFileID != nil {
		updates["resolved_source_file_id"] = *resolvedSourceFileID
	}
	if strings.TrimSpace(resolvedNote) != "" {
		updates["resolved_note"] = resolvedNote
	}

	return r.db.Model(&domain.LEILevel2ProcessingFailure{}).
		Where("job_type = ? AND natural_key = ? AND resolved = FALSE", jobType, normalizedKey).
		Updates(updates).Error
}

// BatchResolveOpenProcessingFailures marks all unresolved failure rows for the given set of
// natural keys as resolved with a single UPDATE … WHERE natural_key IN (…) query, avoiding
// the N individual UPDATE round-trips that would otherwise be issued per successful batch.
func (r *leiLevel2Repository) BatchResolveOpenProcessingFailures(jobType string, naturalKeys []string, resolvedSourceFileID *uuid.UUID, resolvedNote string) error {
	filtered := filterNonEmptyStrings(naturalKeys)
	if len(filtered) == 0 {
		return nil
	}

	now := time.Now()
	updates := map[string]interface{}{
		"resolved":    true,
		"resolved_at": now,
		"updated_at":  now,
	}
	if resolvedSourceFileID != nil {
		updates["resolved_source_file_id"] = *resolvedSourceFileID
	}
	if strings.TrimSpace(resolvedNote) != "" {
		updates["resolved_note"] = resolvedNote
	}

	return r.db.Model(&domain.LEILevel2ProcessingFailure{}).
		Where("job_type = ? AND natural_key IN ? AND resolved = FALSE", jobType, filtered).
		Updates(updates).Error
}

// ListProcessingFailures retrieves Level 2 processing failure rows newest-first.
func (r *leiLevel2Repository) ListProcessingFailures(jobType string, openOnly bool, limit, offset int) ([]*domain.LEILevel2ProcessingFailure, error) {
	query := r.db.Model(&domain.LEILevel2ProcessingFailure{}).Order("created_at DESC")
	if strings.TrimSpace(jobType) != "" {
		query = query.Where("job_type = ?", jobType)
	}
	if openOnly {
		query = query.Where("resolved = FALSE")
	}
	if limit > 0 {
		query = query.Limit(limit)
	}
	if offset > 0 {
		query = query.Offset(offset)
	}

	var failures []*domain.LEILevel2ProcessingFailure
	if err := query.Find(&failures).Error; err != nil {
		return nil, err
	}

	return failures, nil
}

// CountProcessingFailures returns total matching Level 2 processing failures.
func (r *leiLevel2Repository) CountProcessingFailures(jobType string, openOnly bool) (int64, error) {
	query := r.db.Model(&domain.LEILevel2ProcessingFailure{})
	if strings.TrimSpace(jobType) != "" {
		query = query.Where("job_type = ?", jobType)
	}
	if openOnly {
		query = query.Where("resolved = FALSE")
	}

	var count int64
	err := query.Count(&count).Error
	return count, err
}

// --- helpers ---

// level2ChangeDetection mirrors domain.LEIChangeDetection for Level 2 field diffs.
type level2ChangeDetection struct {
	FieldName string      `json:"field_name"`
	OldValue  interface{} `json:"old_value"`
	NewValue  interface{} `json:"new_value"`
}

// detectRRChanges compares two relationship records and returns the changed fields.
// Uses reflect.DeepEqual for robust comparison across all field types, with special
// handling for *time.Time zero values to avoid false positives.
func (r *leiLevel2Repository) detectRRChanges(old, new *domain.LEIRelationshipRecord) map[string]level2ChangeDetection {
	changes := make(map[string]level2ChangeDetection)

	checkTime := func(field string, oldVal, newVal *time.Time) {
		oZero := oldVal == nil || oldVal.IsZero()
		nZero := newVal == nil || newVal.IsZero()
		if oZero && nZero {
			return
		}
		if (oZero != nZero) || (!oZero && !oldVal.Equal(*newVal)) {
			changes[field] = level2ChangeDetection{field, oldVal, newVal}
		}
	}

	check := func(field string, oldVal, newVal interface{}) {
		if !reflect.DeepEqual(oldVal, newVal) {
			changes[field] = level2ChangeDetection{field, oldVal, newVal}
		}
	}

	checkJSONB := func(field string, oldVal, newVal domain.JSONBString) {
		if jsonBStringsSemanticEqual(oldVal, newVal) {
			return
		}
		changes[field] = level2ChangeDetection{field, oldVal, newVal}
	}

	check("RelationshipStatus", old.RelationshipStatus, new.RelationshipStatus)
	checkJSONB("RelationshipPeriods", old.RelationshipPeriods, new.RelationshipPeriods)
	checkJSONB("RelationshipQualifiers", old.RelationshipQualifiers, new.RelationshipQualifiers)
	checkJSONB("RelationshipQuantifiers", old.RelationshipQuantifiers, new.RelationshipQuantifiers)
	check("RegistrationStatus", old.RegistrationStatus, new.RegistrationStatus)
	checkTime("InitialRegistrationDate", old.InitialRegistrationDate, new.InitialRegistrationDate)
	checkTime("LastUpdateDate", old.LastUpdateDate, new.LastUpdateDate)
	checkTime("NextRenewalDate", old.NextRenewalDate, new.NextRenewalDate)
	check("ManagingLOU", old.ManagingLOU, new.ManagingLOU)
	check("ValidationSources", old.ValidationSources, new.ValidationSources)
	check("ValidationDocuments", old.ValidationDocuments, new.ValidationDocuments)
	check("ValidationReference", old.ValidationReference, new.ValidationReference)

	return changes
}

// detectRepexChanges compares two reporting exceptions and returns the changed fields.
func (r *leiLevel2Repository) detectRepexChanges(old, new *domain.LEIReportingException) map[string]level2ChangeDetection {
	changes := make(map[string]level2ChangeDetection)

	checkJSONB := func(field string, oldVal, newVal domain.JSONBString) {
		if !jsonBStringsSemanticEqual(oldVal, newVal) {
			changes[field] = level2ChangeDetection{field, string(oldVal), string(newVal)}
		}
	}

	check := func(field, oldVal, newVal string) {
		if oldVal != newVal {
			changes[field] = level2ChangeDetection{field, oldVal, newVal}
		}
	}

	checkJSONB("ExceptionReasons", old.ExceptionReasons, new.ExceptionReasons)
	check("ExceptionReference", old.ExceptionReference, new.ExceptionReference)

	return changes
}

// rrToJSON serialises a relationship record to a JSONBString for audit snapshots.
// Logs and returns an empty object on marshalling error so that caller writes are not blocked.
func (r *leiLevel2Repository) rrToJSON(record *domain.LEIRelationshipRecord) domain.JSONBString {
	data, err := json.Marshal(record)
	if err != nil {
		log.Error().Err(err).Str("start_node_lei", record.StartNodeLEI).Str("end_node_lei", record.EndNodeLEI).
			Msg("Failed to marshal RR record for audit snapshot")
		return domain.JSONBString("{}")
	}
	return domain.JSONBString(data)
}

// repexToJSON serialises a reporting exception to a JSONBString for audit snapshots.
// Logs and returns an empty object on marshalling error so that caller writes are not blocked.
func (r *leiLevel2Repository) repexToJSON(exc *domain.LEIReportingException) domain.JSONBString {
	data, err := json.Marshal(exc)
	if err != nil {
		log.Error().Err(err).Str("lei", exc.LEI).
			Msg("Failed to marshal REPEX record for audit snapshot")
		return domain.JSONBString("{}")
	}
	return domain.JSONBString(data)
}
