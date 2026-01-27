package transform

import (
	"testing"
	"time"

	"github.com/techie2000/axiom/modules/reference/countries/internal/model"
)

// TestTransformNumericCode tests the numeric code padding rule
func TestTransformNumericCode(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{
			name:  "single digit - pad to 3",
			input: "4",
			want:  "004",
		},
		{
			name:  "two digits - pad to 3",
			input: "36",
			want:  "036",
		},
		{
			name:  "three digits - no change",
			input: "840",
			want:  "840",
		},
		{
			name:  "with leading spaces",
			input: "  4",
			want:  "004",
		},
		{
			name:  "with trailing spaces",
			input: "4  ",
			want:  "004",
		},
		{
			name:    "empty string",
			input:   "",
			wantErr: true,
		},
		{
			name:    "non-numeric",
			input:   "abc",
			wantErr: true,
		},
		{
			name:    "too long",
			input:   "8401",
			wantErr: true,
		},
		{
			name:    "mixed alphanumeric",
			input:   "84a",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := transformNumericCode(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("transformNumericCode() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("transformNumericCode() = %v, want %v", got, tt.want)
			}
		})
	}
}

// TestValidateStatus tests the status validation rule
func TestValidateStatus(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    model.CodeStatus
		wantErr bool
	}{
		{
			name:  "officially_assigned",
			input: "officially_assigned",
			want:  model.StatusOfficiallyAssigned,
		},
		{
			name:  "uppercase variant",
			input: "OFFICIALLY_ASSIGNED",
			want:  model.StatusOfficiallyAssigned,
		},
		{
			name:  "mixed case",
			input: "Officially_Assigned",
			want:  model.StatusOfficiallyAssigned,
		},
		{
			name:  "with spaces",
			input: "  officially_assigned  ",
			want:  model.StatusOfficiallyAssigned,
		},
		{
			name:  "exceptionally_reserved",
			input: "exceptionally_reserved",
			want:  model.StatusExceptionallyReserved,
		},
		{
			name:  "transitionally_reserved",
			input: "transitionally_reserved",
			want:  model.StatusTransitionallyReserved,
		},
		{
			name:  "formerly_used",
			input: "formerly_used",
			want:  model.StatusFormerlyUsed,
		},
		{
			name:  "alias with spaces - transform to underscore",
			input: "officially assigned",
			want:  model.StatusOfficiallyAssigned,
		},
		{
			name:  "alias with spaces - exceptionally reserved",
			input: "exceptionally reserved",
			want:  model.StatusExceptionallyReserved,
		},
		{
			name:    "empty string - reject",
			input:   "",
			wantErr: true,
		},
		{
			name:    "invalid status",
			input:   "invalid_status",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := validateStatus(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateStatus() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("validateStatus() = %v, want %v", got, tt.want)
			}
		})
	}
}

// TestValidateRequired tests required field validation
func TestValidateRequired(t *testing.T) {
	tests := []struct {
		name    string
		input   RawCountryData
		wantErr bool
		errMsg  string
	}{
		{
			name: "all fields present",
			input: RawCountryData{
				Alpha2Code:       "US",
				Alpha3Code:       "USA",
				Numeric:          "840",
				EnglishShortName: "United States",
				FrenchShortName:  "États-Unis",
				Status:           "officially_assigned",
			},
			wantErr: false,
		},
		{
			name: "missing alpha2",
			input: RawCountryData{
				Alpha3Code:       "USA",
				Numeric:          "840",
				EnglishShortName: "United States",
				FrenchShortName:  "États-Unis",
				Status:           "officially_assigned",
			},
			wantErr: true,
			errMsg:  "alpha2 code is required",
		},
		{
			name: "missing alpha3",
			input: RawCountryData{
				Alpha2Code:       "US",
				Numeric:          "840",
				EnglishShortName: "United States",
				FrenchShortName:  "États-Unis",
				Status:           "officially_assigned",
			},
			wantErr: true,
			errMsg:  "alpha3 code is required",
		},
		{
			name: "missing numeric",
			input: RawCountryData{
				Alpha2Code:       "US",
				Alpha3Code:       "USA",
				EnglishShortName: "United States",
				FrenchShortName:  "États-Unis",
				Status:           "officially_assigned",
			},
			wantErr: true,
			errMsg:  "numeric code is required",
		},
		{
			name: "missing english name",
			input: RawCountryData{
				Alpha2Code:      "US",
				Alpha3Code:      "USA",
				Numeric:         "840",
				FrenchShortName: "États-Unis",
				Status:          "officially_assigned",
			},
			wantErr: true,
			errMsg:  "english name is required",
		},
		{
			name: "missing french name",
			input: RawCountryData{
				Alpha2Code:       "US",
				Alpha3Code:       "USA",
				Numeric:          "840",
				EnglishShortName: "United States",
				Status:           "officially_assigned",
			},
			wantErr: true,
			errMsg:  "french name is required",
		},
		{
			name: "missing status - must reject",
			input: RawCountryData{
				Alpha2Code:       "US",
				Alpha3Code:       "USA",
				Numeric:          "840",
				EnglishShortName: "United States",
				FrenchShortName:  "États-Unis",
			},
			wantErr: true,
			errMsg:  "status is required (cannot default missing data)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateRequired(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateRequired() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && err.Error() != tt.errMsg {
				t.Errorf("validateRequired() error message = %v, want %v", err.Error(), tt.errMsg)
			}
		})
	}
}

// TestTransformToCountry tests the full transformation pipeline
func TestTransformToCountry(t *testing.T) {
	tests := []struct {
		name    string
		input   RawCountryData
		want    *model.Country
		wantErr bool
	}{
		{
			name: "complete transformation - lowercase to uppercase",
			input: RawCountryData{
				EnglishShortName: "Afghanistan",
				FrenchShortName:  "Afghanistan (l')",
				Alpha2Code:       "af",
				Alpha3Code:       "afg",
				Numeric:          "4",
				Status:           "officially_assigned",
			},
			want: &model.Country{
				Alpha2:      "AF",
				Alpha3:      "AFG",
				Numeric:     "004",
				NameEnglish: "Afghanistan",
				NameFrench:  "Afghanistan (l')",
				Status:      model.StatusOfficiallyAssigned,
			},
		},
		{
			name: "trim whitespace",
			input: RawCountryData{
				EnglishShortName: "  France  ",
				FrenchShortName:  "  France  ",
				Alpha2Code:       "  FR  ",
				Alpha3Code:       "  FRA  ",
				Numeric:          "  250  ",
				Status:           "  officially_assigned  ",
			},
			want: &model.Country{
				Alpha2:      "FR",
				Alpha3:      "FRA",
				Numeric:     "250",
				NameEnglish: "France",
				NameFrench:  "France",
				Status:      model.StatusOfficiallyAssigned,
			},
		},
		{
			name: "with dates",
			input: RawCountryData{
				EnglishShortName: "Germany",
				FrenchShortName:  "Allemagne",
				Alpha2Code:       "DE",
				Alpha3Code:       "DEU",
				Numeric:          "276",
				Status:           "officially_assigned",
				StartDate:        "1974-07-18",
			},
			want: &model.Country{
				Alpha2:      "DE",
				Alpha3:      "DEU",
				Numeric:     "276",
				NameEnglish: "Germany",
				NameFrench:  "Allemagne",
				Status:      model.StatusOfficiallyAssigned,
				StartDate:   parseTestDate("1974-07-18"),
			},
		},
		{
			name: "formerly used country - should skip",
			input: RawCountryData{
				EnglishShortName: "East Germany",
				FrenchShortName:  "Allemagne de l'Est",
				Alpha2Code:       "DD",
				Alpha3Code:       "DDR",
				Numeric:          "278",
				Status:           "formerly_used",
				StartDate:        "1974-07-18",
				EndDate:          "1990-10-03",
			},
			wantErr: true, // Should return ErrFormerlyUsedSkipped
		},
		{
			name: "missing required field",
			input: RawCountryData{
				EnglishShortName: "Test Country",
				FrenchShortName:  "Pays de Test",
				Alpha3Code:       "TST",
				Numeric:          "999",
				Status:           "officially_assigned",
			},
			wantErr: true,
		},
		{
			name: "invalid numeric code",
			input: RawCountryData{
				EnglishShortName: "Test Country",
				FrenchShortName:  "Pays de Test",
				Alpha2Code:       "TS",
				Alpha3Code:       "TST",
				Numeric:          "abc",
				Status:           "officially_assigned",
			},
			wantErr: true,
		},
		{
			name: "invalid status",
			input: RawCountryData{
				EnglishShortName: "Test Country",
				FrenchShortName:  "Pays de Test",
				Alpha2Code:       "TS",
				Alpha3Code:       "TST",
				Numeric:          "999",
				Status:           "invalid_status",
			},
			wantErr: true,
		},
		{
			name: "missing status - must reject",
			input: RawCountryData{
				EnglishShortName: "Test Country",
				FrenchShortName:  "Pays de Test",
				Alpha2Code:       "TS",
				Alpha3Code:       "TST",
				Numeric:          "999",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := TransformToCountry(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("TransformToCountry() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr {
				return
			}

			// Compare fields
			if got.Alpha2 != tt.want.Alpha2 {
				t.Errorf("Alpha2 = %v, want %v", got.Alpha2, tt.want.Alpha2)
			}
			if got.Alpha3 != tt.want.Alpha3 {
				t.Errorf("Alpha3 = %v, want %v", got.Alpha3, tt.want.Alpha3)
			}
			if got.Numeric != tt.want.Numeric {
				t.Errorf("Numeric = %v, want %v", got.Numeric, tt.want.Numeric)
			}
			if got.NameEnglish != tt.want.NameEnglish {
				t.Errorf("NameEnglish = %v, want %v", got.NameEnglish, tt.want.NameEnglish)
			}
			if got.NameFrench != tt.want.NameFrench {
				t.Errorf("NameFrench = %v, want %v", got.NameFrench, tt.want.NameFrench)
			}
			if got.Status != tt.want.Status {
				t.Errorf("Status = %v, want %v", got.Status, tt.want.Status)
			}

			// Compare dates
			if !compareDates(got.StartDate, tt.want.StartDate) {
				t.Errorf("StartDate = %v, want %v", got.StartDate, tt.want.StartDate)
			}
			if !compareDates(got.EndDate, tt.want.EndDate) {
				t.Errorf("EndDate = %v, want %v", got.EndDate, tt.want.EndDate)
			}
		})
	}
}

// Helper function to parse test dates
func parseTestDate(dateStr string) *time.Time {
	t, _ := time.Parse("2006-01-02", dateStr)
	return &t
}

// Helper function to compare nullable dates
func compareDates(a, b *time.Time) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return a.Format("2006-01-02") == b.Format("2006-01-02")
}
