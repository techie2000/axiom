package service

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/techie2000/axiom/internal/domain"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// Stub repository
// ---------------------------------------------------------------------------

type raRepoStub struct {
	records  map[string]*domain.RegistrationAuthority
	upsertFn func(ra *domain.RegistrationAuthority) (bool, error)
}

func newRARepoStub() *raRepoStub {
	return &raRepoStub{records: make(map[string]*domain.RegistrationAuthority)}
}

func (r *raRepoStub) UpsertRegistrationAuthority(ra *domain.RegistrationAuthority) (bool, error) {
	if r.upsertFn != nil {
		return r.upsertFn(ra)
	}
	_, existed := r.records[ra.RACode]
	r.records[ra.RACode] = ra
	return existed, nil
}

func (r *raRepoStub) FindByRACode(raCode string) (*domain.RegistrationAuthority, error) {
	ra, ok := r.records[raCode]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return ra, nil
}

func (r *raRepoStub) FindAll(limit, offset int) ([]*domain.RegistrationAuthority, error) {
	var result []*domain.RegistrationAuthority
	for _, ra := range r.records {
		result = append(result, ra)
	}
	return result, nil
}

func (r *raRepoStub) Count() (int64, error) {
	return int64(len(r.records)), nil
}

// ---------------------------------------------------------------------------
// parseCSV unit tests
// ---------------------------------------------------------------------------

const sampleRACSV = `Registration Authority Code,Country Code,Registration Authority Name,International name of the Registration Authority,Website,Notes
RA000001,GB,Companies House,Companies House,https://www.gov.uk/government/organisations/companies-house,
RA000585,US,Securities and Exchange Commission,SEC,https://www.sec.gov,
RA999999,,Unknown Authority,,"",No country code
`

func TestRegistrationAuthorityService_parseCSV_ValidRows(t *testing.T) {
	svc := &registrationAuthorityService{}
	records, err := svc.parseCSV(sampleRACSV)
	if err != nil {
		t.Fatalf("parseCSV returned unexpected error: %v", err)
	}
	if len(records) != 3 {
		t.Fatalf("expected 3 records, got %d", len(records))
	}

	// Check first record
	r := records[0]
	if r.RACode != "RA000001" {
		t.Errorf("expected RACode RA000001, got %q", r.RACode)
	}
	if r.CountryCode != "GB" {
		t.Errorf("expected CountryCode GB, got %q", r.CountryCode)
	}
	if r.RAName != "Companies House" {
		t.Errorf("expected RAName 'Companies House', got %q", r.RAName)
	}
	if r.InternationalName != "Companies House" {
		t.Errorf("expected InternationalName 'Companies House', got %q", r.InternationalName)
	}
	if r.Website != "https://www.gov.uk/government/organisations/companies-house" {
		t.Errorf("unexpected Website: %q", r.Website)
	}
}

func TestRegistrationAuthorityService_parseCSV_SecondRecord(t *testing.T) {
	svc := &registrationAuthorityService{}
	records, err := svc.parseCSV(sampleRACSV)
	if err != nil {
		t.Fatalf("parseCSV returned unexpected error: %v", err)
	}

	r := records[1]
	if r.RACode != "RA000585" {
		t.Errorf("expected RACode RA000585, got %q", r.RACode)
	}
	if r.CountryCode != "US" {
		t.Errorf("expected CountryCode US, got %q", r.CountryCode)
	}
	if r.InternationalName != "SEC" {
		t.Errorf("expected InternationalName 'SEC', got %q", r.InternationalName)
	}
}

func TestRegistrationAuthorityService_parseCSV_MissingRACode(t *testing.T) {
	csv := `Registration Authority Code,Registration Authority Name
,Missing Code Authority
`
	svc := &registrationAuthorityService{}
	records, err := svc.parseCSV(csv)
	// Should return error because no valid rows remain
	if err == nil && len(records) == 0 {
		// Either error or zero rows is acceptable
		return
	}
	if err != nil {
		return
	}
	// If no error, all returned records must have non-empty RA codes
	for _, r := range records {
		if r.RACode == "" {
			t.Errorf("record with empty RACode should not be returned")
		}
	}
}

func TestRegistrationAuthorityService_parseCSV_EmptyCSV(t *testing.T) {
	csv := `Registration Authority Code,Registration Authority Name
`
	svc := &registrationAuthorityService{}
	_, err := svc.parseCSV(csv)
	if err == nil {
		t.Error("expected error for empty CSV body, got nil")
	}
}

func TestRegistrationAuthorityService_parseCSV_MissingRequiredColumn(t *testing.T) {
	csv := `Country Code,Website
GB,https://example.com
`
	svc := &registrationAuthorityService{}
	_, err := svc.parseCSV(csv)
	if err == nil {
		t.Error("expected error when required RA code column is missing")
	}
}

func TestRegistrationAuthorityService_parseCSV_LeadingTrailingSpaces(t *testing.T) {
	csv := `Registration Authority Code,Registration Authority Name
  RA000001  ,  Companies House  
`
	svc := &registrationAuthorityService{}
	records, err := svc.parseCSV(csv)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}
	if records[0].RACode != "RA000001" {
		t.Errorf("expected trimmed RACode, got %q", records[0].RACode)
	}
	if records[0].RAName != "Companies House" {
		t.Errorf("expected trimmed RAName, got %q", records[0].RAName)
	}
}

// ---------------------------------------------------------------------------
// SyncFromGLEIF integration test (using a local HTTP test server)
// ---------------------------------------------------------------------------

func TestRegistrationAuthorityService_SyncFromGLEIF_HappyPath(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/csv")
		fmt.Fprint(w, sampleRACSV)
	}))
	defer ts.Close()

	stub := newRARepoStub()
	svc := NewRegistrationAuthorityService(stub, ts.URL)

	created, updated, err := svc.SyncFromGLEIF()
	if err != nil {
		t.Fatalf("SyncFromGLEIF returned unexpected error: %v", err)
	}
	if created != 3 {
		t.Errorf("expected 3 created, got %d", created)
	}
	if updated != 0 {
		t.Errorf("expected 0 updated, got %d", updated)
	}
}

func TestRegistrationAuthorityService_SyncFromGLEIF_UpdatesExisting(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/csv")
		fmt.Fprint(w, sampleRACSV)
	}))
	defer ts.Close()

	stub := newRARepoStub()
	// Pre-populate to trigger updates
	stub.records["RA000001"] = &domain.RegistrationAuthority{RACode: "RA000001", RAName: "Old Name"}
	stub.records["RA000585"] = &domain.RegistrationAuthority{RACode: "RA000585", RAName: "Old Name 2"}

	svc := NewRegistrationAuthorityService(stub, ts.URL)
	created, updated, err := svc.SyncFromGLEIF()
	if err != nil {
		t.Fatalf("SyncFromGLEIF returned unexpected error: %v", err)
	}
	// 2 updated (already existed), 1 created (RA999999)
	if updated != 2 {
		t.Errorf("expected 2 updated, got %d", updated)
	}
	if created != 1 {
		t.Errorf("expected 1 created, got %d", created)
	}
}

func TestRegistrationAuthorityService_parseCSV_EmptyOptionalFields(t *testing.T) {
	csv := `Registration Authority Code,Country Code,Registration Authority Name,International name of the Registration Authority,Website,Notes
RA000001,,Minimal Authority,,,
`
	svc := &registrationAuthorityService{}
	records, err := svc.parseCSV(csv)
	if err != nil {
		t.Fatalf("parseCSV returned unexpected error: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}
	r := records[0]
	if r.CountryCode != "" {
		t.Errorf("expected empty CountryCode, got %q", r.CountryCode)
	}
	if r.InternationalName != "" {
		t.Errorf("expected empty InternationalName, got %q", r.InternationalName)
	}
	if r.Website != "" {
		t.Errorf("expected empty Website, got %q", r.Website)
	}
	if r.GLEIFNotes != "" {
		t.Errorf("expected empty GLEIFNotes, got %q", r.GLEIFNotes)
	}
}

func TestRegistrationAuthorityService_SyncFromGLEIF_ServerError(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "internal server error", http.StatusInternalServerError)
	}))
	defer ts.Close()

	stub := newRARepoStub()
	svc := NewRegistrationAuthorityService(stub, ts.URL)

	_, _, err := svc.SyncFromGLEIF()
	if err == nil {
		t.Error("expected error for HTTP 500, got nil")
	}
	if !strings.Contains(err.Error(), "500") {
		t.Errorf("expected error to mention HTTP status 500, got: %v", err)
	}
}
