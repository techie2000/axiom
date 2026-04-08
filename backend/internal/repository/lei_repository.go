package repository

import (
	"encoding/json"
	"fmt"
	"reflect"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"github.com/techie2000/axiom/internal/domain"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// LEIRepository interface
type LEIRepository interface {
	// LEI Record operations
	CreateLEIRecord(record *domain.LEIRecord) error
	FindLEIByLEI(lei string) (*domain.LEIRecord, error)
	FindLEIByID(id string) (*domain.LEIRecord, error)
	FindAllLEI(limit, offset int) ([]*domain.LEIRecord, error)
	FindPredecessorLEIsBySuccessor(lei string) ([]*domain.LEIRecord, error)
	FindAllLEIWithFilters(limit, offset int, search, status, category, country, sortBy, sortOrder, columns string, includeLinkedNames bool) ([]*domain.LEIRecord, error)
	CountLEIRecords() (int64, error)
	FindLegalNamesByLEICodes(codes []string) (map[string]string, error)
	GetDistinctCountries() ([]string, error)
	GetDistinctCategories() ([]string, error)
	GetDistinctRegions() ([]string, error)
	GetDistinctLegalForms() ([]string, error)
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

	// Processing failures lifecycle
	CreateProcessingFailure(failure *domain.LEILevel2ProcessingFailure) error
	ResolveOpenProcessingFailures(jobType, naturalKey string, resolvedSourceFileID *uuid.UUID, resolvedNote string) error
	BatchResolveOpenProcessingFailures(jobType string, naturalKeys []string, resolvedSourceFileID *uuid.UUID, resolvedNote string) error
}

type leiRepository struct {
	db *gorm.DB
}

const notSetEntityStatusWhereClause = "entity_status IS NULL OR TRIM(entity_status) = '' OR UPPER(TRIM(entity_status)) = 'NULL'"
const normalizedEntityCategoryMatchWhereClause = "UPPER(BTRIM(entity_category)) = UPPER(BTRIM(?))"

const singleRecordResolvedNamesSelectFragment = "" +
	", (SELECT ref.legal_name FROM lei_raw.lei_records ref WHERE ref.lei = lei_raw.lei_records.managing_lou LIMIT 1) AS managing_lou_legal_name" +
	", (SELECT ref.legal_name FROM lei_raw.lei_records ref WHERE ref.lei = lei_raw.lei_records.successor_lei LIMIT 1) AS successor_lei_legal_name" +
	", (SELECT ra.organization_name FROM lei_raw.gleif_registration_authorities ra" +
	"   WHERE ra.ra_id = lei_raw.lei_records.registration_authority AND ra.active = TRUE LIMIT 1) AS registration_authority_name" +
	", (SELECT ra.international_name FROM lei_raw.gleif_registration_authorities ra" +
	"   WHERE ra.ra_id = lei_raw.lei_records.registration_authority AND ra.active = TRUE LIMIT 1) AS registration_authority_international_name" +
	", (SELECT ra.website FROM lei_raw.gleif_registration_authorities ra" +
	"   WHERE ra.ra_id = lei_raw.lei_records.registration_authority AND ra.active = TRUE LIMIT 1) AS registration_authority_website" +
	", (SELECT ra.comments FROM lei_raw.gleif_registration_authorities ra" +
	"   WHERE ra.ra_id = lei_raw.lei_records.registration_authority AND ra.active = TRUE LIMIT 1) AS registration_authority_comments" +
	", (SELECT elf.entity_legal_form_name FROM lei_raw.gleif_entity_legal_forms elf" +
	"   WHERE elf.elf_code = lei_raw.lei_records.entity_legal_form LIMIT 1) AS entity_legal_form_name"

// exactLEIMatchWhereClause matches a record by its primary LEI or its successor LEI.
// The successor branch includes the partial-index predicate so PostgreSQL can use
// idx_lei_raw_lei_records_successor_lei instead of falling back to sequential scans.
// Used when the search string is exactly 20 alphanumeric characters (LEI format).
const exactLEIMatchWhereClause = "(lei = ? OR (successor_lei = ? AND successor_lei IS NOT NULL AND BTRIM(successor_lei) <> ''))"

// likePatternLEISearchWhereClause matches a record by legal name, primary LEI,
// successor LEI, or other names using case-insensitive LIKE patterns.
// Used as a fallback when the search_vector column is unavailable.
const likePatternLEISearchWhereClause = "(legal_name ILIKE ? OR lei ILIKE ? OR successor_lei ILIKE ? OR COALESCE(other_names::text, '') ILIKE ?)"

// leiValidSortFields is the allowlist of actual lei_raw.lei_records database columns that may
// be used as ORDER BY targets. Only columns physically present in the table are listed; virtual
// or computed columns (e.g. country_flag, registration_authority_name) must NOT appear here.
// This prevents SQL-injection via the sort_by query parameter (#268).
var leiValidSortFields = map[string]bool{
	// Identity
	"lei":                       true,
	"legal_name":                true,
	"transliterated_legal_name": true,
	// Entity classification
	"entity_status":       true,
	"entity_category":     true,
	"entity_sub_category": true,
	"entity_legal_form":   true,
	// Legal address
	"legal_address_line_1":      true,
	"legal_address_line_2":      true,
	"legal_address_line_3":      true,
	"legal_address_line_4":      true,
	"legal_address_city":        true,
	"legal_address_region":      true,
	"legal_address_country":     true,
	"legal_address_postal_code": true,
	// HQ address
	"hq_address_line_1":      true,
	"hq_address_line_2":      true,
	"hq_address_line_3":      true,
	"hq_address_line_4":      true,
	"hq_address_city":        true,
	"hq_address_region":      true,
	"hq_address_country":     true,
	"hq_address_postal_code": true,
	// Registration
	"registration_authority":    true,
	"registration_number":       true,
	"initial_registration_date": true,
	"next_renewal_date":         true,
	// Relationships
	"managing_lou":         true,
	"successor_lei":        true,
	"validation_authority": true,
	// Timestamps
	"last_update_date": true,
	"updated_at":       true,
}

func isNotSetStatusFilter(status string) bool {
	normalized := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(status), " ", "_"))
	return normalized == "NULL" || normalized == "NOT_SET"
}

func nullableLEICode(value string) interface{} {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return nil
	}

	return normalized
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
	err := r.db.
		Select("lei_raw.lei_records.*"+singleRecordResolvedNamesSelectFragment).
		Where("lei_raw.lei_records.lei = ?", strings.TrimSpace(lei)).
		Preload("SourceFile").
		First(&record).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}

// FindLEIByID finds an LEI record by ID
func (r *leiRepository) FindLEIByID(id string) (*domain.LEIRecord, error) {
	var record domain.LEIRecord
	err := r.db.
		Select("lei_raw.lei_records.*"+singleRecordResolvedNamesSelectFragment).
		Preload("SourceFile").
		First(&record, "lei_raw.lei_records.id = ?", id).Error
	if err != nil {
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

// FindLegalNamesByLEICodes retrieves legal names for a batch of LEI codes in a single query.
// Returns a map of LEI code → legal name for codes that exist in the database.
func (r *leiRepository) FindLegalNamesByLEICodes(codes []string) (map[string]string, error) {
	if len(codes) == 0 {
		return map[string]string{}, nil
	}

	type row struct {
		LEI       string
		LegalName string
	}

	var rows []row
	if err := r.db.Model(&domain.LEIRecord{}).
		Select("lei, legal_name").
		Where("lei IN ?", codes).
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	names := make(map[string]string, len(rows))
	for _, row := range rows {
		names[row.LEI] = row.LegalName
	}

	return names, nil
}

// FindPredecessorLEIsBySuccessor retrieves LEI records that point to the provided LEI as successor.
func (r *leiRepository) FindPredecessorLEIsBySuccessor(lei string) ([]*domain.LEIRecord, error) {
	var records []*domain.LEIRecord
	normalizedLEI := strings.ToUpper(strings.TrimSpace(lei))
	if normalizedLEI == "" {
		return records, nil
	}

	if err := r.db.
		Select("id, lei, legal_name, successor_lei, updated_at").
		Where("successor_lei = ? AND successor_lei IS NOT NULL AND BTRIM(successor_lei) <> ''", normalizedLEI).
		Order("updated_at desc").
		Find(&records).Error; err != nil {
		return nil, err
	}

	return records, nil
}

// isAlphanumeric checks if string contains only letters and numbers
func isAlphanumeric(s string) bool {
	for _, char := range s {
		if (char < 'a' || char > 'z') && (char < 'A' || char > 'Z') && (char < '0' || char > '9') {
			return false
		}
	}
	return true
}

func normalizeExactLEISearchInput(search string) string {
	return strings.ToUpper(strings.TrimSpace(search))
}

// validateColumns validates and filters requested columns against allowed LEI record fields
// Returns validated select columns or defaults if invalid.
func validateColumns(columns string) []clause.Column {
	toClauseColumns := func(names []string) []clause.Column {
		result := make([]clause.Column, 0, len(names))
		for _, name := range names {
			result = append(result, clause.Column{Name: name})
		}
		return result
	}

	defaultColumns := []string{
		"id",
		"lei",
		"legal_name",
		"other_names",
		"entity_status",
		"entity_category",
		"legal_address_country",
		"last_update_date",
	}

	fallbackColumns := []string{
		"id",
		"lei",
		"legal_name",
		"entity_status",
		"entity_category",
		"legal_address_country",
		"last_update_date",
	}

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
		return toClauseColumns(defaultColumns)
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
		return toClauseColumns(fallbackColumns)
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

	return toClauseColumns(validatedCols)
}

func ensureLinkedLEICodeColumns(columns []clause.Column) []clause.Column {
	const managingLOUColumn = "managing_lou"
	const successorLEIColumn = "successor_lei"

	hasManagingLOU := false
	hasSuccessorLEI := false

	for _, col := range columns {
		switch col.Name {
		case managingLOUColumn:
			hasManagingLOU = true
		case successorLEIColumn:
			hasSuccessorLEI = true
		}
	}

	if !hasManagingLOU {
		columns = append(columns, clause.Column{Name: managingLOUColumn})
	}
	if !hasSuccessorLEI {
		columns = append(columns, clause.Column{Name: successorLEIColumn})
	}

	return columns
}

func applyLinkedLEINames(records []*domain.LEIRecord, namesByCode map[string]string) {
	for _, record := range records {
		record.ManagingLOULegalName = namesByCode[strings.TrimSpace(record.ManagingLOU)]
		record.SuccessorLEILegalName = namesByCode[strings.TrimSpace(record.SuccessorLEI)]
	}
}

func (r *leiRepository) hydrateLinkedLEINames(records []*domain.LEIRecord) error {
	if len(records) == 0 {
		return nil
	}

	codeSet := make(map[string]struct{})
	for _, record := range records {
		if code := strings.TrimSpace(record.ManagingLOU); code != "" {
			codeSet[code] = struct{}{}
		}
		if code := strings.TrimSpace(record.SuccessorLEI); code != "" {
			codeSet[code] = struct{}{}
		}
	}

	if len(codeSet) == 0 {
		return nil
	}

	codes := make([]string, 0, len(codeSet))
	for code := range codeSet {
		codes = append(codes, code)
	}

	namesByCode, err := r.FindLegalNamesByLEICodes(codes)
	if err != nil {
		return err
	}

	applyLinkedLEINames(records, namesByCode)

	return nil
}

// raDetailRow is a lightweight projection used during batch RA hydration.
type raDetailRow struct {
	RAID              string `gorm:"column:ra_id"`
	OrganizationName  string `gorm:"column:organization_name"`
	InternationalName string `gorm:"column:international_name"`
	Website           string `gorm:"column:website"`
	Comments          string `gorm:"column:comments"`
}

// hydrateRADetails batch-fetches registration authority details (name, international
// name, website, comments) for all distinct RA codes in records and applies them
// in-place. A single DB round-trip replaces N correlated subqueries.
func (r *leiRepository) hydrateRADetails(records []*domain.LEIRecord) error {
	if len(records) == 0 {
		return nil
	}

	codeSet := make(map[string]struct{})
	for _, rec := range records {
		if code := strings.TrimSpace(rec.RegistrationAuthority); code != "" {
			codeSet[code] = struct{}{}
		}
	}
	if len(codeSet) == 0 {
		return nil
	}

	codes := make([]string, 0, len(codeSet))
	for code := range codeSet {
		codes = append(codes, code)
	}

	var rows []raDetailRow
	if err := r.db.
		Table("lei_raw.gleif_registration_authorities").
		Select("ra_id, organization_name, international_name, website, comments").
		Where("ra_id IN ? AND active = TRUE", codes).
		Find(&rows).Error; err != nil {
		return err
	}

	applyRADetails(records, rows)
	return nil
}

func applyRADetails(records []*domain.LEIRecord, rows []raDetailRow) {
	byCode := make(map[string]raDetailRow, len(rows))
	for _, row := range rows {
		byCode[row.RAID] = row
	}

	for _, rec := range records {
		code := strings.TrimSpace(rec.RegistrationAuthority)
		if code == "" {
			continue
		}
		if row, ok := byCode[code]; ok {
			rec.RegistrationAuthorityName = row.OrganizationName
			rec.RegistrationAuthorityInternationalName = row.InternationalName
			rec.RegistrationAuthorityWebsite = row.Website
			rec.RegistrationAuthorityComments = row.Comments
		}
	}
}

// elfNameRow is a lightweight projection used during batch ELF hydration.
type elfNameRow struct {
	ELFCode             string `gorm:"column:elf_code"`
	EntityLegalFormName string `gorm:"column:entity_legal_form_name"`
}

// hydrateELFNames batch-fetches entity legal form names for all distinct ELF
// codes in records and applies them in-place.
func (r *leiRepository) hydrateELFNames(records []*domain.LEIRecord) error {
	if len(records) == 0 {
		return nil
	}

	codeSet := make(map[string]struct{})
	for _, rec := range records {
		if code := strings.TrimSpace(rec.EntityLegalForm); code != "" {
			codeSet[code] = struct{}{}
		}
	}
	if len(codeSet) == 0 {
		return nil
	}

	codes := make([]string, 0, len(codeSet))
	for code := range codeSet {
		codes = append(codes, code)
	}

	var rows []elfNameRow
	if err := r.db.
		Table("lei_raw.gleif_entity_legal_forms").
		Select("elf_code, entity_legal_form_name").
		Where("elf_code IN ?", codes).
		Find(&rows).Error; err != nil {
		return err
	}

	applyELFNames(records, rows)
	return nil
}

func applyELFNames(records []*domain.LEIRecord, rows []elfNameRow) {
	byCode := make(map[string]string, len(rows))
	for _, row := range rows {
		byCode[row.ELFCode] = row.EntityLegalFormName
	}

	for _, rec := range records {
		if code := strings.TrimSpace(rec.EntityLegalForm); code != "" {
			rec.EntityLegalFormName = byCode[code]
		}
	}
}


// Uses dynamic SELECT based on requested columns for performance optimization
func (r *leiRepository) FindAllLEIWithFilters(limit, offset int, search, status, category, country, sortBy, sortOrder, columns string, includeLinkedNames bool) ([]*domain.LEIRecord, error) {
	var records []*domain.LEIRecord
	buildQuery := func(useSearchVector bool) *gorm.DB {
		query := r.db.Limit(limit).Offset(offset)

		// Dynamic SELECT optimization: only fetch requested columns
		// Validates columns against whitelist and emits structured columns.
		validatedColumns := validateColumns(columns)
		if includeLinkedNames {
			validatedColumns = ensureLinkedLEICodeColumns(validatedColumns)
		}
		query = query.Clauses(clause.Select{Columns: validatedColumns})

		// Remove Preload for list view - only needed for detail view
		// Saves ~50-100ms per query by not fetching source_file records

		// Apply search filter (LEI code or legal name)
		if search != "" {
			trimmedSearch := strings.TrimSpace(search)
			// Optimize search based on pattern:
			// 1. If exactly 20 chars (LEI format), use exact match on primary or successor LEI
			// 2. Otherwise, search name fields including other_names JSONB
			if len(trimmedSearch) == 20 && isAlphanumeric(trimmedSearch) {
				normalizedSearch := normalizeExactLEISearchInput(trimmedSearch)
				// Exact LEI match - also checks successor_lei so users can search by successor
				// Uses idx_lei_records_lei B-tree index on the primary lei column (< 1ms)
				query = query.Where(exactLEIMatchWhereClause, normalizedSearch, normalizedSearch)
			} else if useSearchVector {
				// Full-text search using the composite search_vector column
				// Uses idx_lei_records_search_vector GIN index for single efficient lookup
				query = query.Where(
					"search_vector @@ plainto_tsquery('simple', ?)",
					trimmedSearch,
				)
			} else {
				searchPattern := "%" + trimmedSearch + "%"
				query = query.Where(
					likePatternLEISearchWhereClause,
					searchPattern,
					searchPattern,
					searchPattern,
					searchPattern,
				)
			}
		}

		// Apply status filter
		if status != "" {
			if isNotSetStatusFilter(status) {
				// Filter for records where entity_status is missing or represented as literal "NULL"
				query = query.Where(notSetEntityStatusWhereClause)
			} else {
				query = query.Where("entity_status = ?", status)
			}
		}

		// Apply category filter
		if category != "" {
			query = query.Where(normalizedEntityCategoryMatchWhereClause, category)
		}

		// Apply country filter
		if country != "" {
			query = query.Where("legal_address_country = ?", country)
		}

		// Hybrid Approach for Sorting:
		// - No search/filter: ORDER BY updated_at DESC (fast: ~50ms, shows recent updates)
		// - With search/filter: ORDER BY legal_name ASC (fast: filtered result set is small)
		hasSearchOrFilter := search != "" || status != "" || category != "" || country != ""

		resolvedSortBy := sortBy
		resolvedSortOrder := sortOrder

		// Apply sorting
		if resolvedSortBy == "" {
			if hasSearchOrFilter {
				// Default to legal_name when user has narrowed results
				resolvedSortBy = "legal_name"
				if resolvedSortOrder == "" {
					resolvedSortOrder = "asc"
				}
			} else {
				// Default to updated_at for browsing all records (Hybrid Approach)
				resolvedSortBy = "updated_at"
				if resolvedSortOrder == "" {
					resolvedSortOrder = "desc"
				}
			}
		} else {
			// sortBy was explicitly provided, validate sortOrder
			if resolvedSortOrder == "" || (resolvedSortOrder != "asc" && resolvedSortOrder != "desc") {
				resolvedSortOrder = "asc"
			}
		}

		// Validate sortBy field to prevent SQL injection; see leiValidSortFields (#268).
		if leiValidSortFields[resolvedSortBy] {
			query = query.Order(clause.OrderByColumn{
				Column: clause.Column{Name: resolvedSortBy},
				Desc:   resolvedSortOrder == "desc",
			})
		} else {
			query = query.Order(clause.OrderByColumn{
				Column: clause.Column{Name: "updated_at"},
				Desc:   true,
			})
		}

		return query
	}

	query := buildQuery(true)
	if err := query.Find(&records).Error; err != nil {
		errMsg := strings.ToLower(err.Error())
		isNonLEISearch := search != "" && (len(search) != 20 || !isAlphanumeric(search))
		if isNonLEISearch && strings.Contains(errMsg, "search_vector") && strings.Contains(errMsg, "does not exist") {
			records = nil
			fallbackQuery := buildQuery(false)
			if fallbackErr := fallbackQuery.Find(&records).Error; fallbackErr != nil {
				return nil, fallbackErr
			}
			if includeLinkedNames {
				if hydrateErr := r.hydrateLinkedLEINames(records); hydrateErr != nil {
					return nil, hydrateErr
				}
			}
			if hydrateErr := r.hydrateRADetails(records); hydrateErr != nil {
				return nil, hydrateErr
			}
			if hydrateErr := r.hydrateELFNames(records); hydrateErr != nil {
				return nil, hydrateErr
			}
			return records, nil
		}
		return nil, err
	}
	if includeLinkedNames {
		if hydrateErr := r.hydrateLinkedLEINames(records); hydrateErr != nil {
			return nil, hydrateErr
		}
	}
	if hydrateErr := r.hydrateRADetails(records); hydrateErr != nil {
		return nil, hydrateErr
	}
	if hydrateErr := r.hydrateELFNames(records); hydrateErr != nil {
		return nil, hydrateErr
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

// GetDistinctCategories returns a sorted list of unique category values from LEI records
func (r *leiRepository) GetDistinctCategories() ([]string, error) {
	var categories []string
	err := r.db.Model(&domain.LEIRecord{}).
		Distinct("BTRIM(entity_category)").
		Where("entity_category IS NOT NULL AND BTRIM(entity_category) <> '' AND UPPER(BTRIM(entity_category)) <> 'NULL'").
		Order("BTRIM(entity_category) ASC").
		Pluck("BTRIM(entity_category)", &categories).Error
	if err != nil {
		return nil, err
	}
	return categories, nil
}

// GetDistinctRegions returns sorted unique region values from legal and HQ addresses
func (r *leiRepository) GetDistinctRegions() ([]string, error) {
	regionsMap := make(map[string]struct{})

	var legalRegions []string
	if err := r.db.Model(&domain.LEIRecord{}).
		Distinct("BTRIM(legal_address_region)").
		Where("legal_address_region IS NOT NULL AND BTRIM(legal_address_region) <> ''").
		Order("BTRIM(legal_address_region) ASC").
		Pluck("BTRIM(legal_address_region)", &legalRegions).Error; err != nil {
		return nil, err
	}

	for _, region := range legalRegions {
		trimmed := strings.TrimSpace(region)
		if trimmed != "" {
			regionsMap[trimmed] = struct{}{}
		}
	}

	var hqRegions []string
	if err := r.db.Model(&domain.LEIRecord{}).
		Distinct("BTRIM(hq_address_region)").
		Where("hq_address_region IS NOT NULL AND BTRIM(hq_address_region) <> ''").
		Order("BTRIM(hq_address_region) ASC").
		Pluck("BTRIM(hq_address_region)", &hqRegions).Error; err != nil {
		return nil, err
	}

	for _, region := range hqRegions {
		trimmed := strings.TrimSpace(region)
		if trimmed != "" {
			regionsMap[trimmed] = struct{}{}
		}
	}

	regions := make([]string, 0, len(regionsMap))
	for region := range regionsMap {
		regions = append(regions, region)
	}

	if len(regions) > 0 {
		sort.Strings(regions)
	}

	return regions, nil
}

// GetDistinctLegalForms returns a sorted list of unique legal form values
func (r *leiRepository) GetDistinctLegalForms() ([]string, error) {
	var legalForms []string
	err := r.db.Model(&domain.LEIRecord{}).
		Distinct("BTRIM(entity_legal_form)").
		Where("entity_legal_form IS NOT NULL AND BTRIM(entity_legal_form) <> ''").
		Order("BTRIM(entity_legal_form) ASC").
		Pluck("BTRIM(entity_legal_form)", &legalForms).Error
	if err != nil {
		return nil, err
	}
	return legalForms, nil
}

// UpdateLEIRecord updates an existing LEI record
func (r *leiRepository) UpdateLEIRecord(record *domain.LEIRecord) error {
	return r.db.Save(record).Error
}

// UpsertLEIRecord creates or updates an LEI record with change detection.
// Returns true if updated, false if created.
// The select, upsert, and audit insert are wrapped in a single transaction for atomicity,
// consistent with BatchUpsertLEIRecords and the Level 2 single-upsert pattern.
func (r *leiRepository) UpsertLEIRecord(record *domain.LEIRecord) (bool, error) {
	tx := r.db.Begin()
	if tx.Error != nil {
		return false, tx.Error
	}
	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p) // re-panic after rollback so the caller sees the failure
		}
	}()

	// Check for an existing row inside the transaction.
	var existing domain.LEIRecord
	err := tx.Where("lei = ?", record.LEI).Preload("SourceFile").First(&existing).Error

	if err != nil && err != gorm.ErrRecordNotFound {
		tx.Rollback()
		return false, err
	}

	if err == gorm.ErrRecordNotFound {
		// New record – insert it.
		record.CreatedBy = "system"
		record.UpdatedBy = "system"
		if createErr := tx.Create(record).Error; createErr != nil {
			tx.Rollback()
			return false, createErr
		}

		auditRecord := &domain.LEIRecordAudit{
			LEIRecordID:    record.ID,
			LEI:            record.LEI,
			Action:         "CREATE",
			RecordSnapshot: r.recordToJSON(record),
			ChangedFields:  "{}",
			SourceFileID:   record.SourceFileID,
			ChangedBy:      "system",
		}
		if auditErr := tx.Create(auditRecord).Error; auditErr != nil {
			tx.Rollback()
			return false, fmt.Errorf("failed to create audit record: %w", auditErr)
		}

		return false, tx.Commit().Error
	}

	// Detect changes between the existing and new record.
	changes := r.detectChanges(&existing, record)
	if len(changes) == 0 {
		// No meaningful change – rollback the no-op and return.
		tx.Rollback()
		return false, nil
	}

	changesJSON, err := json.Marshal(changes)
	if err != nil {
		tx.Rollback()
		return false, fmt.Errorf("failed to marshal changes: %w", err)
	}

	// Preserve immutable fields from the existing record before saving.
	record.ID = existing.ID
	record.CreatedAt = existing.CreatedAt
	record.CreatedBy = existing.CreatedBy
	record.UpdatedBy = "system"
	record.ChangedFields = domain.JSONBString(changesJSON)

	if saveErr := tx.Save(record).Error; saveErr != nil {
		tx.Rollback()
		return false, saveErr
	}

	auditRecord := &domain.LEIRecordAudit{
		LEIRecordID:    record.ID,
		LEI:            record.LEI,
		Action:         "UPDATE",
		RecordSnapshot: r.recordToJSON(record),
		ChangedFields:  domain.JSONBString(changesJSON),
		SourceFileID:   record.SourceFileID,
		ChangedBy:      "system",
	}
	if auditErr := tx.Create(auditRecord).Error; auditErr != nil {
		tx.Rollback()
		return false, fmt.Errorf("failed to create audit record: %w", auditErr)
	}

	return true, tx.Commit().Error
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
	for _, record := range records {
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

		// Fetch existing records only for this batch to avoid huge IN clauses and reduce memory pressure
		batchLEICodes := make([]string, len(batch))
		for idx, record := range batch {
			batchLEICodes[idx] = record.LEI
		}

		var existingRecords []domain.LEIRecord
		if err := tx.Model(&domain.LEIRecord{}).
			Where("lei IN ?", batchLEICodes).
			Find(&existingRecords).Error; err != nil {
			tx.Rollback()
			return 0, 0, fmt.Errorf("failed to query existing records for batch %d-%d: %w", i, end, err)
		}

		existingMap := make(map[string]*domain.LEIRecord, len(existingRecords))
		for idx := range existingRecords {
			existingMap[existingRecords[idx].LEI] = &existingRecords[idx]
		}

		// Build SQL with RETURNING to get affected record IDs
		valueStrings := make([]string, 0, len(batch))
		valueArgs := make([]interface{}, 0, len(batch)*42)

		// Generate all values in Go, use placeholders for everything
		now := time.Now()
		emptyChangedFields := "{}"

		for _, record := range batch {
			// Use placeholders for ALL fields (41 total)
			valueStrings = append(valueStrings, "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")

			// Generate ID and timestamps in Go
			newID := uuid.New()

			valueArgs = append(valueArgs,
				newID,                                // id
				record.LEI,                           // lei
				record.LegalName,                     // legal_name
				record.TransliteratedLegalName,       // transliterated_legal_name
				record.OtherNames,                    // other_names
				record.LegalAddressLine1,             // legal_address_line_1
				record.LegalAddressLine2,             // legal_address_line_2
				record.LegalAddressLine3,             // legal_address_line_3
				record.LegalAddressLine4,             // legal_address_line_4
				record.LegalAddressCity,              // legal_address_city
				record.LegalAddressRegion,            // legal_address_region
				record.LegalAddressCountry,           // legal_address_country
				record.LegalAddressPostalCode,        // legal_address_postal_code
				record.HQAddressLine1,                // hq_address_line_1
				record.HQAddressLine2,                // hq_address_line_2
				record.HQAddressLine3,                // hq_address_line_3
				record.HQAddressLine4,                // hq_address_line_4
				record.HQAddressCity,                 // hq_address_city
				record.HQAddressRegion,               // hq_address_region
				record.HQAddressCountry,              // hq_address_country
				record.HQAddressPostalCode,           // hq_address_postal_code
				record.RegistrationAuthority,         // registration_authority
				record.RegistrationAuthorityID,       // registration_authority_id
				record.RegistrationNumber,            // registration_number
				record.EntityCategory,                // entity_category
				record.EntitySubCategory,             // entity_sub_category
				record.EntityLegalForm,               // entity_legal_form
				record.EntityStatus,                  // entity_status
				nullableLEICode(record.SuccessorLEI), // successor_lei
				record.ValidationAuthority,           // validation_authority
				record.InitialRegistrationDate,       // initial_registration_date
				record.LastUpdateDate,                // last_update_date
				record.NextRenewalDate,               // next_renewal_date
				record.ManagingLOU,                   // managing_lou
				record.ValidationSources,             // validation_sources
				record.SourceFileID,                  // source_file_id
				now,                                  // created_at
				now,                                  // updated_at
				"system",                             // created_by
				"system",                             // updated_by
				emptyChangedFields,                   // changed_fields
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
			WHERE
			(
				lei_raw.lei_records.legal_name,
				lei_raw.lei_records.transliterated_legal_name,
				lei_raw.lei_records.other_names,
				lei_raw.lei_records.entity_status,
				lei_raw.lei_records.legal_address_line_1,
				lei_raw.lei_records.legal_address_line_2,
				lei_raw.lei_records.legal_address_line_3,
				lei_raw.lei_records.legal_address_line_4,
				lei_raw.lei_records.legal_address_city,
				lei_raw.lei_records.legal_address_region,
				lei_raw.lei_records.legal_address_country,
				lei_raw.lei_records.legal_address_postal_code,
				lei_raw.lei_records.hq_address_line_1,
				lei_raw.lei_records.hq_address_line_2,
				lei_raw.lei_records.hq_address_line_3,
				lei_raw.lei_records.hq_address_line_4,
				lei_raw.lei_records.hq_address_city,
				lei_raw.lei_records.hq_address_region,
				lei_raw.lei_records.hq_address_country,
				lei_raw.lei_records.hq_address_postal_code,
				lei_raw.lei_records.registration_authority,
				lei_raw.lei_records.registration_authority_id,
				lei_raw.lei_records.registration_number,
				lei_raw.lei_records.entity_category,
				lei_raw.lei_records.entity_sub_category,
				lei_raw.lei_records.entity_legal_form,
				lei_raw.lei_records.successor_lei,
				lei_raw.lei_records.validation_authority,
				lei_raw.lei_records.initial_registration_date,
				lei_raw.lei_records.last_update_date,
				lei_raw.lei_records.next_renewal_date,
				lei_raw.lei_records.managing_lou,
				lei_raw.lei_records.validation_sources,
				lei_raw.lei_records.source_file_id
			) IS DISTINCT FROM (
				EXCLUDED.legal_name,
				EXCLUDED.transliterated_legal_name,
				EXCLUDED.other_names,
				EXCLUDED.entity_status,
				EXCLUDED.legal_address_line_1,
				EXCLUDED.legal_address_line_2,
				EXCLUDED.legal_address_line_3,
				EXCLUDED.legal_address_line_4,
				EXCLUDED.legal_address_city,
				EXCLUDED.legal_address_region,
				EXCLUDED.legal_address_country,
				EXCLUDED.legal_address_postal_code,
				EXCLUDED.hq_address_line_1,
				EXCLUDED.hq_address_line_2,
				EXCLUDED.hq_address_line_3,
				EXCLUDED.hq_address_line_4,
				EXCLUDED.hq_address_city,
				EXCLUDED.hq_address_region,
				EXCLUDED.hq_address_country,
				EXCLUDED.hq_address_postal_code,
				EXCLUDED.registration_authority,
				EXCLUDED.registration_authority_id,
				EXCLUDED.registration_number,
				EXCLUDED.entity_category,
				EXCLUDED.entity_sub_category,
				EXCLUDED.entity_legal_form,
				EXCLUDED.successor_lei,
				EXCLUDED.validation_authority,
				EXCLUDED.initial_registration_date,
				EXCLUDED.last_update_date,
				EXCLUDED.next_renewal_date,
				EXCLUDED.managing_lou,
				EXCLUDED.validation_sources,
				EXCLUDED.source_file_id
			)
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
	if file == nil {
		return fmt.Errorf("source file is nil")
	}

	updates := map[string]interface{}{
		"processing_status": file.ProcessingStatus,
		"total_records":     file.TotalRecords,
		"processed_records": file.ProcessedRecords,
		"failed_records":    file.FailedRecords,
		"last_processed_lei": func() interface{} {
			if file.LastProcessedLEI == nil {
				return nil
			}
			return nullableLEICode(*file.LastProcessedLEI)
		}(),
		"processing_started_at":   file.ProcessingStartedAt,
		"processing_completed_at": file.ProcessingCompletedAt,
		"processing_error":        file.ProcessingError,
		"retry_count":             file.RetryCount,
		"max_retries":             file.MaxRetries,
		"failure_category":        file.FailureCategory,
		"updated_at":              gorm.Expr("NOW()"),
	}

	return r.db.Model(&domain.SourceFile{}).
		Where("id = ?", file.ID).
		Updates(updates).Error
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
	if status == nil {
		return fmt.Errorf("status is nil")
	}

	if status.ID == uuid.Nil {
		return r.db.Omit("CurrentSourceFile").Create(status).Error
	}

	updates := map[string]interface{}{
		"job_type":               status.JobType,
		"job_label":              status.JobLabel,
		"status":                 status.Status,
		"last_run_at":            status.LastRunAt,
		"next_run_at":            status.NextRunAt,
		"last_success_at":        status.LastSuccessAt,
		"depends_on_job_label":   status.DependsOnJobLabel,
		"current_source_file_id": status.CurrentSourceFileID,
		"depends_on_job_type":    status.DependsOnJobType,
		"error_message":          status.ErrorMessage,
		"progress_message":       status.ProgressMessage,
		"updated_at":             gorm.Expr("NOW()"),
	}

	return r.db.Model(&domain.FileProcessingStatus{}).
		Where("id = ?", status.ID).
		Updates(updates).Error
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

// CreateProcessingFailure persists a processing failure event row.
func (r *leiRepository) CreateProcessingFailure(failure *domain.LEILevel2ProcessingFailure) error {
	return r.db.Create(failure).Error
}

// ResolveOpenProcessingFailures marks unresolved failure rows for the same natural key as resolved.
func (r *leiRepository) ResolveOpenProcessingFailures(jobType, naturalKey string, resolvedSourceFileID *uuid.UUID, resolvedNote string) error {
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

// BatchResolveOpenProcessingFailures marks unresolved failure rows for the given set of natural
// keys as resolved with a single UPDATE … WHERE natural_key IN (…) query, replacing the N
// individual updates that would otherwise be issued per batch.
func (r *leiRepository) BatchResolveOpenProcessingFailures(jobType string, naturalKeys []string, resolvedSourceFileID *uuid.UUID, resolvedNote string) error {
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

		// Use the JSON tag name as the map key so it matches the record_snapshot keys.
		// Fall back to the struct field name if no JSON tag is present.
		jsonTag := field.Tag.Get("json")
		jsonKey := fieldName
		if jsonTag != "" {
			jsonKey = strings.SplitN(jsonTag, ",", 2)[0]
			if jsonKey == "" || jsonKey == "-" {
				jsonKey = fieldName
			}
		}

		oldFieldVal := oldVal.Field(i).Interface()
		newFieldVal := newVal.Field(i).Interface()

		// Compare values
		if !reflect.DeepEqual(oldFieldVal, newFieldVal) {
			// Use time.Equal for time.Time fields to avoid false positives caused by
			// differences in timezone/location representation or monotonic clock readings
			// between database-loaded and parsed values.
			if field.Type == reflect.TypeOf(time.Time{}) {
				oldTime := oldFieldVal.(time.Time)
				newTime := newFieldVal.(time.Time)
				if oldTime.Equal(newTime) {
					continue
				}
			}

			// Use semantic JSON comparison for JSONBString fields to avoid false
			// positives caused by different JSON key ordering. Go's json.Marshal
			// sorts map keys alphabetically (e.g. language < name < type), but the
			// string stored in PostgreSQL preserves the original insertion order.
			// The raw strings therefore differ even though the content is identical.
			if field.Type == reflect.TypeOf(domain.JSONBString("")) {
				if jsonBStringsSemanticEqual(oldFieldVal.(domain.JSONBString), newFieldVal.(domain.JSONBString)) {
					continue
				}
			}

			changes[jsonKey] = domain.LEIChangeDetection{
				FieldName: jsonKey,
				OldValue:  oldFieldVal,
				NewValue:  newFieldVal,
			}
		}
	}

	return changes
}

// jsonBStringsSemanticEqual compares two JSONBString values by content rather
// than by raw string equality. Both values are unmarshalled into a generic
// interface{} and re-marshalled to canonical JSON (json.Marshal sorts map keys
// alphabetically), so differences in object-key ordering do not cause a false
// positive change detection.
//
// Returns true (equal) when:
//   - the raw strings are identical (fast path), OR
//   - both unmarshal to equivalent JSON values regardless of key ordering.
//
// Returns false (not equal) when either string is invalid JSON or the content
// genuinely differs.
func jsonBStringsSemanticEqual(a, b domain.JSONBString) bool {
	if a == b {
		return true
	}
	var aVal, bVal interface{}
	if err := json.Unmarshal([]byte(a), &aVal); err != nil {
		return false
	}
	if err := json.Unmarshal([]byte(b), &bVal); err != nil {
		return false
	}
	aCanon, err := json.Marshal(aVal)
	if err != nil {
		return false
	}
	bCanon, err := json.Marshal(bVal)
	if err != nil {
		return false
	}
	return string(aCanon) == string(bCanon)
}

// recordToJSON converts an LEI record to JSON string
func (r *leiRepository) recordToJSON(record *domain.LEIRecord) domain.JSONBString {
	jsonBytes, err := json.Marshal(record)
	if err != nil {
		return domain.JSONBString("{}")
	}
	return domain.JSONBString(jsonBytes)
}
