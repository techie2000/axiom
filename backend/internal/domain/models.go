package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BaseModel contains common fields for all models
type BaseModel struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// Country represents a country entity
type Country struct {
	BaseModel
	Code          string `gorm:"column:code;uniqueIndex;size:2;not null" json:"code" validate:"required,len=2"`
	Name          string `gorm:"column:name;not null" json:"name" validate:"required"`
	NativeName    string `gorm:"column:native_name" json:"native_name"`
	Alpha3Code    string `gorm:"size:3" json:"alpha3_code" validate:"len=3"`
	PhoneCodes    string `gorm:"type:jsonb" json:"phone_codes"` // JSON array of phone codes
	Continent     string `gorm:"size:2" json:"continent"`       // AF, AN, AS, EU, NA, OC, SA
	Capital       string `json:"capital"`
	CurrencyCodes string `gorm:"type:jsonb" json:"currency_codes"` // JSON array of currency codes
	Languages     string `gorm:"type:jsonb" json:"languages"`      // JSON array of language codes
	Region        string `json:"region"`
	Active        bool   `gorm:"default:true" json:"active"`
}

// TableName overrides the table name
func (Country) TableName() string {
	return "countries"
}

// Currency represents a currency entity
type Currency struct {
	BaseModel
	Code               string `gorm:"column:code;uniqueIndex;size:3;not null" json:"code" validate:"required,len=3"`
	Name               string `gorm:"column:name;not null" json:"name" validate:"required"`
	Symbol             string `json:"symbol"`
	SymbolNative       string `json:"symbol_native"`
	DecimalDigits      int    `gorm:"default:2" json:"decimal_digits"`
	Rounding           int    `gorm:"default:0" json:"rounding"`
	NamePlural         string `gorm:"column:name_plural" json:"name_plural"`
	Active             bool   `gorm:"default:true" json:"active"`
	IsAlertClsAllowed  bool   `gorm:"column:is_alert_cls_allowed;default:false" json:"is_alert_cls_allowed"`
	IsOfacSanctioned   bool   `gorm:"column:is_ofac_sanctioned;default:false" json:"is_ofac_sanctioned"`
}

// TableName overrides the table name
func (Currency) TableName() string {
	return "currencies"
}

// Continent represents a continent reference entity
type Continent struct {
	Code      string    `gorm:"primaryKey;size:2" json:"code"`
	Name      string    `gorm:"column:name;not null" json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName overrides the table name
func (Continent) TableName() string {
	return "continents"
}

// Language represents a language reference entity
type Language struct {
	Code      string    `gorm:"primaryKey;size:2" json:"code"`
	Name      string    `gorm:"column:language_name;not null" json:"name"`
	Native    string    `gorm:"column:native_name;not null" json:"native"`
	RTL       bool      `gorm:"default:false" json:"rtl"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName overrides the table name
func (Language) TableName() string {
	return "languages"
}

// Address represents a physical address (ISO20022 compliant)
type Address struct {
	BaseModel
	// Structured address fields (ISO20022)
	AddressType        string     `gorm:"size:50" json:"address_type,omitempty"`         // Type of address (ADDR, PBOX, HOME, BIZZ)
	Department         string     `gorm:"size:70" json:"department,omitempty"`           // Department
	SubDepartment      string     `gorm:"size:70" json:"sub_department,omitempty"`       // Sub-department
	StreetName         string     `gorm:"size:70" json:"street_name,omitempty"`          // Street name
	BuildingNumber     string     `gorm:"size:16" json:"building_number,omitempty"`      // Building number
	BuildingName       string     `gorm:"size:35" json:"building_name,omitempty"`        // Building name
	Floor              string     `gorm:"size:70" json:"floor,omitempty"`                // Floor
	PostBox            string     `gorm:"size:16" json:"post_box,omitempty"`             // Post office box number
	Room               string     `gorm:"size:70" json:"room,omitempty"`                 // Room
	PostalCode         string     `gorm:"size:16" json:"postal_code,omitempty"`          // Postal code/ZIP code
	TownName           string     `gorm:"size:35" json:"town_name,omitempty"`            // Town/city name
	TownLocationName   string     `gorm:"size:35" json:"town_location_name,omitempty"`   // Town location name
	DistrictName       string     `gorm:"size:35" json:"district_name,omitempty"`        // District name
	CountrySubDivision string     `gorm:"size:35" json:"country_sub_division,omitempty"` // State/province/region
	CountryID          *uuid.UUID `gorm:"type:uuid" json:"country_id,omitempty"`
	Country            *Country   `gorm:"foreignKey:CountryID" json:"country,omitempty"`
	// Unstructured address lines (ISO20022 allows up to 7 lines)
	AddressLine1 string `gorm:"size:70" json:"address_line_1,omitempty"`
	AddressLine2 string `gorm:"size:70" json:"address_line_2,omitempty"`
	AddressLine3 string `gorm:"size:70" json:"address_line_3,omitempty"`
	AddressLine4 string `gorm:"size:70" json:"address_line_4,omitempty"`
	AddressLine5 string `gorm:"size:70" json:"address_line_5,omitempty"`
	AddressLine6 string `gorm:"size:70" json:"address_line_6,omitempty"`
	AddressLine7 string `gorm:"size:70" json:"address_line_7,omitempty"`
}

// TableName overrides the table name
func (Address) TableName() string {
	return "addresses"
}

// EntityType represents the type of an entity
type EntityType string

const (
	EntityTypeCompany     EntityType = "COMPANY"
	EntityTypeBusiness    EntityType = "BUSINESS"
	EntityTypeCorporation EntityType = "CORPORATION"
	EntityTypePartnership EntityType = "PARTNERSHIP"
	EntityTypeIndividual  EntityType = "INDIVIDUAL"
)

// Entity represents a business entity (company, individual, etc.)
type Entity struct {
	BaseModel
	Name               string          `gorm:"not null" json:"name" validate:"required"`
	RegistrationNumber string          `gorm:"uniqueIndex" json:"registration_number"`
	Type               EntityType      `gorm:"type:varchar(50)" json:"type"`
	Addresses          []EntityAddress `gorm:"foreignKey:EntityID" json:"addresses,omitempty"`
	Active             bool            `gorm:"default:true" json:"active"`
}

// TableName overrides the table name
func (Entity) TableName() string {
	return "entities"
}

// EntityAddress represents the many-to-many relationship between entities and addresses
type EntityAddress struct {
	BaseModel
	EntityID    uuid.UUID `gorm:"type:uuid;not null" json:"entity_id"`
	Entity      *Entity   `gorm:"foreignKey:EntityID" json:"entity,omitempty"`
	AddressID   uuid.UUID `gorm:"type:uuid;not null" json:"address_id"`
	Address     *Address  `gorm:"foreignKey:AddressID" json:"address,omitempty"`
	AddressType string    `gorm:"size:50" json:"address_type,omitempty"` // e.g., 'REGISTERED', 'TRADING', 'BILLING', 'CORRESPONDENCE'
	IsPrimary   bool      `gorm:"default:false" json:"is_primary"`
}

// TableName overrides the table name
func (EntityAddress) TableName() string {
	return "entity_addresses"
}

// InstrumentType represents the type of financial instrument
type InstrumentType string

const (
	InstrumentTypeEquity     InstrumentType = "EQUITY"
	InstrumentTypeBond       InstrumentType = "BOND"
	InstrumentTypeDerivative InstrumentType = "DERIVATIVE"
	InstrumentTypeCommodity  InstrumentType = "COMMODITY"
	InstrumentTypeFund       InstrumentType = "FUND"
	InstrumentTypeForex      InstrumentType = "FOREX"
)

// Instrument represents a financial instrument
type Instrument struct {
	BaseModel
	Name            string           `gorm:"not null" json:"name" validate:"required"`
	Type            InstrumentType   `gorm:"type:varchar(50)" json:"type"`
	IssueCurrencyID *uuid.UUID       `gorm:"type:uuid;column:issue_currency_id" json:"issue_currency_id"`
	IssueCurrency   *Currency        `gorm:"foreignKey:IssueCurrencyID" json:"issue_currency,omitempty"`
	PrimaryExchange string           `gorm:"column:primary_exchange" json:"primary_exchange"`
	Codes           []InstrumentCode `gorm:"foreignKey:InstrumentID" json:"codes,omitempty"`
	Active          bool             `gorm:"default:true" json:"active"`
}

// TableName overrides the table name
func (Instrument) TableName() string {
	return "instruments"
}

// IdentifierLevel represents the level of instrument identifier
type IdentifierLevel string

const (
	IdentifierLevelInternational IdentifierLevel = "INTERNATIONAL" // ISIN, FIGI
	IdentifierLevelRegional      IdentifierLevel = "REGIONAL"      // CUSIP, WKN
	IdentifierLevelLocal         IdentifierLevel = "LOCAL"         // Exchange-specific codes
)

// CodeType represents the type of instrument code
type CodeType string

const (
	CodeTypeISIN      CodeType = "ISIN"
	CodeTypeFIGI      CodeType = "FIGI"
	CodeTypeCUSIP     CodeType = "CUSIP"
	CodeTypeWKN       CodeType = "WKN"
	CodeTypeSEDOL     CodeType = "SEDOL"
	CodeTypeRIC       CodeType = "RIC"
	CodeTypeTicker    CodeType = "TICKER"
	CodeTypeBloomberg CodeType = "BLOOMBERG"
)

// InstrumentCode represents an identifier code for an instrument
type InstrumentCode struct {
	BaseModel
	InstrumentID         uuid.UUID       `gorm:"type:uuid;not null" json:"instrument_id"`
	Instrument           *Instrument     `gorm:"foreignKey:InstrumentID" json:"instrument,omitempty"`
	CodeType             CodeType        `gorm:"type:varchar(50);not null" json:"code_type"`
	CodeValue            string          `gorm:"size:100;not null" json:"code_value"`
	IdentifierLevel      IdentifierLevel `gorm:"type:varchar(50)" json:"identifier_level,omitempty"`
	MarketIdentifierCode string          `gorm:"size:10" json:"market_identifier_code,omitempty"` // MIC code (e.g., XNAS, XFRA)
	Region               string          `gorm:"size:50" json:"region,omitempty"`                 // For regional codes (e.g., US, DE)
}

// TableName overrides the table name
func (InstrumentCode) TableName() string {
	return "instrument_codes"
}

// AccountType represents the type of account
type AccountType string

const (
	AccountTypeTrading    AccountType = "TRADING"
	AccountTypeSettlement AccountType = "SETTLEMENT"
	AccountTypeCustody    AccountType = "CUSTODY"
	AccountTypeMargin     AccountType = "MARGIN"
)

// Account represents a financial account
type Account struct {
	BaseModel
	AccountNumber     string      `gorm:"uniqueIndex;not null" json:"account_number" validate:"required"`
	EntityID          *uuid.UUID  `gorm:"type:uuid" json:"entity_id"`
	Entity            *Entity     `gorm:"foreignKey:EntityID" json:"entity,omitempty"`
	AccountCurrencyID *uuid.UUID  `gorm:"type:uuid;column:account_currency_id" json:"account_currency_id"`
	AccountCurrency   *Currency   `gorm:"foreignKey:AccountCurrencyID" json:"account_currency,omitempty"`
	Type              AccountType `gorm:"type:varchar(50)" json:"type"`
	Balance           float64     `gorm:"type:decimal(19,4);default:0" json:"balance"`
	OpenedAt          time.Time   `json:"opened_at"`
	Active            bool        `gorm:"default:true" json:"active"`
}

// TableName overrides the table name
func (Account) TableName() string {
	return "accounts"
}

// SettlementType represents the type of settlement
type SettlementType string

const (
	SettlementTypeDVP SettlementType = "DVP" // Delivery Versus Payment
	SettlementTypeFOP SettlementType = "FOP" // Free Of Payment
	SettlementTypeRVP SettlementType = "RVP" // Receive Versus Payment
	SettlementTypeDAP SettlementType = "DAP" // Delivery Against Payment
)

// SSI represents Standard Settlement Instructions
type SSI struct {
	BaseModel
	EntityID             *uuid.UUID     `gorm:"type:uuid" json:"entity_id"`
	Entity               *Entity        `gorm:"foreignKey:EntityID" json:"entity,omitempty"`
	SettlementCurrencyID *uuid.UUID     `gorm:"type:uuid;column:settlement_currency_id" json:"settlement_currency_id"`
	SettlementCurrency   *Currency      `gorm:"foreignKey:SettlementCurrencyID" json:"settlement_currency,omitempty"`
	InstrumentID         *uuid.UUID     `gorm:"type:uuid" json:"instrument_id"`
	Instrument           *Instrument    `gorm:"foreignKey:InstrumentID" json:"instrument,omitempty"`
	BeneficiaryName      string         `gorm:"not null" json:"beneficiary_name" validate:"required"`
	BeneficiaryAccount   string         `gorm:"not null" json:"beneficiary_account" validate:"required"`
	BeneficiaryBank      string         `gorm:"not null" json:"beneficiary_bank" validate:"required"`
	BeneficiaryBankBIC   string         `json:"beneficiary_bank_bic"`
	IntermediaryBank     string         `json:"intermediary_bank"`
	IntermediaryBankBIC  string         `json:"intermediary_bank_bic"`
	SettlementType       SettlementType `gorm:"type:varchar(50)" json:"settlement_type"`
	ValidFrom            time.Time      `json:"valid_from"`
	ValidTo              *time.Time     `json:"valid_to"`
	Active               bool           `gorm:"default:true" json:"active"`
}

// TableName overrides the table name
func (SSI) TableName() string {
	return "ssis"
}

// CodeMapping represents a generic cross-system code mapping
type CodeMapping struct {
	BaseModel
	FromSystem   string `gorm:"size:100;not null" json:"from_system" validate:"required"`
	ToSystem     string `gorm:"size:100;not null" json:"to_system" validate:"required"`
	FromCodeType string `gorm:"size:100;not null" json:"from_code_type" validate:"required"`
	ToCodeType   string `gorm:"size:100;not null" json:"to_code_type" validate:"required"`
	FromCode     string `gorm:"size:255;not null" json:"from_code" validate:"required"`
	ToCode       string `gorm:"size:255;not null" json:"to_code" validate:"required"`
	Description  string `gorm:"size:500" json:"description,omitempty"`
	Active       bool   `gorm:"default:true" json:"active"`
	CreatedBy    string `gorm:"size:100;not null;default:'system'" json:"created_by"`
}

// TableName overrides the table name
func (CodeMapping) TableName() string {
	return "code_mappings"
}

// UserRole represents the role of a system user
type UserRole string

const (
	UserRoleAdmin UserRole = "admin"
	UserRoleUser  UserRole = "user"
)

// UserStatus represents the provisioning status of a system user
type UserStatus string

const (
	UserStatusPending  UserStatus = "pending"
	UserStatusActive   UserStatus = "active"
	UserStatusInactive UserStatus = "inactive"
)

// User represents a system user with authentication and authorisation details
type User struct {
	BaseModel
	Email        string     `gorm:"uniqueIndex;not null;size:255" json:"email"`
	Username     string     `gorm:"uniqueIndex;not null;size:100" json:"username"`
	PasswordHash string     `gorm:"column:password_hash;not null" json:"-"`
	FullName     string     `gorm:"size:255" json:"full_name"`
	Role         UserRole   `gorm:"type:varchar(50);not null;default:'user'" json:"role"`
	Status       UserStatus `gorm:"type:varchar(50);not null;default:'pending'" json:"status"`
	ApprovedBy   *uuid.UUID `gorm:"type:uuid;column:approved_by" json:"approved_by,omitempty"`
	ApprovedAt   *time.Time `gorm:"column:approved_at" json:"approved_at,omitempty"`
	// IsBootstrap marks the default seed admin that must be replaced on first login.
	// Exposed in API responses so the UI can lock down actions on this account.
	IsBootstrap bool `gorm:"column:is_bootstrap;default:false" json:"is_bootstrap"`
}

// TableName overrides the table name
func (User) TableName() string {
	return "users"
}

// UserPreference stores a single UI preference for a user on a specific page.
// page_key="global" is used for cross-page preferences (e.g. theme).
type UserPreference struct {
	ID              uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID          uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	PageKey         string    `gorm:"size:100;not null" json:"page_key"`
	PreferenceKey   string    `gorm:"size:100;not null" json:"preference_key"`
	PreferenceValue string    `gorm:"type:text;not null" json:"preference_value"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func (UserPreference) TableName() string {
	return "user_preferences"
}

// PreferenceAudit is an append-only record of every preference upsert.
// old_value is nil when the preference did not previously exist.
type PreferenceAudit struct {
	ID            uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID        uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	PageKey       string     `gorm:"size:100;not null" json:"page_key"`
	PreferenceKey string     `gorm:"size:100;not null" json:"preference_key"`
	OldValue      *string    `gorm:"type:text" json:"old_value"`
	NewValue      string     `gorm:"type:text;not null" json:"new_value"`
	ChangedAt     time.Time  `gorm:"not null;default:now()" json:"changed_at"`
	IPAddress     *string    `gorm:"size:45" json:"ip_address"`
}

func (PreferenceAudit) TableName() string {
	return "user_preferences_audit"
}

// TranslationStatus represents the review lifecycle of a UI translation.
type TranslationStatus string

const (
	TranslationStatusPending  TranslationStatus = "pending"
	TranslationStatusApproved TranslationStatus = "approved"
	TranslationStatusRejected TranslationStatus = "rejected"
)

// UITranslation stores a community-contributed UI translation that goes
// through a review workflow before being shipped as a locale JSON file.
type UITranslation struct {
	ID               uuid.UUID         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TranslationKey   string            `gorm:"size:500;not null;index" json:"translation_key"`
	LanguageCode     string            `gorm:"size:10;not null;index" json:"language_code"`
	TranslationValue string            `gorm:"type:text;not null" json:"translation_value"`
	Status           TranslationStatus `gorm:"type:varchar(20);not null;default:'pending'" json:"status"`
	Notes            string            `gorm:"type:text" json:"notes,omitempty"`
	SubmittedBy      *uuid.UUID        `gorm:"type:uuid" json:"submitted_by,omitempty"`
	ReviewedBy       *uuid.UUID        `gorm:"type:uuid" json:"reviewed_by,omitempty"`
	ReviewedAt       *time.Time        `json:"reviewed_at,omitempty"`
	CreatedAt        time.Time         `json:"created_at"`
	UpdatedAt        time.Time         `json:"updated_at"`
}

func (UITranslation) TableName() string {
	return "ui_translations"
}

// CodeMappingAudit represents the complete audit history of code mapping changes
type CodeMappingAudit struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	CodeMappingID  uuid.UUID `gorm:"type:uuid;not null;index" json:"code_mapping_id"`
	FromSystem     string    `gorm:"size:100;not null" json:"from_system"`
	ToSystem       string    `gorm:"size:100;not null" json:"to_system"`
	FromCodeType   string    `gorm:"size:100;not null" json:"from_code_type"`
	ToCodeType     string    `gorm:"size:100;not null" json:"to_code_type"`
	FromCode       string    `gorm:"size:255;not null" json:"from_code"`
	ToCode         string    `gorm:"size:255;not null" json:"to_code"`
	Action         string    `gorm:"size:20;not null" json:"action"` // CREATE, UPDATE, DELETE
	RecordSnapshot string    `gorm:"type:jsonb;not null" json:"record_snapshot"`
	ChangedFields  string    `gorm:"type:jsonb" json:"changed_fields"`
	ChangedBy      string    `gorm:"size:100;not null;default:'system'" json:"changed_by"`
	CreatedAt      time.Time `json:"created_at"`
}

func (CodeMappingAudit) TableName() string {
	return "code_mappings_audit"
}

// AuditLog represents an audit trail entry
type AuditLog struct {
	BaseModel
	EntityType   string    `gorm:"not null" json:"entity_type"`
	EntityID     uuid.UUID `gorm:"type:uuid;not null" json:"entity_id"`
	Action       string    `gorm:"not null" json:"action"` // CREATE, UPDATE, DELETE
	UserID       uuid.UUID `gorm:"type:uuid" json:"user_id"`
	ChangedData  string    `gorm:"type:jsonb" json:"changed_data"`
	PreviousData string    `gorm:"type:jsonb" json:"previous_data"`
}

// TableName overrides the table name
func (AuditLog) TableName() string {
	return "audit_logs"
}

// Standardized audit models (following LEI audit pattern)

// CountryAudit represents the complete audit history of country changes
type CountryAudit struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	CountryID      uuid.UUID `gorm:"type:uuid;not null;index" json:"country_id"`
	Code           string    `gorm:"size:2;not null;index" json:"code"`
	Action         string    `gorm:"size:20;not null" json:"action"` // CREATE, UPDATE, DELETE
	RecordSnapshot string    `gorm:"type:jsonb;not null" json:"record_snapshot"`
	ChangedFields  string    `gorm:"type:jsonb" json:"changed_fields"`
	ChangedBy      string    `gorm:"size:100;not null;default:'system'" json:"changed_by"`
	CreatedAt      time.Time `json:"created_at"`
}

func (CountryAudit) TableName() string {
	return "countries_audit"
}

// CurrencyAudit represents the complete audit history of currency changes
type CurrencyAudit struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	CurrencyID     uuid.UUID `gorm:"type:uuid;not null;index" json:"currency_id"`
	Code           string    `gorm:"size:3;not null;index" json:"code"`
	Action         string    `gorm:"size:20;not null" json:"action"` // CREATE, UPDATE, DELETE
	RecordSnapshot string    `gorm:"type:jsonb;not null" json:"record_snapshot"`
	ChangedFields  string    `gorm:"type:jsonb" json:"changed_fields"`
	ChangedBy      string    `gorm:"size:100;not null;default:'system'" json:"changed_by"`
	CreatedAt      time.Time `json:"created_at"`
}

func (CurrencyAudit) TableName() string {
	return "currencies_audit"
}

// AddressAudit represents the complete audit history of address changes
type AddressAudit struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	AddressID      uuid.UUID `gorm:"type:uuid;not null;index" json:"address_id"`
	Action         string    `gorm:"size:20;not null" json:"action"` // CREATE, UPDATE, DELETE
	RecordSnapshot string    `gorm:"type:jsonb;not null" json:"record_snapshot"`
	ChangedFields  string    `gorm:"type:jsonb" json:"changed_fields"`
	ChangedBy      string    `gorm:"size:100;not null;default:'system'" json:"changed_by"`
	CreatedAt      time.Time `json:"created_at"`
}

func (AddressAudit) TableName() string {
	return "addresses_audit"
}

// EntityAudit represents the complete audit history of entity changes
type EntityAudit struct {
	ID                 uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	EntityID           uuid.UUID `gorm:"type:uuid;not null;index" json:"entity_id"`
	RegistrationNumber string    `gorm:"size:255;index" json:"registration_number"`
	Action             string    `gorm:"size:20;not null" json:"action"` // CREATE, UPDATE, DELETE
	RecordSnapshot     string    `gorm:"type:jsonb;not null" json:"record_snapshot"`
	ChangedFields      string    `gorm:"type:jsonb" json:"changed_fields"`
	ChangedBy          string    `gorm:"size:100;not null;default:'system'" json:"changed_by"`
	CreatedAt          time.Time `json:"created_at"`
}

func (EntityAudit) TableName() string {
	return "entities_audit"
}

// EntityAddressAudit represents the complete audit history of entity address changes
type EntityAddressAudit struct {
	ID              uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	EntityAddressID uuid.UUID `gorm:"type:uuid;not null;index" json:"entity_address_id"`
	EntityID        uuid.UUID `gorm:"type:uuid;not null;index" json:"entity_id"`
	AddressID       uuid.UUID `gorm:"type:uuid;not null;index" json:"address_id"`
	Action          string    `gorm:"size:20;not null" json:"action"` // CREATE, UPDATE, DELETE
	RecordSnapshot  string    `gorm:"type:jsonb;not null" json:"record_snapshot"`
	ChangedFields   string    `gorm:"type:jsonb" json:"changed_fields"`
	ChangedBy       string    `gorm:"size:100;not null;default:'system'" json:"changed_by"`
	CreatedAt       time.Time `json:"created_at"`
}

func (EntityAddressAudit) TableName() string {
	return "entity_addresses_audit"
}

// InstrumentAudit represents the complete audit history of instrument changes
type InstrumentAudit struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	InstrumentID   uuid.UUID `gorm:"type:uuid;not null;index" json:"instrument_id"`
	Name           string    `gorm:"size:255" json:"name"`
	Action         string    `gorm:"size:20;not null" json:"action"` // CREATE, UPDATE, DELETE
	RecordSnapshot string    `gorm:"type:jsonb;not null" json:"record_snapshot"`
	ChangedFields  string    `gorm:"type:jsonb" json:"changed_fields"`
	ChangedBy      string    `gorm:"size:100;not null;default:'system'" json:"changed_by"`
	CreatedAt      time.Time `json:"created_at"`
}

func (InstrumentAudit) TableName() string {
	return "instruments_audit"
}

// InstrumentCodeAudit represents the complete audit history of instrument code changes
type InstrumentCodeAudit struct {
	ID               uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	InstrumentCodeID uuid.UUID `gorm:"type:uuid;not null;index" json:"instrument_code_id"`
	InstrumentID     uuid.UUID `gorm:"type:uuid;not null;index" json:"instrument_id"`
	CodeType         string    `gorm:"size:50" json:"code_type"`
	CodeValue        string    `gorm:"size:100" json:"code_value"`
	Action           string    `gorm:"size:20;not null" json:"action"` // CREATE, UPDATE, DELETE
	RecordSnapshot   string    `gorm:"type:jsonb;not null" json:"record_snapshot"`
	ChangedFields    string    `gorm:"type:jsonb" json:"changed_fields"`
	ChangedBy        string    `gorm:"size:100;not null;default:'system'" json:"changed_by"`
	CreatedAt        time.Time `json:"created_at"`
}

func (InstrumentCodeAudit) TableName() string {
	return "instrument_codes_audit"
}

// AccountAudit represents the complete audit history of account changes
type AccountAudit struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	AccountID      uuid.UUID `gorm:"type:uuid;not null;index" json:"account_id"`
	AccountNumber  string    `gorm:"size:255;index" json:"account_number"`
	Action         string    `gorm:"size:20;not null" json:"action"` // CREATE, UPDATE, DELETE
	RecordSnapshot string    `gorm:"type:jsonb;not null" json:"record_snapshot"`
	ChangedFields  string    `gorm:"type:jsonb" json:"changed_fields"`
	ChangedBy      string    `gorm:"size:100;not null;default:'system'" json:"changed_by"`
	CreatedAt      time.Time `json:"created_at"`
}

func (AccountAudit) TableName() string {
	return "accounts_audit"
}

// SSIAudit represents the complete audit history of SSI changes
type SSIAudit struct {
	ID                 uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	SSIID              uuid.UUID `gorm:"type:uuid;not null;index" json:"ssi_id"`
	BeneficiaryAccount string    `gorm:"size:255" json:"beneficiary_account"`
	Action             string    `gorm:"size:20;not null" json:"action"` // CREATE, UPDATE, DELETE
	RecordSnapshot     string    `gorm:"type:jsonb;not null" json:"record_snapshot"`
	ChangedFields      string    `gorm:"type:jsonb" json:"changed_fields"`
	ChangedBy          string    `gorm:"size:100;not null;default:'system'" json:"changed_by"`
	CreatedAt          time.Time `json:"created_at"`
}

func (SSIAudit) TableName() string {
	return "ssis_audit"
}
