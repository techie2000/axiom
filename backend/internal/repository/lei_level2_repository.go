package repository

import (
	"encoding/json"
	"fmt"
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

	// Audit operations
	CreateRelationshipRecordAudit(audit *domain.LEIRelationshipRecordAudit) error
	FindAuditHistoryByRelationship(startLEI, endLEI, relType string, limit int) ([]*domain.LEIRelationshipRecordAudit, error)
	CreateReportingExceptionAudit(audit *domain.LEIReportingExceptionAudit) error
	FindAuditHistoryByREPEXLEI(lei string, limit int) ([]*domain.LEIReportingExceptionAudit, error)
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
func (r *leiLevel2Repository) UpsertRelationshipRecord(record *domain.LEIRelationshipRecord) error {
	now := time.Now()
	record.UpdatedAt = now
	if record.CreatedAt.IsZero() {
		record.CreatedAt = now
	}

	// Check for an existing row so we can detect changes and determine the audit action.
	var existing domain.LEIRelationshipRecord
	err := r.db.Where(
		"start_node_lei = ? AND end_node_lei = ? AND relationship_type = ?",
		record.StartNodeLEI, record.EndNodeLEI, record.RelationshipType,
	).First(&existing).Error

	if err != nil && err != gorm.ErrRecordNotFound {
		return fmt.Errorf("failed to query existing relationship record: %w", err)
	}

	isNew := err == gorm.ErrRecordNotFound

	// Assign a stable UUID before insert so we can reference it in the audit record.
	if isNew && record.ID == uuid.Nil {
		record.ID = uuid.New()
	}

	// Perform the upsert.
	if upsertErr := r.db.Clauses(clause.OnConflict{
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
			return nil // no actual change – skip audit
		}
		changesJSON, jsonErr := json.Marshal(changes)
		if jsonErr != nil {
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

	return r.CreateRelationshipRecordAudit(&audit)
}

// BatchUpsertRelationshipRecords inserts or updates relationship records in bulk.
// An audit record is created for every CREATE or UPDATE action, consistent with the
// Level 1 LEI batch audit pattern.
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

	// Collect all start LEIs in this batch for the pre-fetch query.
	startLEIs := make([]string, 0, len(records))
	for _, rec := range records {
		startLEIs = append(startLEIs, rec.StartNodeLEI)
	}

	var existingSlice []domain.LEIRelationshipRecord
	if err := r.db.Where("start_node_lei IN ?", startLEIs).Find(&existingSlice).Error; err != nil {
		return fmt.Errorf("failed to pre-fetch existing RR records: %w", err)
	}
	existingMap := make(map[rrKey]*domain.LEIRelationshipRecord, len(existingSlice))
	for idx := range existingSlice {
		existingMap[keyOf(&existingSlice[idx])] = &existingSlice[idx]
	}

	// Use a transaction so records and their audit rows are committed atomically.
	tx := r.db.Begin()
	if tx.Error != nil {
		return tx.Error
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
		return err
	}

	// Build audit records.
	audits := make([]domain.LEIRelationshipRecordAudit, 0, len(records))
	for _, record := range records {
		existing, wasExisting := existingMap[keyOf(record)]

		if !wasExisting {
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
			return fmt.Errorf("failed to marshal RR changes: %w", jsonErr)
		}
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
			return fmt.Errorf("failed to create RR audit records: %w", err)
		}
	}

	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("failed to commit RR batch upsert: %w", err)
	}

	log.Debug().Int("records", len(records)).Int("audits", len(audits)).
		Msg("RR batch upsert with audit trail completed")

	return nil
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
func (r *leiLevel2Repository) UpsertReportingException(exc *domain.LEIReportingException) error {
	now := time.Now()
	exc.UpdatedAt = now
	if exc.CreatedAt.IsZero() {
		exc.CreatedAt = now
	}

	// Check for an existing row so we can detect changes and determine the audit action.
	var existing domain.LEIReportingException
	err := r.db.Where("lei = ? AND exception_category = ?", exc.LEI, exc.ExceptionCategory).
		First(&existing).Error

	if err != nil && err != gorm.ErrRecordNotFound {
		return fmt.Errorf("failed to query existing reporting exception: %w", err)
	}

	isNew := err == gorm.ErrRecordNotFound

	// Assign a stable UUID before insert so we can reference it in the audit record.
	if isNew && exc.ID == uuid.Nil {
		exc.ID = uuid.New()
	}

	// Perform the upsert.
	if upsertErr := r.db.Clauses(clause.OnConflict{
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
	}).Create(exc).Error; upsertErr != nil {
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
			return nil // no actual change – skip audit
		}
		changesJSON, jsonErr := json.Marshal(changes)
		if jsonErr != nil {
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

	return r.CreateReportingExceptionAudit(&audit)
}

// BatchUpsertReportingExceptions inserts or updates reporting exceptions in bulk.
// An audit record is created for every CREATE or UPDATE action, consistent with the
// Level 1 LEI batch audit pattern.
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
		return fmt.Errorf("failed to pre-fetch existing REPEX records: %w", err)
	}
	existingMap := make(map[repexKey]*domain.LEIReportingException, len(existingSlice))
	for idx := range existingSlice {
		existingMap[keyOf(&existingSlice[idx])] = &existingSlice[idx]
	}

	// Use a transaction so records and their audit rows are committed atomically.
	tx := r.db.Begin()
	if tx.Error != nil {
		return tx.Error
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
			"exception_reason",
			"exception_reference",
			"source_file_id",
			"updated_at",
		}),
	}).CreateInBatches(exceptions, 500).Error; err != nil {
		tx.Rollback()
		return err
	}

	// Build audit records.
	audits := make([]domain.LEIReportingExceptionAudit, 0, len(exceptions))
	for _, exc := range exceptions {
		existing, wasExisting := existingMap[keyOf(exc)]

		if !wasExisting {
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
			return fmt.Errorf("failed to marshal REPEX changes: %w", jsonErr)
		}
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
			return fmt.Errorf("failed to create REPEX audit records: %w", err)
		}
	}

	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("failed to commit REPEX batch upsert: %w", err)
	}

	log.Debug().Int("records", len(exceptions)).Int("audits", len(audits)).
		Msg("REPEX batch upsert with audit trail completed")

	return nil
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

// --- helpers ---

// level2ChangeDetection mirrors domain.LEIChangeDetection for Level 2 field diffs.
type level2ChangeDetection struct {
	FieldName string      `json:"field_name"`
	OldValue  interface{} `json:"old_value"`
	NewValue  interface{} `json:"new_value"`
}

// detectRRChanges compares two relationship records and returns the changed fields.
func (r *leiLevel2Repository) detectRRChanges(old, new *domain.LEIRelationshipRecord) map[string]level2ChangeDetection {
	changes := make(map[string]level2ChangeDetection)

	check := func(field string, oldVal, newVal interface{}) {
		switch o := oldVal.(type) {
		case *time.Time:
			n, _ := newVal.(*time.Time)
			oZero := o == nil || o.IsZero()
			nZero := n == nil || n.IsZero()
			if oZero && nZero {
				return
			}
			if (oZero != nZero) || (!oZero && !o.Equal(*n)) {
				changes[field] = level2ChangeDetection{field, oldVal, newVal}
			}
		default:
			if fmt.Sprintf("%v", oldVal) != fmt.Sprintf("%v", newVal) {
				changes[field] = level2ChangeDetection{field, oldVal, newVal}
			}
		}
	}

	check("RelationshipStatus", old.RelationshipStatus, new.RelationshipStatus)
	check("RelationshipPeriods", old.RelationshipPeriods, new.RelationshipPeriods)
	check("RelationshipQualifiers", old.RelationshipQualifiers, new.RelationshipQualifiers)
	check("RelationshipQuantifiers", old.RelationshipQuantifiers, new.RelationshipQuantifiers)
	check("RegistrationStatus", old.RegistrationStatus, new.RegistrationStatus)
	check("InitialRegistrationDate", old.InitialRegistrationDate, new.InitialRegistrationDate)
	check("LastUpdateDate", old.LastUpdateDate, new.LastUpdateDate)
	check("NextRenewalDate", old.NextRenewalDate, new.NextRenewalDate)
	check("ManagingLOU", old.ManagingLOU, new.ManagingLOU)
	check("ValidationSources", old.ValidationSources, new.ValidationSources)
	check("ValidationDocuments", old.ValidationDocuments, new.ValidationDocuments)
	check("ValidationReference", old.ValidationReference, new.ValidationReference)
	check("SourceFileID", old.SourceFileID, new.SourceFileID)

	return changes
}

// detectRepexChanges compares two reporting exceptions and returns the changed fields.
func (r *leiLevel2Repository) detectRepexChanges(old, new *domain.LEIReportingException) map[string]level2ChangeDetection {
	changes := make(map[string]level2ChangeDetection)

	check := func(field, oldVal, newVal string) {
		if oldVal != newVal {
			changes[field] = level2ChangeDetection{field, oldVal, newVal}
		}
	}

	check("ExceptionReason", old.ExceptionReason, new.ExceptionReason)
	check("ExceptionReference", old.ExceptionReference, new.ExceptionReference)

	// Also detect source file change.
	oldSrc := ""
	if old.SourceFileID != nil {
		oldSrc = old.SourceFileID.String()
	}
	newSrc := ""
	if new.SourceFileID != nil {
		newSrc = new.SourceFileID.String()
	}
	if oldSrc != newSrc {
		changes["SourceFileID"] = level2ChangeDetection{"SourceFileID", old.SourceFileID, new.SourceFileID}
	}

	return changes
}

// rrToJSON serialises a relationship record to a JSONBString for audit snapshots.
func (r *leiLevel2Repository) rrToJSON(record *domain.LEIRelationshipRecord) domain.JSONBString {
	data, err := json.Marshal(record)
	if err != nil {
		return domain.JSONBString("{}")
	}
	return domain.JSONBString(data)
}

// repexToJSON serialises a reporting exception to a JSONBString for audit snapshots.
func (r *leiLevel2Repository) repexToJSON(exc *domain.LEIReportingException) domain.JSONBString {
	data, err := json.Marshal(exc)
	if err != nil {
		return domain.JSONBString("{}")
	}
	return domain.JSONBString(data)
}

