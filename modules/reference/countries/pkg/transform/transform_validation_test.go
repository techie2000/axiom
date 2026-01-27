package transform

import (
	"errors"
	"testing"

	"github.com/techie2000/axiom/modules/reference/countries/internal/model"
)

func TestTransformToCountry_OfficiallyAssigned(t *testing.T) {
	tests := []struct {
		name    string
		raw     RawCountryData
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid officially_assigned country",
			raw: RawCountryData{
				EnglishShortName: "United States of America",
				FrenchShortName:  "États-Unis d'Amérique",
				Alpha2Code:       "US",
				Alpha3Code:       "USA",
				Numeric:          "840",
				Status:           "officially_assigned",
			},
			wantErr: false,
		},
		{
			name: "missing alpha3 for officially_assigned",
			raw: RawCountryData{
				EnglishShortName: "United States",
				FrenchShortName:  "États-Unis",
				Alpha2Code:       "US",
				Alpha3Code:       "",
				Numeric:          "840",
				Status:           "officially_assigned",
			},
			wantErr: true,
			errMsg:  "alpha3 is required for officially_assigned status",
		},
		{
			name: "missing english name for officially_assigned",
			raw: RawCountryData{
				EnglishShortName: "",
				FrenchShortName:  "États-Unis",
				Alpha2Code:       "US",
				Alpha3Code:       "USA",
				Numeric:          "840",
				Status:           "officially_assigned",
			},
			wantErr: true,
			errMsg:  "name_english is required for officially_assigned status",
		},
		{
			name: "missing french name for officially_assigned",
			raw: RawCountryData{
				EnglishShortName: "United States",
				FrenchShortName:  "",
				Alpha2Code:       "US",
				Alpha3Code:       "USA",
				Numeric:          "840",
				Status:           "officially_assigned",
			},
			wantErr: true,
			errMsg:  "name_french is required for officially_assigned status",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			country, err := TransformToCountry(tt.raw)
			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error containing %q, got nil", tt.errMsg)
					return
				}
				if err.Error() != tt.errMsg {
					t.Errorf("expected error %q, got %q", tt.errMsg, err.Error())
				}
				return
			}
			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}
			if country == nil {
				t.Error("expected country, got nil")
				return
			}
			if country.Status != model.StatusOfficiallyAssigned {
				t.Errorf("expected status %s, got %s", model.StatusOfficiallyAssigned, country.Status)
			}
		})
	}
}

func TestTransformToCountry_ExceptionallyReserved(t *testing.T) {
	tests := []struct {
		name    string
		raw     RawCountryData
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid exceptionally_reserved code",
			raw: RawCountryData{
				EnglishShortName: "European Union",
				Alpha2Code:       "EU",
				Status:           "exceptionally_reserved",
				Remarks:          "Reserved for ISO 6166 (ISIN).",
			},
			wantErr: false,
		},
		{
			name: "missing remarks for exceptionally_reserved",
			raw: RawCountryData{
				EnglishShortName: "European Union",
				Alpha2Code:       "EU",
				Status:           "exceptionally_reserved",
				Remarks:          "",
			},
			wantErr: true,
			errMsg:  "remarks is required for exceptionally_reserved status (must explain reservation)",
		},
		{
			name: "missing english name for exceptionally_reserved",
			raw: RawCountryData{
				EnglishShortName: "",
				Alpha2Code:       "EU",
				Status:           "exceptionally_reserved",
				Remarks:          "Reserved",
			},
			wantErr: true,
			errMsg:  "name_english is required for exceptionally_reserved status",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			country, err := TransformToCountry(tt.raw)
			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error containing %q, got nil", tt.errMsg)
					return
				}
				if err.Error() != tt.errMsg {
					t.Errorf("expected error %q, got %q", tt.errMsg, err.Error())
				}
				return
			}
			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}
			if country.Remarks == "" {
				t.Error("expected remarks to be populated")
			}
		})
	}
}

func TestTransformToCountry_TransitionallyReserved(t *testing.T) {
	tests := []struct {
		name    string
		raw     RawCountryData
		wantErr bool
	}{
		{
			name: "valid transitionally_reserved code",
			raw: RawCountryData{
				EnglishShortName: "United Kingdom",
				Alpha2Code:       "UK",
				Status:           "transitionally_reserved",
				Remarks:          "Reserved transitionally. GB is officially assigned.",
			},
			wantErr: false,
		},
		{
			name: "missing remarks for transitionally_reserved",
			raw: RawCountryData{
				EnglishShortName: "United Kingdom",
				Alpha2Code:       "UK",
				Status:           "transitionally_reserved",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := TransformToCountry(tt.raw)
			if tt.wantErr && err == nil {
				t.Error("expected error, got nil")
			}
			if !tt.wantErr && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}

func TestTransformToCountry_Unassigned(t *testing.T) {
	tests := []struct {
		name    string
		raw     RawCountryData
		wantErr bool
	}{
		{
			name: "valid unassigned code",
			raw: RawCountryData{
				Alpha2Code: "ZZ",
				Status:     "unassigned",
				Remarks:    "Reserved for user assignment.",
			},
			wantErr: false,
		},
		{
			name: "unassigned with minimal data",
			raw: RawCountryData{
				Alpha2Code: "AA",
				Status:     "unassigned",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			country, err := TransformToCountry(tt.raw)
			if tt.wantErr {
				if err == nil {
					t.Error("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}
			if country.Alpha2 != tt.raw.Alpha2Code {
				t.Errorf("expected alpha2 %s, got %s", tt.raw.Alpha2Code, country.Alpha2)
			}
			if country.Status != model.StatusUnassigned {
				t.Errorf("expected status %s, got %s", model.StatusUnassigned, country.Status)
			}
		})
	}
}

func TestTransformToCountry_FormerlyUsed(t *testing.T) {
	tests := []struct {
		name string
		raw  RawCountryData
	}{
		{
			name: "formerly_used code should be skipped",
			raw: RawCountryData{
				EnglishShortName: "Gilbert and Ellice Islands",
				FrenchShortName:  "Îles Gilbert et Ellice",
				Alpha2Code:       "GE",
				Alpha3Code:       "GEL",

				Numeric:          "296",
				Status:           "formerly_used",
				StartDate:        "1974-01-01",
				EndDate:          "1979-12-31",
				Remarks:          "Code reassigned to Georgia.",
			},
		},
		{
			name: "another formerly_used code",
			raw: RawCountryData{
				EnglishShortName: "Yugoslavia",
				FrenchShortName:  "Yougoslavie",
				Alpha2Code:       "YU",
				Alpha3Code:       "YUG",

				Numeric:          "891",
				Status:           "formerly_used",
				StartDate:        "1974-01-01",
				EndDate:          "2003-07-14",
				Remarks:          "Country dissolved.",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			country, err := TransformToCountry(tt.raw)

			// Should return ErrFormerlyUsedSkipped
			if !errors.Is(err, ErrFormerlyUsedSkipped) {
				t.Errorf("expected ErrFormerlyUsedSkipped, got %v", err)
			}

			// Should not return a country
			if country != nil {
				t.Errorf("expected nil country for formerly_used status, got %+v", country)
			}
		})
	}
}

func TestTransformToCountry_MissingStatus(t *testing.T) {
	raw := RawCountryData{
		EnglishShortName: "Test Country",
		Alpha2Code:       "TC",
		Alpha3Code:       "TST",
		Numeric:          "999",
		Status:           "", // Missing status
	}

	_, err := TransformToCountry(raw)
	if err == nil {
		t.Error("expected error for missing status, got nil")
	}
}

func TestTransformToCountry_InvalidStatus(t *testing.T) {
	raw := RawCountryData{
		EnglishShortName: "Test Country",
		Alpha2Code:       "TC",
		Alpha3Code:       "TST",
		Numeric:          "999",
		Status:           "invalid_status",
	}

	_, err := TransformToCountry(raw)
	if err == nil {
		t.Error("expected error for invalid status, got nil")
	}
}

func TestTransformToCountry_MissingAlpha2(t *testing.T) {
	raw := RawCountryData{
		EnglishShortName: "Test Country",
		Alpha2Code:       "", // Missing alpha2
		Status:           "officially_assigned",
	}

	_, err := TransformToCountry(raw)
	if err == nil {
		t.Error("expected error for missing alpha2, got nil")
	}
}

func TestTransformToCountry_NumericPadding(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"single digit", "4", "004"},
		{"two digits", "36", "036"},
		{"three digits", "840", "840"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			raw := RawCountryData{
				EnglishShortName: "Test",
				FrenchShortName:  "Test",
				Alpha2Code:       "TC",
				Alpha3Code:       "TST",
				Numeric:          tt.input,
				Status:           "officially_assigned",
			}

			country, err := TransformToCountry(raw)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if country.Numeric != tt.expected {
				t.Errorf("expected numeric %s, got %s", tt.expected, country.Numeric)
			}
		})
	}
}

func TestTransformToCountry_Normalization(t *testing.T) {
	raw := RawCountryData{
		EnglishShortName: "  Test Country  ",
		FrenchShortName:  "  Pays Test  ",
		Alpha2Code:       "  tc  ", // Should be uppercased
		Alpha3Code:       "  tst  ",
		Numeric:          "  999  ",
		Status:           "officially_assigned",
	}

	country, err := TransformToCountry(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if country.Alpha2 != "TC" {
		t.Errorf("expected alpha2 'TC', got '%s'", country.Alpha2)
	}
	if country.Alpha3 != "TST" {
		t.Errorf("expected alpha3 'TST', got '%s'", country.Alpha3)
	}
	if country.NameEnglish != "Test Country" {
		t.Errorf("expected trimmed English name, got '%s'", country.NameEnglish)
	}
}
