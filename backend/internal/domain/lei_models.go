package domain

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// LEIRecord represents a Legal Entity Identifier record from GLEIF
// This is the raw data as received from GLEIF, stored separately from master data
type LEIRecord struct {
	ID  uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	LEI string    `gorm:"uniqueIndex;size:20;not null" json:"lei" validate:"required,len=20"` // Legal Entity Identifier (unique)

	// Entity information
	LegalName               string      `gorm:"size:500;not null" json:"legal_name"`
	TransliteratedLegalName string      `gorm:"size:500" json:"transliterated_legal_name"`
	OtherNames              JSONBString `gorm:"type:jsonb" json:"other_names"` // Array of alternative names

	// Legal address
	LegalAddressLine1      string `gorm:"column:legal_address_line_1;size:500" json:"legal_address_line_1"`
	LegalAddressLine2      string `gorm:"column:legal_address_line_2;size:500" json:"legal_address_line_2"`
	LegalAddressLine3      string `gorm:"column:legal_address_line_3;size:500" json:"legal_address_line_3"`
	LegalAddressLine4      string `gorm:"column:legal_address_line_4;size:500" json:"legal_address_line_4"`
	LegalAddressCity       string `gorm:"size:255" json:"legal_address_city"`
	LegalAddressRegion     string `gorm:"size:255" json:"legal_address_region"`
	LegalAddressCountry    string `gorm:"size:2" json:"legal_address_country"` // ISO 3166-1 alpha-2
	LegalAddressPostalCode string `gorm:"size:255" json:"legal_address_postal_code"`

	// Headquarters address
	HQAddressLine1      string `gorm:"column:hq_address_line_1;size:500" json:"hq_address_line_1"`
	HQAddressLine2      string `gorm:"column:hq_address_line_2;size:500" json:"hq_address_line_2"`
	HQAddressLine3      string `gorm:"column:hq_address_line_3;size:500" json:"hq_address_line_3"`
	HQAddressLine4      string `gorm:"column:hq_address_line_4;size:500" json:"hq_address_line_4"`
	HQAddressCity       string `gorm:"size:255" json:"hq_address_city"`
	HQAddressRegion     string `gorm:"size:255" json:"hq_address_region"`
	HQAddressCountry    string `gorm:"size:2" json:"hq_address_country"` // ISO 3166-1 alpha-2
	HQAddressPostalCode string `gorm:"size:255" json:"hq_address_postal_code"`

	// Registration
	RegistrationAuthority   string `gorm:"size:255" json:"registration_authority"`
	RegistrationAuthorityID string `gorm:"size:255" json:"registration_authority_id"`
	RegistrationNumber      string `gorm:"size:255" json:"registration_number"`
	EntityCategory          string `gorm:"size:255" json:"entity_category"`
	EntitySubCategory       string `gorm:"size:255" json:"entity_sub_category"`
	EntityLegalForm         string `gorm:"size:255" json:"entity_legal_form"`
	EntityStatus            string `gorm:"size:255" json:"entity_status"`

	// Associated entities
	ManagingLOU  string `gorm:"size:255" json:"managing_lou"` // Local Operating Unit
	SuccessorLEI string `gorm:"size:20" json:"successor_lei"`

	// Dates
	InitialRegistrationDate time.Time `json:"initial_registration_date"`
	LastUpdateDate          time.Time `json:"last_update_date"`
	NextRenewalDate         time.Time `json:"next_renewal_date"`

	// Validation
	ValidationSources   JSONBString `gorm:"type:jsonb" json:"validation_sources"`
	ValidationAuthority string      `gorm:"size:255" json:"validation_authority"`

	// Audit and provenance
	SourceFileID  *uuid.UUID  `gorm:"type:uuid" json:"source_file_id"`
	SourceFile    *SourceFile `gorm:"foreignKey:SourceFileID" json:"source_file,omitempty"`
	ChangedFields JSONBString `gorm:"type:jsonb" json:"changed_fields"` // Last change details
	CreatedBy     string      `gorm:"size:100;not null;default:'system'" json:"created_by"`
	UpdatedBy     string      `gorm:"size:100;not null;default:'system'" json:"updated_by"`

	// Standard fields
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName overrides the table name
func (LEIRecord) TableName() string {
	return "lei_raw.lei_records"
}

// JSONBString is a custom type that handles PostgreSQL JSONB as a JSON string
type JSONBString string

// Scan implements the sql.Scanner interface for JSONBString
func (j *JSONBString) Scan(value interface{}) error {
	if value == nil {
		*j = ""
		return nil
	}

	switch v := value.(type) {
	case []byte:
		*j = JSONBString(v)
		return nil
	case string:
		*j = JSONBString(v)
		return nil
	default:
		return fmt.Errorf("failed to scan JSONBString: unsupported type %T", value)
	}
}

// Value implements the driver.Valuer interface for JSONBString
func (j JSONBString) Value() (driver.Value, error) {
	if j == "" {
		return nil, nil
	}
	// Validate it's valid JSON
	var test interface{}
	if err := json.Unmarshal([]byte(j), &test); err != nil {
		return nil, err
	}
	return string(j), nil
}

// MarshalJSON implements json.Marshaler to ensure proper JSON serialization
func (j JSONBString) MarshalJSON() ([]byte, error) {
	if j == "" {
		return []byte("null"), nil
	}
	// Return the raw JSON directly (already stored as JSON in the database)
	// This prevents double-encoding the JSON as a string
	return []byte(j), nil
}

// LEIRecordAudit represents the complete audit history of LEI record changes
type LEIRecordAudit struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	LEIRecordID uuid.UUID `gorm:"type:uuid;not null;index" json:"lei_record_id"`
	LEI         string    `gorm:"size:20;not null;index" json:"lei"`
	Action      string    `gorm:"size:20;not null" json:"action"` // CREATE, UPDATE, DELETE

	// Complete record snapshot
	RecordSnapshot JSONBString `gorm:"type:jsonb;not null" json:"record_snapshot"`

	// Change details
	ChangedFields JSONBString `gorm:"type:jsonb" json:"changed_fields"` // {"field": {"old": "value", "new": "value"}}

	// Source information
	SourceFileID *uuid.UUID `gorm:"type:uuid" json:"source_file_id"`
	ChangedBy    string     `gorm:"size:100;not null;default:'system'" json:"changed_by"`

	CreatedAt time.Time `json:"created_at"`
}

// TableName overrides the table name
func (LEIRecordAudit) TableName() string {
	return "lei_raw.lei_records_audit"
}

// SourceFile represents metadata about downloaded GLEIF files
type SourceFile struct {
	ID              uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	FileName        string    `gorm:"size:500;not null" json:"file_name"`
	FileType        string    `gorm:"size:20;not null" json:"file_type"` // FULL, DELTA
	JobType         string    `gorm:"size:50" json:"job_type"`
	JobLabel        string    `gorm:"size:120" json:"job_label"`
	FileURL         string    `gorm:"size:1000;not null" json:"file_url"`
	FileSize        int64     `json:"file_size"`
	FileHash        string    `gorm:"size:64" json:"file_hash"` // SHA-256 hash
	DownloadedAt    time.Time `json:"downloaded_at"`
	PublicationDate time.Time `json:"publication_date"`

	// Processing status
	ProcessingStatus string  `gorm:"size:20;not null;default:'PENDING'" json:"processing_status"` // PENDING, IN_PROGRESS, COMPLETED, FAILED
	TotalRecords     int     `gorm:"default:0" json:"total_records"`
	ProcessedRecords int     `gorm:"default:0" json:"processed_records"`
	FailedRecords    int     `gorm:"default:0" json:"failed_records"`
	LastProcessedLEI *string `gorm:"size:20" json:"last_processed_lei"` // For resumption

	ProcessingStartedAt   *time.Time `json:"processing_started_at"`
	ProcessingCompletedAt *time.Time `json:"processing_completed_at"`
	ProcessingError       string     `gorm:"type:text" json:"processing_error"`

	// Retry tracking
	RetryCount      int    `gorm:"default:0;not null" json:"retry_count"`
	MaxRetries      int    `gorm:"default:3;not null" json:"max_retries"`
	FailureCategory string `gorm:"size:50" json:"failure_category"` // SCHEMA_ERROR, NETWORK_ERROR, FILE_CORRUPTION, UNKNOWN

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName overrides the table name
func (SourceFile) TableName() string {
	return "lei_raw.source_files"
}

// FileProcessingStatus represents the overall status of file processing jobs
type FileProcessingStatus struct {
	ID                uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	JobType           string     `gorm:"size:50;not null" json:"job_type"` // DAILY_FULL, DAILY_DELTA, LEVEL2_RR, LEVEL2_REPEX
	JobLabel          string     `gorm:"size:120" json:"job_label"`
	Status            string     `gorm:"size:20;not null" json:"status"` // IDLE, RUNNING, COMPLETED, FAILED
	LastRunAt         *time.Time `json:"last_run_at"`
	NextRunAt         *time.Time `json:"next_run_at"`
	LastSuccessAt     *time.Time `json:"last_success_at"`
	DependsOnJobLabel string     `gorm:"size:120" json:"depends_on_job_label"`

	CurrentSourceFileID *uuid.UUID  `gorm:"type:uuid" json:"current_source_file_id"`
	CurrentSourceFile   *SourceFile `gorm:"foreignKey:CurrentSourceFileID" json:"current_source_file,omitempty"`

	// DependsOnJobType is the JobType of the upstream job that must complete successfully
	// before this job can run.  Empty string means this is a root job with no dependency.
	// Known chain: DAILY_FULL → LEVEL2_RR → LEVEL2_REPEX.
	DependsOnJobType string `gorm:"size:50" json:"depends_on_job_type"`

	ErrorMessage string `gorm:"type:text" json:"error_message"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName overrides the table name
func (FileProcessingStatus) TableName() string {
	return "lei_raw.file_processing_status"
}

// JobTypeDisplayName returns the human-readable job label used in API/UI and persisted metadata.
func JobTypeDisplayName(jobType string) string {
	switch jobType {
	case "MASTER_DATA_SYNC":
		return "Reference Data (MASTER_DATA_SYNC)"
	case "LEVEL1_FULL":
		return "Level 1 — LEI Records (LEVEL1_FULL)"
	case "LEVEL1_DELTA":
		return "Level 1 — LEI Records Delta (LEVEL1_DELTA)"
	case "DAILY_FULL":
		return "Level 1 — LEI Records (DAILY_FULL)"
	case "DAILY_DELTA":
		return "Level 1 — LEI Records Delta (DAILY_DELTA)"
	case "LEVEL2_RR":
		return "Level 2 — Relationship Records (LEVEL2_RR)"
	case "LEVEL2_REPEX":
		return "Level 2 — Reporting Exceptions (LEVEL2_REPEX)"
	default:
		return jobType
	}
}

// JobTypeFromFileType maps source file type values to canonical LEI job types.
func JobTypeFromFileType(fileType string) string {
	switch fileType {
	case "FULL":
		return "LEVEL1_FULL"
	case "DELTA":
		return "LEVEL1_DELTA"
	case "RR", "RR_FULL":
		return "LEVEL2_RR"
	case "REPEX", "REPEX_FULL":
		return "LEVEL2_REPEX"
	default:
		return ""
	}
}

// LEIChangeDetection represents changes detected between old and new LEI records
type LEIChangeDetection struct {
	FieldName string      `json:"field_name"`
	OldValue  interface{} `json:"old_value"`
	NewValue  interface{} `json:"new_value"`
}

// LEIRelationshipRecord represents a GLEIF Level 2 Relationship Record (RR golden-copy).
// Each record encodes a directional ownership or consolidation relationship between two legal
// entities identified by their LEI codes. These records are populated after the Level 1
// (lei_records) sync completes because they reference LEIs that must already exist.
type LEIRelationshipRecord struct {
	ID uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	// StartNodeLEI is the LEI of the child / controlled entity.
	StartNodeLEI string `gorm:"size:20;not null;index" json:"start_node_lei"`
	// EndNodeLEI is the LEI of the parent / controlling entity.
	EndNodeLEI string `gorm:"size:20;not null;index" json:"end_node_lei"`

	RelationshipType   string `gorm:"size:100;not null" json:"relationship_type"`
	RelationshipStatus string `gorm:"size:50;not null" json:"relationship_status"`

	RelationshipPeriods     JSONBString `gorm:"type:jsonb" json:"relationship_periods"`
	RelationshipQualifiers  JSONBString `gorm:"type:jsonb" json:"relationship_qualifiers"`
	RelationshipQuantifiers JSONBString `gorm:"type:jsonb" json:"relationship_quantifiers"`

	RegistrationStatus      string     `gorm:"size:50" json:"registration_status"`
	InitialRegistrationDate *time.Time `json:"initial_registration_date"`
	LastUpdateDate          *time.Time `json:"last_update_date"`
	NextRenewalDate         *time.Time `json:"next_renewal_date"`
	ManagingLOU             string     `gorm:"size:20" json:"managing_lou"`
	ValidationSources       string     `gorm:"size:100" json:"validation_sources"`
	ValidationDocuments     string     `gorm:"size:100" json:"validation_documents"`
	ValidationReference     string     `gorm:"size:500" json:"validation_reference"`

	SourceFileID *uuid.UUID `gorm:"type:uuid" json:"source_file_id"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName overrides the table name for LEIRelationshipRecord.
func (LEIRelationshipRecord) TableName() string {
	return "lei_raw.lei_relationship_records"
}

// LEIReportingException represents a GLEIF Level 2 Reporting Exception (REPEX golden-copy).
// Each record indicates that a legal entity cannot or will not disclose its parent ownership
// relationship, along with the category and reason for that exception.
type LEIReportingException struct {
	ID                 uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	LEI                string    `gorm:"size:20;not null;index" json:"lei"`
	ExceptionCategory  string    `gorm:"size:100;not null" json:"exception_category"`
	ExceptionReason    string    `gorm:"size:200;not null" json:"exception_reason"`
	ExceptionReference string    `gorm:"size:500" json:"exception_reference"`

	SourceFileID *uuid.UUID `gorm:"type:uuid" json:"source_file_id"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName overrides the table name for LEIReportingException.
func (LEIReportingException) TableName() string {
	return "lei_raw.lei_reporting_exceptions"
}

// LEIRelationshipRecordAudit represents the complete audit history of Level 2
// relationship record changes, mirroring the pattern used by LEIRecordAudit for
// Level 1 lei_records.
type LEIRelationshipRecordAudit struct {
	ID               uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	RRRecordID       uuid.UUID `gorm:"type:uuid;not null;index" json:"rr_record_id"`
	StartNodeLEI     string    `gorm:"size:20;not null;index" json:"start_node_lei"`
	EndNodeLEI       string    `gorm:"size:20;not null;index" json:"end_node_lei"`
	RelationshipType string    `gorm:"size:100;not null" json:"relationship_type"`
	Action           string    `gorm:"size:20;not null" json:"action"` // CREATE, UPDATE, DELETE

	// Complete record snapshot
	RecordSnapshot JSONBString `gorm:"type:jsonb;not null" json:"record_snapshot"`

	// Change details
	ChangedFields JSONBString `gorm:"type:jsonb" json:"changed_fields"` // {"field": {"old": "value", "new": "value"}}

	// Source information
	SourceFileID *uuid.UUID `gorm:"type:uuid" json:"source_file_id"`
	ChangedBy    string     `gorm:"size:100;not null;default:'system'" json:"changed_by"`

	CreatedAt time.Time `json:"created_at"`
}

// TableName overrides the table name for LEIRelationshipRecordAudit.
func (LEIRelationshipRecordAudit) TableName() string {
	return "lei_raw.lei_relationship_records_audit"
}

// LEIReportingExceptionAudit represents the complete audit history of Level 2
// reporting exception changes, mirroring the pattern used by LEIRecordAudit for
// Level 1 lei_records.
type LEIReportingExceptionAudit struct {
	ID                uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	RepexRecordID     uuid.UUID `gorm:"type:uuid;not null;index" json:"repex_record_id"`
	LEI               string    `gorm:"size:20;not null;index" json:"lei"`
	ExceptionCategory string    `gorm:"size:100;not null" json:"exception_category"`
	Action            string    `gorm:"size:20;not null" json:"action"` // CREATE, UPDATE, DELETE

	// Complete record snapshot
	RecordSnapshot JSONBString `gorm:"type:jsonb;not null" json:"record_snapshot"`

	// Change details
	ChangedFields JSONBString `gorm:"type:jsonb" json:"changed_fields"` // {"field": {"old": "value", "new": "value"}}

	// Source information
	SourceFileID *uuid.UUID `gorm:"type:uuid" json:"source_file_id"`
	ChangedBy    string     `gorm:"size:100;not null;default:'system'" json:"changed_by"`

	CreatedAt time.Time `json:"created_at"`
}

// TableName overrides the table name for LEIReportingExceptionAudit.
func (LEIReportingExceptionAudit) TableName() string {
	return "lei_raw.lei_reporting_exceptions_audit"
}

// LEILevel2ProcessingFailure captures per-record processing failures during Level 2 RR/REPEX
// ingestion and keeps a durable open/resolved lifecycle for troubleshooting.
type LEILevel2ProcessingFailure struct {
	ID uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`

	JobType              string      `gorm:"size:50;not null;index" json:"job_type"`
	SourceFileID         *uuid.UUID  `gorm:"type:uuid;index" json:"source_file_id"`
	FailureStage         string      `gorm:"size:50;not null" json:"failure_stage"`
	NaturalKey           string      `gorm:"type:text;index" json:"natural_key"`
	RawRecord            JSONBString `gorm:"type:jsonb" json:"raw_record"`
	ErrorMessage         string      `gorm:"type:text;not null" json:"error_message"`
	Resolved             bool        `gorm:"not null;default:false;index" json:"resolved"`
	ResolvedAt           *time.Time  `json:"resolved_at"`
	ResolvedSourceFileID *uuid.UUID  `gorm:"type:uuid" json:"resolved_source_file_id"`
	ResolvedNote         string      `gorm:"type:text" json:"resolved_note"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName overrides the table name for LEILevel2ProcessingFailure.
func (LEILevel2ProcessingFailure) TableName() string {
	return "lei_raw.lei_level2_processing_failures"
}
