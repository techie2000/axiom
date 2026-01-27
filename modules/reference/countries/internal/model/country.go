package model

import "time"

// CodeStatus represents the ISO 3166-1 assignment status of a country code
type CodeStatus string

const (
	StatusOfficiallyAssigned      CodeStatus = "officially_assigned"
	StatusExceptionallyReserved   CodeStatus = "exceptionally_reserved"
	StatusTransitionallyReserved  CodeStatus = "transitionally_reserved"
	StatusIndeterminatelyReserved CodeStatus = "indeterminately_reserved"
	StatusFormerlyUsed            CodeStatus = "formerly_used"
	StatusUnassigned              CodeStatus = "unassigned"
)

// Country represents a country entity from ISO 3166-1
// See: https://www.iso.org/glossary-for-iso-3166.html
type Country struct {
	Alpha2      string     `json:"alpha2" db:"alpha2"`             // ISO 3166-1 alpha-2 (e.g., "US") - Primary key
	Alpha3      string     `json:"alpha3" db:"alpha3"`             // ISO 3166-1 alpha-3 (e.g., "USA")
	Numeric     string     `json:"numeric" db:"numeric"`           // ISO 3166-1 numeric code (e.g., "840")
	NameEnglish string     `json:"name_english" db:"name_english"` // Official English name
	NameFrench  string     `json:"name_french" db:"name_french"`         // Official French name (ISO standard)
	Status      CodeStatus `json:"status" db:"status"`                   // Assignment status
	StartDate   *time.Time `json:"start_date,omitempty" db:"start_date"` // Date country code came into use
	EndDate     *time.Time `json:"end_date,omitempty" db:"end_date"`     // Date country code ceased (if applicable)
	Remarks     string     `json:"remarks,omitempty" db:"remarks"`       // Status-specific notes (e.g., "Reserved for ISO 6166")
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

// IsActive returns true if the country code is currently in active use
func (c *Country) IsActive() bool {
	now := time.Now()

	// Must have started
	if c.StartDate != nil && c.StartDate.After(now) {
		return false
	}

	// Must not have ended
	if c.EndDate != nil && c.EndDate.Before(now) {
		return false
	}

	// Must be officially assigned
	return c.Status == StatusOfficiallyAssigned
}
