package transform

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

// RawCurrencyData represents the CSV structure from csv2json
type RawCurrencyData struct {
	Entity         string `json:"ENTITY"`
	Currency       string `json:"Currency"`
	AlphabeticCode string `json:"Alphabetic Code"`
	NumericCode    string `json:"Numeric Code"`
	MinorUnit      string `json:"Minor unit"`
	Fund           string `json:"Fund"`
	Remarks        string `json:"Remarks"`
	StartDate      string `json:"start date"`
	EndDate        string `json:"end date"`
}

// Currency represents the canonical currency structure for database
type Currency struct {
	Code        string
	Number      *string
	Name        string
	Alpha2      *string
	MinorUnits  *int
	StartDate   *string
	EndDate     *string
	Remarks     *string
	Status      string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// TransformToCurrency applies ALL canonicalizer transformation rules
// This is the ONLY place where data transformation occurs
func TransformToCurrency(raw RawCurrencyData) (*Currency, error) {
	currency := &Currency{
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}

	// 1. Code normalization (UPPERCASE, required)
	currency.Code = strings.ToUpper(strings.TrimSpace(raw.AlphabeticCode))
	if currency.Code == "" {
		return nil, fmt.Errorf("code (Alphabetic Code) is required")
	}

	// 2. Numeric code padding (pad to 3 digits with leading zeros)
	if raw.NumericCode != "" {
		trimmed := strings.TrimSpace(raw.NumericCode)
		if trimmed != "" {
			// Validate numeric
			if _, err := strconv.Atoi(trimmed); err != nil {
				return nil, fmt.Errorf("invalid numeric code: %s", trimmed)
			}
			// Pad to 3 digits
			padded := fmt.Sprintf("%03s", trimmed)
			currency.Number = &padded
		}
	}

	// 3. Name trimming (required)
	currency.Name = strings.TrimSpace(raw.Currency)
	if currency.Name == "" {
		return nil, fmt.Errorf("name (Currency) is required")
	}

	// 4. Alpha2 country mapping (nullable for special currencies)
	// TODO: Implement country lookup from ENTITY field
	// For now, set to nil - will be enhanced later
	currency.Alpha2 = nil

	// 5. Minor units parsing (nullable)
	if raw.MinorUnit != "" {
		trimmed := strings.TrimSpace(raw.MinorUnit)
		if trimmed != "" {
			minorUnits, err := strconv.Atoi(trimmed)
			if err != nil {
				return nil, fmt.Errorf("invalid minor unit: %s", trimmed)
			}
			currency.MinorUnits = &minorUnits
		}
	}

	// 6. Fund currency handling
	isFund := strings.EqualFold(strings.TrimSpace(raw.Fund), "TRUE")

	// 7. Remarks handling (combine Fund flag with remarks)
	remarks := strings.TrimSpace(raw.Remarks)
	if isFund {
		if remarks != "" {
			remarks = "FUND CURRENCY. " + remarks
		} else {
			remarks = "FUND CURRENCY"
		}
	}
	if remarks != "" {
		currency.Remarks = &remarks
	}

	// 8. Date handling (flexible formats)
	if raw.StartDate != "" {
		startDate := strings.TrimSpace(raw.StartDate)
		if startDate != "" {
			// Validate date format (allow YYYY-MM-DD, YYYY-MM, YYYY, "YYYY to YYYY")
			if !isValidDateFormat(startDate) {
				return nil, fmt.Errorf("invalid start_date format: %s", startDate)
			}
			currency.StartDate = &startDate
		}
	}

	if raw.EndDate != "" {
		endDate := strings.TrimSpace(raw.EndDate)
		if endDate != "" {
			if !isValidDateFormat(endDate) {
				return nil, fmt.Errorf("invalid end_date format: %s", endDate)
			}
			currency.EndDate = &endDate
		}
	}

	// 9. Status determination
	if currency.EndDate != nil && *currency.EndDate != "" {
		currency.Status = "historical"
	} else if isFund || isSpecialCurrency(currency.Code) {
		currency.Status = "special"
	} else {
		currency.Status = "active"
	}

	return currency, nil
}

// isSpecialCurrency checks if currency code is a special currency (precious metals, SDR, testing)
func isSpecialCurrency(code string) bool {
	specialCurrencies := map[string]bool{
		"XAU": true, "XAG": true, "XPT": true, "XPD": true, // Precious metals
		"XBA": true, "XBB": true, "XBC": true, "XBD": true, // Bond markets units
		"XDR": true, // IMF Special Drawing Rights
		"XTS": true, // Testing code
		"XXX": true, // No currency
	}
	return specialCurrencies[code]
}

// isValidDateFormat validates flexible date formats
func isValidDateFormat(date string) bool {
	// Allow: YYYY-MM-DD, YYYY-MM, YYYY, "YYYY to YYYY"
	if strings.Contains(date, " to ") {
		parts := strings.Split(date, " to ")
		if len(parts) != 2 {
			return false
		}
		return isValidYear(parts[0]) && isValidYear(parts[1])
	}

	// Try YYYY-MM-DD
	if _, err := time.Parse("2006-01-02", date); err == nil {
		return true
	}

	// Try YYYY-MM
	if _, err := time.Parse("2006-01", date); err == nil {
		return true
	}

	// Try YYYY
	return isValidYear(date)
}

// isValidYear checks if string is a valid 4-digit year
func isValidYear(year string) bool {
	year = strings.TrimSpace(year)
	if len(year) != 4 {
		return false
	}
	y, err := strconv.Atoi(year)
	return err == nil && y >= 1000 && y <= 9999
}
