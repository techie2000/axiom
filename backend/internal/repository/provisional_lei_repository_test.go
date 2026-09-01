package repository

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
)

func TestProvisionalLEIInsertPayload_ContainsExpectedValues(t *testing.T) {
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
		Notes:                   "initial note",
		InitialRegistrationDate: now,
		LastUpdateDate:          now,
		NextRenewalDate:         now.AddDate(1, 0, 0),
		CreatedAt:               now,
		UpdatedAt:               now,
	}

	payload := provisionalLEIInsertPayload(record)

	if got := payload["lei"]; got != record.LEI {
		t.Fatalf("payload lei = %v, want %v", got, record.LEI)
	}
	if got := payload["is_provisional"]; got != true {
		t.Fatalf("payload is_provisional = %v, want true", got)
	}
	if got := payload["provisioning_source"]; got != record.ProvisioningSource {
		t.Fatalf("payload provisioning_source = %v, want %v", got, record.ProvisioningSource)
	}
	if got := payload["notes"]; got != record.Notes {
		t.Fatalf("payload notes = %v, want %v", got, record.Notes)
	}
}

func TestProvisionalLEIInsertPayload_ConvertsConstrainedEmptyStringsToNull(t *testing.T) {
	t.Helper()

	record := &domain.LEIRecord{
		ID:                    uuid.New(),
		LEI:                   "AXIOFBQ64ZKYWLW1PO76",
		LegalName:             "Null coercion test",
		LegalAddressCountry:   "",
		HQAddressCountry:      "",
		RegistrationAuthority: "",
		EntityLegalForm:       "",
		LegalJurisdiction:     "",
		ManagingLOU:           "",
		SuccessorLEI:          "",
		ValidationAuthority:   "",
	}

	payload := provisionalLEIInsertPayload(record)

	keys := []string{
		"legal_address_country",
		"hq_address_country",
		"registration_authority",
		"entity_legal_form",
		"legal_jurisdiction",
		"managing_lou",
		"successor_lei",
		"validation_authority",
	}

	for _, key := range keys {
		if payload[key] != nil {
			t.Fatalf("expected %s to be nil when source value is empty string, got %v", key, payload[key])
		}
	}
}

func TestProvisionalLEIUpdatePayload_ConvertsConstrainedEmptyStringsToNull(t *testing.T) {
	t.Helper()

	// Regression test: Verify UPDATE payload converts empty country/jurisdiction to NULL.
	// Issue #546: Empty string for legal_address_country triggered domain constraint violation.
	// Update path must wrap these fields with nullableString() just like Create path.
	record := &domain.LEIRecord{
		ID:                  uuid.New(),
		LegalName:           "Test Update",
		LegalAddressCountry: "", // Empty string should become NULL
		LegalJurisdiction:   "", // Empty string should become NULL
		LegalAddressCity:    "London",
		EntityStatus:        "ACTIVE",
		ProvisioningSource:  "update-test",
	}

	payload := provisionalLEIUpdatePayload(record)

	// These fields should be nil (NULL in SQL) when source is empty string
	constrainedFields := []string{"legal_address_country", "legal_jurisdiction"}
	for _, key := range constrainedFields {
		if payload[key] != nil {
			t.Fatalf("expected %s to be nil for empty string (UPDATE path), got %v", key, payload[key])
		}
	}

	// Non-constrained fields should still work normally
	if payload["legal_address_city"] != record.LegalAddressCity {
		t.Fatalf("payload legal_address_city = %v, want %v", payload["legal_address_city"], record.LegalAddressCity)
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
