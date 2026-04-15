package domain

import (
	"time"

	"github.com/google/uuid"
)

// GLEIFRegistrationAuthority represents a GLEIF registration authority reference record.
// Source: GLEIF Registration Authorities List (CSV).
// Resolves registration_authority codes in LEI records to human-readable names.
type GLEIFRegistrationAuthority struct {
	ID                uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	RAID              string    `gorm:"column:ra_id;uniqueIndex;size:50;not null" json:"ra_id"`
	OrganizationName  string    `gorm:"size:500;not null" json:"organization_name"`
	Jurisdiction      string    `gorm:"size:100" json:"jurisdiction"`
	InternationalName string    `gorm:"size:500" json:"international_name"`
	LanguagesUsed     string    `gorm:"size:100" json:"languages_used"`
	Website           string    `gorm:"size:500" json:"website"`
	Comments          string    `gorm:"type:text" json:"comments"`
	Active            bool      `gorm:"default:true" json:"active"`
	CreatedBy         string    `gorm:"size:100;not null;default:'system'" json:"created_by"`
	UpdatedBy         string    `gorm:"size:100;not null;default:'system'" json:"updated_by"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// TableName sets the GORM table name.
func (GLEIFRegistrationAuthority) TableName() string {
	return "lei_raw.gleif_registration_authorities"
}

// GLEIFEntityLegalForm represents an ISO 20275 Entity Legal Form reference record.
// Source: GLEIF ELF code list (CSV).
// Resolves entity_legal_form codes in LEI records to human-readable names.
type GLEIFEntityLegalForm struct {
	ID                            uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ELFCode                       string    `gorm:"column:elf_code;size:10;not null" json:"elf_code"`
	EntityLegalFormName           string    `gorm:"size:500;not null" json:"entity_legal_form_name"`
	Abbreviations                 string    `gorm:"size:100" json:"abbreviations"`
	LanguageCode                  string    `gorm:"size:10;not null;default:''" json:"language_code"`
	CountryOfFormation            string    `gorm:"size:2;not null;default:''" json:"country_of_formation"`
	CountrySubdivisionOfFormation string    `gorm:"size:10;not null;default:''" json:"country_subdivision_of_formation"`
	Status                        string    `gorm:"size:20;not null;default:'ACTIVE'" json:"status"`
	CreatedBy                     string    `gorm:"size:100;not null;default:'system'" json:"created_by"`
	UpdatedBy                     string    `gorm:"size:100;not null;default:'system'" json:"updated_by"`
	CreatedAt                     time.Time `json:"created_at"`
	UpdatedAt                     time.Time `json:"updated_at"`
}

// TableName sets the GORM table name.
func (GLEIFEntityLegalForm) TableName() string {
	return "lei_raw.gleif_entity_legal_forms"
}

// GLEIFEntityLegalFormAudit records lifecycle changes for ELF variants.
type GLEIFEntityLegalFormAudit struct {
	ID             uuid.UUID   `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ELFVariantID   *uuid.UUID  `gorm:"type:uuid;index" json:"elf_variant_id"`
	ELFCode        string      `gorm:"column:elf_code;size:10;not null;index" json:"elf_code"`
	Action         string      `gorm:"size:20;not null" json:"action"`
	RecordSnapshot JSONBString `gorm:"type:jsonb;not null" json:"record_snapshot"`
	ChangedFields  JSONBString `gorm:"type:jsonb" json:"changed_fields"`
	ChangedBy      string      `gorm:"size:100;not null;default:'system'" json:"changed_by"`
	CreatedAt      time.Time   `json:"created_at"`
}

// TableName sets the GORM table name.
func (GLEIFEntityLegalFormAudit) TableName() string {
	return "lei_raw.gleif_entity_legal_forms_audit"
}

// GLEIFOrganizationalRole represents an ISO 5009 Official Organizational Role reference record.
// Source: GLEIF organizational roles code list (CSV).
// Resolves role codes in LEI Level 2 data to human-readable role names.
type GLEIFOrganizationalRole struct {
	ID                            uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	RoleCode                      string    `gorm:"column:role_code;size:50;not null" json:"role_code"`
	RoleName                      string    `gorm:"size:500;not null" json:"role_name"`
	Description                   string    `gorm:"type:text" json:"description"`
	LanguageCode                  string    `gorm:"size:10;not null;default:''" json:"language_code"`
	ELFCode                       string    `gorm:"column:elf_code;size:10;not null;default:''" json:"elf_code"`
	CountryOfFormation            string    `gorm:"column:country_of_formation;size:2;not null;default:''" json:"country_of_formation"`
	CountrySubdivisionOfFormation string    `gorm:"column:country_subdivision_of_formation;size:10;not null;default:''" json:"country_subdivision_of_formation"`
	Active                        bool      `gorm:"default:true" json:"active"`
	CreatedBy                     string    `gorm:"size:100;not null;default:'system'" json:"created_by"`
	UpdatedBy                     string    `gorm:"size:100;not null;default:'system'" json:"updated_by"`
	CreatedAt                     time.Time `json:"created_at"`
	UpdatedAt                     time.Time `json:"updated_at"`
}

// TableName sets the GORM table name.
func (GLEIFOrganizationalRole) TableName() string {
	return "lei_raw.gleif_organizational_roles"
}

// GLEIFLegalJurisdiction represents a GLEIF accepted legal jurisdiction reference record.
// Source: GLEIF accepted legal jurisdictions code list (CSV).
// Reference table for resolving GLEIF jurisdiction codes (e.g. US-CA, DE) to human-readable names.
type GLEIFLegalJurisdiction struct {
	ID               uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	JurisdictionCode string    `gorm:"column:jurisdiction_code;uniqueIndex;size:20;not null" json:"jurisdiction_code"`
	JurisdictionName string    `gorm:"size:500;not null" json:"jurisdiction_name"`
	CountryCode      string    `gorm:"size:2" json:"country_code"`
	Active           bool      `gorm:"default:true" json:"active"`
	CreatedBy        string    `gorm:"size:100;not null;default:'system'" json:"created_by"`
	UpdatedBy        string    `gorm:"size:100;not null;default:'system'" json:"updated_by"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// TableName sets the GORM table name.
func (GLEIFLegalJurisdiction) TableName() string {
	return "lei_raw.gleif_legal_jurisdictions"
}
