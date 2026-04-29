package repository

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
)

func TestBuildProvisionalLEIInsertStatement_ColumnValueCountMatch(t *testing.T) {
	t.Helper()

	stmt, err := buildProvisionalLEIInsertStatement()
	if err != nil {
		t.Fatalf("buildProvisionalLEIInsertStatement returned error: %v", err)
	}

	if got, want := len(provisionalLEIInsertColumns), len(provisionalLEIInsertValues); got != want {
		t.Fatalf("column/value expression mismatch: got %d columns and %d values", got, want)
	}

	placeholderCount := strings.Count(stmt, "?")
	if placeholderCount != len(provisionalLEIInsertColumns) {
		t.Fatalf("placeholder count mismatch: got %d placeholders, want %d", placeholderCount, len(provisionalLEIInsertColumns))
	}
}

func TestProvisionalLEIInsertArgs_MatchesInsertShape(t *testing.T) {
	t.Helper()

	now := time.Now().UTC()
	record := &domain.LEIRecord{
		ID:                      uuid.New(),
		LEI:                     "AXIO1234567890ABCD12",
		LegalName:               "Test Legal Name",
		LegalAddressCountry:     "GB",
		HQAddressCountry:        "GB",
		EntityStatus:            "ACTIVE",
		RegistrationStatus:      "ISSUED",
		IsProvisional:           true,
		ProvisioningSource:      "test",
		InitialRegistrationDate: now,
		LastUpdateDate:          now,
		NextRenewalDate:         now.AddDate(1, 0, 0),
		CreatedAt:               now,
		UpdatedAt:               now,
	}

	stmt, err := buildProvisionalLEIInsertStatement()
	if err != nil {
		t.Fatalf("buildProvisionalLEIInsertStatement returned error: %v", err)
	}

	args := provisionalLEIInsertArgs(record)
	if got, want := len(args), strings.Count(stmt, "?"); got != want {
		t.Fatalf("arg count mismatch: got %d args, want %d", got, want)
	}
}

func TestValidateLEICode(t *testing.T) {
	t.Helper()

	if err := validateLEICode("AXIOFBQ64ZKYWLW1PO76"); err != nil {
		t.Fatalf("expected valid LEI, got error: %v", err)
	}

	if err := validateLEICode("SHORT"); err == nil {
		t.Fatalf("expected invalid length error")
	}

	if err := validateLEICode("AXIOFBQ64ZKYWLW1PO7X"); err == nil {
		t.Fatalf("expected invalid check digit error")
	}
}
