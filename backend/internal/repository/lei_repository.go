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
)

// LEIRepository interface
type LEIRepository interface {
	// LEI Record operations
	CreateLEIRecord(record *domain.LEIRecord) error
	FindLEIByLEI(lei string) (*domain.LEIRecord, error)
	FindLEIByID(id string) (*domain.LEIRecord, error)
	FindAllLEI(limit, offset int) ([]*domain.LEIRecord, error)
	FindAllLEIWithFilters(limit, offset int, search, status, category, country, sortBy, sortOrder, columns string) ([]*domain.LEIRecord, error)
	CountLEIRecords() (int64, error)
	GetDistinctCountries() ([]string, error)
	UpdateLEIRecord(record *domain.LEIRecord) error
	UpsertLEIRecord(record *domain.LEIRecord) (bool, error)              // Returns true if updated, false if created
	BatchUpsertLEIRecords(records []*domain.LEIRecord) (int, int, error) // Returns (created, updated, error)
	DeleteLEI(id string) error

	// Source File operations
	CreateSourceFile(file *domain.SourceFile) error
	FindSourceFileByID(id string) (*domain.SourceFile, error)
	FindSourceFileByHash(hash string) (*domain.SourceFile, error)
	FindLatestSourceFile(fileType string) (*domain.SourceFile, error)
	UpdateSourceFile(file *domain.SourceFile) error
	FindPendingSourceFiles() ([]*domain.SourceFile, error)
	FindRetryableFailedFiles() ([]*domain.SourceFile, error)
	ResetFailedFileForRetry(fileID uuid.UUID) error

	// File Processing Status operations
	FindProcessingStatus(jobType string) (*domain.FileProcessingStatus, error)
	UpdateProcessingStatus(status *domain.FileProcessingStatus) error

	// Audit operations
	CreateAuditRecord(audit *domain.LEIRecordAudit) error
	FindAuditHistoryByLEI(lei string, limit int) ([]*domain.LEIRecordAudit, error)
}

type leiRepository struct {
	db *gorm.DB
}

// NewLEIRepository creates a new LEI repository instance
func NewLEIRepository(db *gorm.DB) LEIRepository {
	return &leiRepository{db: db}
}

// CreateLEIRecord creates a new LEI record
func (r *leiRepository) CreateLEIRecord(record *domain.LEIRecord) error {
	return r.db.Create(record).Error
}

// FindLEIByLEI finds an LEI record by LEI code
func (r *leiRepository) FindLEIByLEI(lei string) (*domain.LEIRecord, error) {
	var record domain.LEIRecord
	if err := r.db.Where("lei = ?", lei).Preload("SourceFile").First(&record).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

// FindLEIByID finds an LEI record by ID
func (r *leiRepository) FindLEIByID(id string) (*domain.LEIRecord, error) {
	var record domain.LEIRecord
	if err := r.db.Preload("SourceFile").First(&record, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

// FindAllLEI retrieves all LEI records with pagination
func (r *leiRepository) FindAllLEI(limit, offset int) ([]*domain.LEIRecord, error) {
	var records []*domain.LEIRecord
	if err := r.db.Limit(limit).Offset(offset).Preload("SourceFile").Find(&records).Error; err != nil {
		return nil, err
	}
	return records, nil
}

// isAlphanumeric checks if string contains only letters and numbers
func isAlphanumeric(s string) bool {
	for _, char := range s {
		if !((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9')) {
			return false
		}
	}
	return true
}

// validateColumns validates and filters requested columns against allowed LEI record fields
// Returns validated comma-separated column string or default columns if invalid
func validateColumns(columns string) string {
	// Whitelist of allowed LEI record columns (prevents SQL injection)
	validColumns := map[string]bool{
		"id":                        true,
		"lei":                       true,
		"legal_name":                true,
		"transliterated_legal_name": true,
		"other_names":               true,
		"entity_status":             true,
		"entity_category":           true,
		"entity_sub_category":       true,
		"entity_legal_form":         true,
		"legal_address_line_1":      true,
		"legal_address_line_2":      true,
		"legal_address_line_3":      true,
		"legal_address_line_4":      true,
		"legal_address_city":        true,
		"legal_address_region":      true,
		"legal_address_country":     true,
		"legal_address_postal_code": true,
		"hq_address_line_1":         true,
		"hq_address_line_2":         true,
		"hq_address_line_3":         true,
		"hq_address_line_4":         true,
		"hq_address_city":           true,
		"hq_address_region":         true,
		"hq_address_country":        true,
		"hq_address_postal_code":    true,
		"registration_authority":    true,
		"registration_authority_id": true,
		"registration_number":       true,
		"managing_lou":              true,
		"successor_lei":             true,
		"initial_registration_date": true,
		"last_update_date":          true,
		"next_renewal_date":         true,
		"validation_authority":      true,
		"created_at":                true,
		"updated_at":                true,
	}

	if columns == "" {
		// Default to core columns including other_names for name search display
		return "id,lei,legal_name,other_names,entity_status,entity_category,legal_address_country,last_update_date"
	}

	// Split requested columns and validate each one
	requestedCols := strings.Split(columns, ",")
	validatedCols := make([]string, 0, len(requestedCols))

	for _, col := range requestedCols {
		trimmedCol := strings.TrimSpace(col)
		if validColumns[trimmedCol] {
			validatedCols = append(validatedCols, trimmedCol)
		}
	}

	// If no valid columns found, return defaults
	if len(validatedCols) == 0 {
		return "id,lei,legal_name,entity_status,entity_category,legal_address_country,last_update_date"
	}

	// Always include id if not already present (needed for frontend row keys)
	hasID := false
	for _, col := range validatedCols {
		if col == "id" {
			hasID = true
			break
		}
	}
	if !hasID {
		validatedCols = append([]string{"id"}, validatedCols...)
	}

	return strings.Join(validatedCols, ",")
}

// FindAllLEIWithFilters retrieves LEI records with search and filters
// Uses dynamic SELECT based on requested columns for performance optimization
func (r *leiRepository) FindAllLEIWithFilters(limit, offset int, search, status, category, country, sortBy, sortOrder, columns string) ([]*domain.LEIRecord, error) {
	var records []*domain.LEIRecord
	query := r.db.Limit(limit).Offset(offset)

	// Dynamic SELECT optimization: only fetch requested columns
	// Validates columns against whitelist to prevent SQL injection
	validatedColumns := validateColumns(columns)
	query = query.Select(validatedColumns)

	// Remove Preload for list view - only needed for detail view
	// Saves ~50-100ms per query by not fetching source_file records

	// Apply search filter (LEI code or legal name)
	if search != "" {
		// Optimize search based on pattern:
		// 1. If exactly 20 chars (LEI format), use exact match on LEI only
		// 2. Otherwise, search name fields including other_names JSONB
		if len(search) == 20 && isAlphanumeric(search) {
			// Exact LEI match - uses idx_lei_records_lei B-tree index (< 1ms)
			query = query.Where("lei = ?", search)
		} else {
			// Name search across all name fields including other_names JSONB
			// Uses idx_lei_records_legal_name_trgm GIN index (~20-50ms)
			// JSONB search uses idx_lei_records_other_names_gin index
			searchPattern := "%" + search + "%"
			query = query.Where(
				"legal_name ILIKE ? OR transliterated_legal_name ILIKE ? OR other_names::text ILIKE ?",
				searchPattern, searchPattern, searchPattern,
			)
		}
	}

	// Apply status filter
	if status != "" {
		if status == "NULL" {
			// Filter for records where entity_status IS NULL or empty string
			query = query.Where("entity_status IS NULL OR entity_status = ''")
		} else {
			query = query.Where("entity_status = ?", status)
		}
	}

	// Apply category filter
	if category != "" {
		query = query.Where("entity_category = ?", category)
	}

	// Apply country filter
	if country != "" {
		query = query.Where("legal_address_country = ?", country)
	}

	// Hybrid Approach for Sorting:
	// - No search/filter: ORDER BY updated_at DESC (fast: ~50ms, shows recent updates)
	// - With search/filter: ORDER BY legal_name ASC (fast: filtered result set is small)
	// This eliminates the 1276ms slow query on initial page load (ORDER BY legal_name on 3.2M records)
	hasSearchOrFilter := search != "" || status != "" || category != "" || country != ""

	// Apply sorting
	if sortBy == "" {
		if hasSearchOrFilter {
			// Default to legal_name when user has narrowed results
			sortBy = "legal_name"
			if sortOrder == "" {
				sortOrder = "asc"
			}
		} else {
			// Default to updated_at for browsing all records (Hybrid Approach)
			sortBy = "updated_at"
			if sortOrder == "" {
				sortOrder = "desc"
			}
		}
	} else {
		// sortBy was explicitly provided, validate sortOrder
		if sortOrder == "" || (sortOrder != "asc" && sortOrder != "desc") {
			sortOrder = "asc"
		}
	}

	// Validate sortBy field to prevent SQL injection
	validSortFields := map[string]bool{
		"lei":                   true,
		"legal_name":            true,
		"entity_status":         true,
		"entity_category":       true,
		"legal_address_country": true,
		"last_update_date":      true,
		"updated_at":            true, // Added for Hybrid Approach
	}

	if validSortFields[sortBy] {
		query = query.Order(sortBy + " " + sortOrder)
	} else {
		// Default to updated_at if invalid sort field (Hybrid Approach)
		query = query.Order("updated_at desc")
	}

	if err := query.Find(&records).Error; err != nil {
		return nil, err
	}
	return records, nil
}

// CountLEIRecords returns the total count of LEI records
func (r *leiRepository) CountLEIRecords() (int64, error) {
	var count int64
	if err := r.db.Model(&domain.LEIRecord{}).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// GetDistinctCountries returns a sorted list of unique countries from the LEI database
func (r *leiRepository) GetDistinctCountries() ([]string, error) {
	var countries []string
	err := r.db.Model(&domain.LEIRecord{}).
		Distinct("legal_address_country").
		Where("legal_address_country IS NOT NULL AND legal_address_country != ''").
		Order("legal_address_country ASC").
		Pluck("legal_address_country", &countries).Error
	if err != nil {
		return nil, err
	}
	return countries, nil
}

// UpdateLEIRecord updates an existing LEI record
func (r *leiRepository) UpdateLEIRecord(record *domain.LEIRecord) error {
	return r.db.Save(record).Error
}

// UpsertLEIRecord creates or updates an LEI record with change detection
// Returns true if updated, false if created
func (r *leiRepository) UpsertLEIRecord(record *domain.LEIRecord) (bool, error) {
	existing, err := r.FindLEIByLEI(record.LEI)

	// If not found, create new record
	if err == gorm.ErrRecordNotFound {
		record.CreatedBy = "system"
		record.UpdatedBy = "system"
		if err := r.CreateLEIRecord(record); err != nil {
			return false, err
		}

		// Create audit record for creation
		auditRecord := &domain.LEIRecordAudit{
			LEIRecordID:    record.ID,
			LEI:            record.LEI,
			Action:         "CREATE",
			RecordSnapshot: r.recordToJSON(record),
			ChangedFields:  "{}",
			SourceFileID:   record.SourceFileID,
			ChangedBy:      "system",
		}
		if err := r.CreateAuditRecord(auditRecord); err != nil {
			return false, fmt.Errorf("failed to create audit record: %w", err)
		}

		return false, nil
	}

	if err != nil {
		return false, err
	}

	// Detect changes
	changes := r.detectChanges(existing, record)

	// If no changes detected, don't update
	if len(changes) == 0 {
		return false, nil
	}

	// Convert changes to JSON
	changesJSON, err := json.Marshal(changes)
	if err != nil {
		return false, fmt.Errorf("failed to marshal changes: %w", err)
	}

	// Update the record
	record.ID = existing.ID
	record.CreatedAt = existing.CreatedAt
	record.CreatedBy = existing.CreatedBy
	record.UpdatedBy = "system"
	record.ChangedFields = domain.JSONBString(changesJSON)

	if err := r.UpdateLEIRecord(record); err != nil {
		return false, err
	}

	// Create audit record for update
	auditRecord := &domain.LEIRecordAudit{
		LEIRecordID:    record.ID,
		LEI:            record.LEI,
		Action:         "UPDATE",
		RecordSnapshot: r.recordToJSON(record),
		ChangedFields:  domain.JSONBString(changesJSON),
		SourceFileID:   record.SourceFileID,
		ChangedBy:      "system",
	}
	if err := r.CreateAuditRecord(auditRecord); err != nil {
		return false, fmt.Errorf("failed to create audit record: %w", err)
	}

	return true, nil
}

// BatchUpsertLEIRecords performs batch upsert of LEI records with full audit trail
// Returns (created_count, updated_count, error)
// CRITICAL: Every record operation is audited for data provenance compliance
func (r *leiRepository) BatchUpsertLEIRecords(records []*domain.LEIRecord) (int, int, error) {
	if len(records) == 0 {
		return 0, 0, nil
	}

	// Set created_by and updated_by for all records
	now := time.Now()
	leiCodes := make([]string, len(records))
	for i, record := range records {
		if record.CreatedAt.IsZero() {
			record.CreatedAt = now
		}
		if record.UpdatedAt.IsZero() {
			record.UpdatedAt = now
		}
		if record.CreatedBy == "" {
			record.CreatedBy = "system"
		}
		if record.UpdatedBy == "" {
			record.UpdatedBy = "system"
		}
		leiCodes[i] = record.LEI
	}

	// Fetch full existing records to detect changes (not just LEI codes)
	var existingRecords []domain.LEIRecord
	if err := r.db.Model(&domain.LEIRecord{}).
		Where("lei IN ?", leiCodes).
		Find(&existingRecords).Error; err != nil {
		return 0, 0, fmt.Errorf("failed to query existing records: %w", err)
	}

	// Build map of existing records for fast lookup and change detection
	existingMap := make(map[string]*domain.LEIRecord)
	for i := range existingRecords {
		existingMap[existingRecords[i].LEI] = &existingRecords[i]
	}

	// Use transaction for atomicity: record + audit must succeed together
	tx := r.db.Begin()
	if tx.Error != nil {
		return 0, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	createdCount := 0
	updatedCount := 0

	// Process in batches of 100 for optimal performance
	batchSize := 100
	for i := 0; i < len(records); i += batchSize {
		end := i + batchSize
		if end > len(records) {
			end = len(records)
		}
		batch := records[i:end]

		// Build SQL with RETURNING to get affected record IDs
		valueStrings := make([]string, 0, len(batch))
		valueArgs := make([]interface{}, 0, len(batch)*20)

		// Generate all values in Go, use placeholders for everything
		now := time.Now()
		emptyChangedFields := "{}"

		for _, record := range batch {
			// Use placeholders for ALL fields (41 total)
			valueStrings = append(valueStrings, "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")

			// Generate ID and timestamps in Go
			newID := uuid.New()

			valueArgs = append(valueArgs,
				newID,                          // id
				record.LEI,                     // lei
				record.LegalName,               // legal_name
				record.TransliteratedLegalName, // transliterated_legal_name
				record.OtherNames,              // other_names
				record.LegalAddressLine1,       // legal_address_line_1
				record.LegalAddressLine2,       // legal_address_line_2
				record.LegalAddressLine3,       // legal_address_line_3
				record.LegalAddressLine4,       // legal_address_line_4
				record.LegalAddressCity,        // legal_address_city
				record.LegalAddressRegion,      // legal_address_region
				record.LegalAddressCountry,     // legal_address_country
				record.LegalAddressPostalCode,  // legal_address_postal_code
				record.HQAddressLine1,          // hq_address_line_1
				record.HQAddressLine2,          // hq_address_line_2
				record.HQAddressLine3,          // hq_address_line_3
				record.HQAddressLine4,          // hq_address_line_4
				record.HQAddressCity,           // hq_address_city
				record.HQAddressRegion,         // hq_address_region
				record.HQAddressCountry,        // hq_address_country
				record.HQAddressPostalCode,     // hq_address_postal_code
				record.RegistrationAuthority,   // registration_authority
				record.RegistrationAuthorityID, // registration_authority_id
				record.RegistrationNumber,      // registration_number
				record.EntityCategory,          // entity_category
				record.EntitySubCategory,       // entity_sub_category
				record.EntityLegalForm,         // entity_legal_form
				record.EntityStatus,            // entity_status
				record.SuccessorLEI,            // successor_lei
				record.ValidationAuthority,     // validation_authority
				record.InitialRegistrationDate, // initial_registration_date
				record.LastUpdateDate,          // last_update_date
				record.NextRenewalDate,         // next_renewal_date
				record.ManagingLOU,             // managing_lou
				record.ValidationSources,       // validation_sources
				record.SourceFileID,            // source_file_id
				now,                            // created_at
				now,                            // updated_at
				"system",                       // created_by
				"system",                       // updated_by
				emptyChangedFields,             // changed_fields
			)
		}

		// Execute upsert with RETURNING to get IDs
		stmt := fmt.Sprintf(`
			INSERT INTO lei_raw.lei_records (
				id, lei, legal_name, transliterated_legal_name, other_names,
				legal_address_line_1, legal_address_line_2, legal_address_line_3, legal_address_line_4,
				legal_address_city, legal_address_region, legal_address_country, legal_address_postal_code,
				hq_address_line_1, hq_address_line_2, hq_address_line_3, hq_address_line_4,
				hq_address_city, hq_address_region, hq_address_country, hq_address_postal_code,
				registration_authority, registration_authority_id, registration_number,
				entity_category, entity_sub_category, entity_legal_form,
				entity_status, successor_lei, validation_authority,
				initial_registration_date, last_update_date, next_renewal_date,
				managing_lou, validation_sources,
				source_file_id,
				created_at, updated_at, created_by, updated_by, changed_fields
			) VALUES %s
			ON CONFLICT (lei) DO UPDATE SET
				legal_name = EXCLUDED.legal_name,
				transliterated_legal_name = EXCLUDED.transliterated_legal_name,
				other_names = EXCLUDED.other_names,
				entity_status = EXCLUDED.entity_status,
				legal_address_line_1 = EXCLUDED.legal_address_line_1,
				legal_address_line_2 = EXCLUDED.legal_address_line_2,
				legal_address_line_3 = EXCLUDED.legal_address_line_3,
				legal_address_line_4 = EXCLUDED.legal_address_line_4,
				legal_address_city = EXCLUDED.legal_address_city,
				legal_address_region = EXCLUDED.legal_address_region,
				legal_address_country = EXCLUDED.legal_address_country,
				legal_address_postal_code = EXCLUDED.legal_address_postal_code,
				hq_address_line_1 = EXCLUDED.hq_address_line_1,
				hq_address_line_2 = EXCLUDED.hq_address_line_2,
				hq_address_line_3 = EXCLUDED.hq_address_line_3,
				hq_address_line_4 = EXCLUDED.hq_address_line_4,
				hq_address_city = EXCLUDED.hq_address_city,
				hq_address_region = EXCLUDED.hq_address_region,
				hq_address_country = EXCLUDED.hq_address_country,
				hq_address_postal_code = EXCLUDED.hq_address_postal_code,
				registration_authority = EXCLUDED.registration_authority,
				registration_authority_id = EXCLUDED.registration_authority_id,
				registration_number = EXCLUDED.registration_number,
				entity_category = EXCLUDED.entity_category,
				entity_sub_category = EXCLUDED.entity_sub_category,
				entity_legal_form = EXCLUDED.entity_legal_form,
				successor_lei = EXCLUDED.successor_lei,
				validation_authority = EXCLUDED.validation_authority,
				initial_registration_date = EXCLUDED.initial_registration_date,
				last_update_date = EXCLUDED.last_update_date,
				next_renewal_date = EXCLUDED.next_renewal_date,
				managing_lou = EXCLUDED.managing_lou,
				validation_sources = EXCLUDED.validation_sources,
				source_file_id = EXCLUDED.source_file_id,
				updated_at = NOW(),
				updated_by = 'system'
	`, strings.Join(valueStrings, ","))

		// Execute batch upsert using Exec (better placeholder handling than Raw)
		result := tx.Exec(stmt, valueArgs...)
		if result.Error != nil {
			// Calculate debug info
			stmtPreview := stmt
			if len(stmt) > 2000 {
				stmtPreview = stmt[:2000]
			}

			log.Error().
				Err(result.Error).
				Int("batch_start", i).
				Int("batch_end", end).
				Int("value_args_count", len(valueArgs)).
				Int("expected_per_record", 41).
				Int("records_in_batch", len(batch)).
				Str("stmt_preview", stmtPreview).
				Msg("CRITICAL: Batch upsert failed")
			return 0, 0, fmt.Errorf("failed to batch upsert records %d-%d: %w", i, end, result.Error)
		}

		// Get IDs from valueArgs we just inserted (first value of each record)
		leiToID := make(map[string]uuid.UUID)
		for idx, record := range batch {
			// ID is at position: idx * 41 (since we have 41 values per record)
			idPos := idx * 41
			insertedID := valueArgs[idPos].(uuid.UUID)
			leiToID[record.LEI] = insertedID
		}

		// Build audit records for this batch
		auditRecords := make([]domain.LEIRecordAudit, 0, len(batch))
		for _, record := range batch {
			recordID, exists := leiToID[record.LEI]
			if !exists {
				tx.Rollback()
				return 0, 0, fmt.Errorf("failed to get ID for LEI %s after upsert", record.LEI)
			}

			// Check if this record existed before
			existingRecord, wasExisting := existingMap[record.LEI]

			if !wasExisting {
				// New record - always create audit entry
				createdCount++
				auditRecords = append(auditRecords, domain.LEIRecordAudit{
					LEIRecordID:    recordID,
					LEI:            record.LEI,
					Action:         "CREATE",
					RecordSnapshot: r.recordToJSON(record),
					ChangedFields:  "{}",
					SourceFileID:   record.SourceFileID,
					ChangedBy:      "system",
				})
			} else {
				// Existing record - detect changes
				changes := r.detectChanges(existingRecord, record)

				// Only create audit record if something actually changed
				if len(changes) > 0 {
					updatedCount++

					// Convert changes to JSON
					changesJSON, err := json.Marshal(changes)
					if err != nil {
						tx.Rollback()
						return 0, 0, fmt.Errorf("failed to marshal changes: %w", err)
					}

					auditRecords = append(auditRecords, domain.LEIRecordAudit{
						LEIRecordID:    recordID,
						LEI:            record.LEI,
						Action:         "UPDATE",
						RecordSnapshot: r.recordToJSON(record),
						ChangedFields:  domain.JSONBString(changesJSON),
						SourceFileID:   record.SourceFileID,
						ChangedBy:      "system",
					})
				}
				// If no changes, don't create audit record or increment updatedCount
			}
		}

		// Batch insert audit records (100 at a time)
		auditBatchSize := 100
		for j := 0; j < len(auditRecords); j += auditBatchSize {
			auditEnd := j + auditBatchSize
			if auditEnd > len(auditRecords) {
				auditEnd = len(auditRecords)
			}
			auditBatch := auditRecords[j:auditEnd]

			if err := tx.Create(&auditBatch).Error; err != nil {
				tx.Rollback()
				log.Error().
					Err(err).
					Int("audit_batch_start", j).
					Int("audit_batch_end", auditEnd).
					Msg("CRITICAL: Audit record creation failed")
				return 0, 0, fmt.Errorf("failed to create audit records: %w", err)
			}
		}

		log.Debug().
			Int("batch_start", i).
			Int("batch_end", end).
			Int("records", len(batch)).
			Int("audits", len(auditRecords)).
			Msg("Batch upsert with audit trail completed")
	}

	// Commit transaction: all records + audits persisted together
	if err := tx.Commit().Error; err != nil {
		return 0, 0, fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Info().
		Int("created", createdCount).
		Int("updated", updatedCount).
		Int("total", len(records)).
		Msg("Batch upsert with full audit trail completed successfully")

	return createdCount, updatedCount, nil
}

// DeleteLEI soft deletes an LEI record
func (r *leiRepository) DeleteLEI(id string) error {
	// Get the record before deleting for audit
	record, err := r.FindLEIByID(id)
	if err != nil {
		return err
	}

	// Soft delete
	if err := r.db.Delete(&domain.LEIRecord{}, "id = ?", id).Error; err != nil {
		return err
	}

	// Create audit record for deletion
	auditRecord := &domain.LEIRecordAudit{
		LEIRecordID:    record.ID,
		LEI:            record.LEI,
		Action:         "DELETE",
		RecordSnapshot: r.recordToJSON(record),
		ChangedFields:  "{}",
		ChangedBy:      "system",
	}
	return r.CreateAuditRecord(auditRecord)
}

// CreateSourceFile creates a new source file record
func (r *leiRepository) CreateSourceFile(file *domain.SourceFile) error {
	return r.db.Create(file).Error
}

// FindSourceFileByID finds a source file by ID
func (r *leiRepository) FindSourceFileByID(id string) (*domain.SourceFile, error) {
	var file domain.SourceFile
	if err := r.db.First(&file, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &file, nil
}

// FindSourceFileByHash finds a completed source file by hash
func (r *leiRepository) FindSourceFileByHash(hash string) (*domain.SourceFile, error) {
	var file domain.SourceFile
	if err := r.db.Where("file_hash = ? AND processing_status = ?", hash, "COMPLETED").First(&file).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &file, nil
}

// FindLatestSourceFile finds the latest source file of a given type
func (r *leiRepository) FindLatestSourceFile(fileType string) (*domain.SourceFile, error) {
	var file domain.SourceFile
	if err := r.db.Where("file_type = ?", fileType).Order("publication_date DESC").First(&file).Error; err != nil {
		return nil, err
	}
	return &file, nil
}

// UpdateSourceFile updates a source file record
func (r *leiRepository) UpdateSourceFile(file *domain.SourceFile) error {
	return r.db.Save(file).Error
}

// FindPendingSourceFiles finds all source files pending processing
func (r *leiRepository) FindPendingSourceFiles() ([]*domain.SourceFile, error) {
	var files []*domain.SourceFile
	if err := r.db.Where("processing_status IN ?", []string{"PENDING", "IN_PROGRESS"}).
		Order("publication_date ASC").
		Find(&files).Error; err != nil {
		return nil, err
	}
	return files, nil
}

// FindRetryableFailedFiles finds FAILED files that are eligible for retry
func (r *leiRepository) FindRetryableFailedFiles() ([]*domain.SourceFile, error) {
	var files []*domain.SourceFile
	if err := r.db.Where("processing_status = ? AND retry_count < max_retries", "FAILED").
		Where("failure_category IN ? OR failure_category IS NULL", []string{"SCHEMA_ERROR", "NETWORK_ERROR", "UNKNOWN"}).
		Order("publication_date ASC").
		Find(&files).Error; err != nil {
		return nil, err
	}
	return files, nil
}

// ResetFailedFileForRetry resets a failed file to PENDING for retry
func (r *leiRepository) ResetFailedFileForRetry(fileID uuid.UUID) error {
	return r.db.Model(&domain.SourceFile{}).
		Where("id = ?", fileID).
		Updates(map[string]interface{}{
			"processing_status": "PENDING",
			"retry_count":       gorm.Expr("retry_count + 1"),
			"processing_error":  "",
		}).Error
}

// FindProcessingStatus finds the processing status for a job type
func (r *leiRepository) FindProcessingStatus(jobType string) (*domain.FileProcessingStatus, error) {
	var status domain.FileProcessingStatus
	if err := r.db.Where("job_type = ?", jobType).Preload("CurrentSourceFile").First(&status).Error; err != nil {
		return nil, err
	}
	return &status, nil
}

// UpdateProcessingStatus updates the processing status
func (r *leiRepository) UpdateProcessingStatus(status *domain.FileProcessingStatus) error {
	return r.db.Save(status).Error
}

// CreateAuditRecord creates a new audit record
func (r *leiRepository) CreateAuditRecord(audit *domain.LEIRecordAudit) error {
	return r.db.Create(audit).Error
}

// FindAuditHistoryByLEI retrieves audit history for an LEI
func (r *leiRepository) FindAuditHistoryByLEI(lei string, limit int) ([]*domain.LEIRecordAudit, error) {
	var audits []*domain.LEIRecordAudit
	query := r.db.Where("lei = ?", lei).Order("created_at DESC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	if err := query.Find(&audits).Error; err != nil {
		return nil, err
	}
	return audits, nil
}

// detectChanges compares two LEI records and returns a map of changed fields
func (r *leiRepository) detectChanges(old, new *domain.LEIRecord) map[string]domain.LEIChangeDetection {
	changes := make(map[string]domain.LEIChangeDetection)

	oldVal := reflect.ValueOf(*old)
	newVal := reflect.ValueOf(*new)
	oldType := oldVal.Type()

	for i := 0; i < oldVal.NumField(); i++ {
		field := oldType.Field(i)
		fieldName := field.Name

		// Skip internal fields and timestamps
		if fieldName == "ID" || fieldName == "CreatedAt" || fieldName == "UpdatedAt" ||
			fieldName == "DeletedAt" || fieldName == "CreatedBy" || fieldName == "UpdatedBy" ||
			fieldName == "ChangedFields" || fieldName == "SourceFile" || fieldName == "SourceFileID" {
			continue
		}

		oldFieldVal := oldVal.Field(i).Interface()
		newFieldVal := newVal.Field(i).Interface()

		// Compare values
		if !reflect.DeepEqual(oldFieldVal, newFieldVal) {
			// Special handling for time.Time zero values
			if field.Type == reflect.TypeOf(time.Time{}) {
				oldTime := oldFieldVal.(time.Time)
				newTime := newFieldVal.(time.Time)
				if oldTime.IsZero() && newTime.IsZero() {
					continue
				}
			}

			changes[fieldName] = domain.LEIChangeDetection{
				FieldName: fieldName,
				OldValue:  oldFieldVal,
				NewValue:  newFieldVal,
			}
		}
	}

	return changes
}

// recordToJSON converts an LEI record to JSON string
func (r *leiRepository) recordToJSON(record *domain.LEIRecord) domain.JSONBString {
	jsonBytes, err := json.Marshal(record)
	if err != nil {
		return domain.JSONBString("{}")
	}
	return domain.JSONBString(jsonBytes)
}
