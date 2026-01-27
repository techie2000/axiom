package transform

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/techie2000/axiom/modules/reference/countries/internal/model"
)

// ErrFormerlyUsedSkipped is returned when a formerly_used code is encountered (should be skipped per ADR-007)
var ErrFormerlyUsedSkipped = errors.New("formerly_used code should be skipped per ADR-007")

// RawCountryData represents the raw input from csv2json (before canonicalization)
type RawCountryData struct {
	EnglishShortName string `json:"English short name"`
	FrenchShortName  string `json:"French short name"`
	Alpha2Code       string `json:"Alpha-2 code"`
	Alpha3Code       string `json:"Alpha-3 code"`
	Alpha4Code       string `json:"Alpha-4 code,omitempty"`
	Numeric          string `json:"Numeric"`
	Status           string `json:"status"`
	StartDate        string `json:"Start date,omitempty"`
	EndDate          string `json:"End date,omitempty"`
	Remarks          string `json:"Remarks,omitempty"`
}

// ValidStatuses defines the allowed status values per ISO 3166-1
var ValidStatuses = map[string]model.CodeStatus{
	"officially_assigned":      model.StatusOfficiallyAssigned,
	"exceptionally_reserved":   model.StatusExceptionallyReserved,
	"transitionally_reserved":  model.StatusTransitionallyReserved,
	"indeterminately_reserved": model.StatusIndeterminatelyReserved,
	"formerly_used":            model.StatusFormerlyUsed,
	"unassigned":               model.StatusUnassigned,
}

// TransformToCountry applies all canonicalizer transformation rules
// This is where ALL business rules are implemented
// Returns nil, ErrFormerlyUsedSkipped for formerly_used codes that should be skipped
func TransformToCountry(raw RawCountryData) (*model.Country, error) {
	// 1. Validate and normalize status FIRST (required for all records)
	status, err := validateStatus(raw.Status)
	if err != nil {
		return nil, err
	}

	// 2. Check if this is a formerly_used code (skip per ADR-007)
	if status == model.StatusFormerlyUsed {
		return nil, ErrFormerlyUsedSkipped
	}

	// 3. Normalize country codes (uppercase, trim)
	alpha2 := strings.ToUpper(strings.TrimSpace(raw.Alpha2Code))
	alpha3 := strings.ToUpper(strings.TrimSpace(raw.Alpha3Code))
	alpha4 := strings.ToUpper(strings.TrimSpace(raw.Alpha4Code))

	// 4. Trim and clean optional fields
	numeric := strings.TrimSpace(raw.Numeric)
	nameEnglish := strings.TrimSpace(raw.EnglishShortName)
	nameFrench := strings.TrimSpace(raw.FrenchShortName)
	remarks := strings.TrimSpace(raw.Remarks)

	// 5. Apply status-specific validation rules
	if err := validateStatusSpecificFields(status, alpha2, alpha3, numeric, nameEnglish, nameFrench, remarks); err != nil {
		return nil, err
	}

	// 6. Transform numeric code (pad to 3 digits) - only if provided
	var transformedNumeric string
	if numeric != "" {
		transformedNumeric, err = transformNumericCode(numeric)
		if err != nil {
			return nil, err
		}
	}

	// 7. Parse dates (if provided)
	var startDate, endDate *time.Time
	if raw.StartDate != "" {
		sd, err := parseDate(raw.StartDate)
		if err != nil {
			return nil, fmt.Errorf("invalid start_date: %w", err)
		}
		startDate = &sd
	}
	if raw.EndDate != "" {
		ed, err := parseDate(raw.EndDate)
		if err != nil {
			return nil, fmt.Errorf("invalid end_date: %w", err)
		}
		endDate = &ed
	}

	return &model.Country{
		Alpha2:      alpha2,
		Alpha3:      alpha3,
		Alpha4:      alpha4,
		Numeric:     transformedNumeric,
		NameEnglish: nameEnglish,
		NameFrench:  nameFrench,
		Status:      status,
		StartDate:   startDate,
		EndDate:     endDate,
		Remarks:     remarks,
	}, nil
}

// validateStatusSpecificFields validates fields based on ISO 3166-1 status type
// See: COUNTRY-VALIDATION-RULES.md for complete specification
func validateStatusSpecificFields(status model.CodeStatus, alpha2, alpha3, numeric, nameEnglish, nameFrench, remarks string) error {
	// alpha2 is required for ALL statuses
	if alpha2 == "" {
		return fmt.Errorf("alpha2 is required for all status types")
	}

	switch status {
	case model.StatusOfficiallyAssigned:
		// Required: alpha2, alpha3, name_english, name_french
		if alpha3 == "" {
			return fmt.Errorf("alpha3 is required for officially_assigned status")
		}
		if nameEnglish == "" {
			return fmt.Errorf("name_english is required for officially_assigned status")
		}
		if nameFrench == "" {
			return fmt.Errorf("name_french is required for officially_assigned status")
		}

	case model.StatusExceptionallyReserved:
		// Required: alpha2, remarks (name_english is optional)
		if remarks == "" {
			return fmt.Errorf("remarks is required for exceptionally_reserved status (must explain reservation)")
		}

	case model.StatusIndeterminatelyReserved:
		// Required: alpha2, name_english, remarks
		if nameEnglish == "" {
			return fmt.Errorf("name_english is required for indeterminately_reserved status")
		}
		if remarks == "" {
			return fmt.Errorf("remarks is required for indeterminately_reserved status (must explain reservation)")
		}

	case model.StatusTransitionallyReserved:
		// Required: alpha2, name_english, remarks
		if nameEnglish == "" {
			return fmt.Errorf("name_english is required for transitionally_reserved status")
		}
		if remarks == "" {
			return fmt.Errorf("remarks is required for transitionally_reserved status (must explain transition)")
		}

	case model.StatusUnassigned:
		// Required: only alpha2
		// No additional validation needed

	case model.StatusFormerlyUsed:
		// This should be caught earlier and skipped
		// But validate here as defensive programming
		return fmt.Errorf("formerly_used codes should be filtered before validation (ADR-007)")

	default:
		return fmt.Errorf("unknown status: %s", status)
	}

	return nil
}

// validateRequired checks that all required fields are present
// DEPRECATED: Replaced by validateStatusSpecificFields
// Kept for backward compatibility but no longer called
func validateRequired(raw RawCountryData) error {
	if strings.TrimSpace(raw.Alpha2Code) == "" {
		return fmt.Errorf("alpha2 code is required")
	}
	if strings.TrimSpace(raw.Alpha3Code) == "" {
		return fmt.Errorf("alpha3 code is required")
	}
	if strings.TrimSpace(raw.Numeric) == "" {
		return fmt.Errorf("numeric code is required")
	}
	if strings.TrimSpace(raw.EnglishShortName) == "" {
		return fmt.Errorf("english name is required")
	}
	if strings.TrimSpace(raw.FrenchShortName) == "" {
		return fmt.Errorf("french name is required")
	}
	if strings.TrimSpace(raw.Status) == "" {
		return fmt.Errorf("status is required (cannot default missing data)")
	}
	return nil
}

// transformNumericCode pads numeric codes to 3 digits with leading zeros
// Examples: "4" -> "004", "840" -> "840"
func transformNumericCode(numeric string) (string, error) {
	trimmed := strings.TrimSpace(numeric)
	if trimmed == "" {
		return "", fmt.Errorf("numeric code cannot be empty")
	}

	// Validate it's only digits
	for _, char := range trimmed {
		if char < '0' || char > '9' {
			return "", fmt.Errorf("numeric code must contain only digits: %s", trimmed)
		}
	}

	// Pad to 3 digits
	if len(trimmed) > 3 {
		return "", fmt.Errorf("numeric code cannot exceed 3 digits: %s", trimmed)
	}

	return fmt.Sprintf("%03s", trimmed), nil
}

// validateStatus checks if the status is valid and returns the normalized enum value
// Supports aliases: converts spaces to underscores ("officially assigned" → "officially_assigned")
func validateStatus(status string) (model.CodeStatus, error) {
	normalized := strings.ToLower(strings.TrimSpace(status))

	if normalized == "" {
		return "", fmt.Errorf("status is required (cannot default missing data)")
	}

	// Transform format: replace spaces with underscores (alias support)
	normalized = strings.ReplaceAll(normalized, " ", "_")

	validStatus, ok := ValidStatuses[normalized]
	if !ok {
		return "", fmt.Errorf("invalid status: %s (must be one of: officially_assigned, exceptionally_reserved, transitionally_reserved, indeterminately_reserved, formerly_used, unassigned)", status)
	}

	return validStatus, nil
}

// parseDate parses ISO 8601 date format (YYYY-MM-DD)
func parseDate(dateStr string) (time.Time, error) {
	return time.Parse("2006-01-02", strings.TrimSpace(dateStr))
}
