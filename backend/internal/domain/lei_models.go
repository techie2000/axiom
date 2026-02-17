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
	FileURL         string    `gorm:"size:1000;not null" json:"file_url"`
	FileSize        int64     `json:"file_size"`
	FileHash        string    `gorm:"size:64" json:"file_hash"` // SHA-256 hash
	DownloadedAt    time.Time `json:"downloaded_at"`
	PublicationDate time.Time `json:"publication_date"`

	// Processing status
	ProcessingStatus string `gorm:"size:20;not null;default:'PENDING'" json:"processing_status"` // PENDING, IN_PROGRESS, COMPLETED, FAILED
	TotalRecords     int    `gorm:"default:0" json:"total_records"`
	ProcessedRecords int    `gorm:"default:0" json:"processed_records"`
	FailedRecords    int    `gorm:"default:0" json:"failed_records"`
	LastProcessedLEI string `gorm:"size:20" json:"last_processed_lei"` // For resumption

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
	ID            uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	JobType       string     `gorm:"size:50;not null" json:"job_type"` // DAILY_FULL, DAILY_DELTA, MANUAL
	Status        string     `gorm:"size:20;not null" json:"status"`   // IDLE, RUNNING, COMPLETED, FAILED
	LastRunAt     *time.Time `json:"last_run_at"`
	NextRunAt     *time.Time `json:"next_run_at"`
	LastSuccessAt *time.Time `json:"last_success_at"`

	CurrentSourceFileID *uuid.UUID  `gorm:"type:uuid" json:"current_source_file_id"`
	CurrentSourceFile   *SourceFile `gorm:"foreignKey:CurrentSourceFileID" json:"current_source_file,omitempty"`

	ErrorMessage string `gorm:"type:text" json:"error_message"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName overrides the table name
func (FileProcessingStatus) TableName() string {
	return "lei_raw.file_processing_status"
}

// LEIChangeDetection represents changes detected between old and new LEI records
type LEIChangeDetection struct {
	FieldName string      `json:"field_name"`
	OldValue  interface{} `json:"old_value"`
	NewValue  interface{} `json:"new_value"`
}
