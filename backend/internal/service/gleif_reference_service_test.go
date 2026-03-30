package service

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/repository"
)

// --- stub repositories ---

type stubRARepo struct {
	deactivateCalled int
	upserted         []*domain.GLEIFRegistrationAuthority
}

func (r *stubRARepo) Upsert(records []*domain.GLEIFRegistrationAuthority) error {
	r.upserted = append(r.upserted, records...)
	return nil
}
func (r *stubRARepo) DeactivateAll() error  { r.deactivateCalled++; return nil }
func (r *stubRARepo) Count() (int64, error) { return int64(len(r.upserted)), nil }
func (r *stubRARepo) FindAll(_ int, _ int) ([]*domain.GLEIFRegistrationAuthority, error) {
	return r.upserted, nil
}
func (r *stubRARepo) FindByRAID(_ string) (*domain.GLEIFRegistrationAuthority, error) {
	return nil, nil
}

var _ repository.GLEIFRegistrationAuthorityRepository = (*stubRARepo)(nil)

type stubELFRepo struct {
	deactivateCalled int
	upserted         []*domain.GLEIFEntityLegalForm
}

func (r *stubELFRepo) Upsert(records []*domain.GLEIFEntityLegalForm) error {
	r.upserted = append(r.upserted, records...)
	return nil
}
func (r *stubELFRepo) Count() (int64, error) { return int64(len(r.upserted)), nil }
func (r *stubELFRepo) FindAll(_ int, _ int) ([]*domain.GLEIFEntityLegalForm, error) {
	return r.upserted, nil
}
func (r *stubELFRepo) FindByELFCode(_ string) (*domain.GLEIFEntityLegalForm, error) { return nil, nil }
func (r *stubELFRepo) DeactivateAll() error                                         { r.deactivateCalled++; return nil }

var _ repository.GLEIFEntityLegalFormRepository = (*stubELFRepo)(nil)

type stubRoleRepo struct {
	deactivateCalled int
	upserted         []*domain.GLEIFOrganizationalRole
}

func (r *stubRoleRepo) Upsert(records []*domain.GLEIFOrganizationalRole) error {
	r.upserted = append(r.upserted, records...)
	return nil
}
func (r *stubRoleRepo) DeactivateAll() error  { r.deactivateCalled++; return nil }
func (r *stubRoleRepo) Count() (int64, error) { return int64(len(r.upserted)), nil }
func (r *stubRoleRepo) FindAll(_ int, _ int) ([]*domain.GLEIFOrganizationalRole, error) {
	return r.upserted, nil
}
func (r *stubRoleRepo) FindByRoleCode(_ string) (*domain.GLEIFOrganizationalRole, error) {
	return nil, nil
}

var _ repository.GLEIFOrganizationalRoleRepository = (*stubRoleRepo)(nil)

type stubJurRepo struct {
	deactivateCalled int
	upserted         []*domain.GLEIFLegalJurisdiction
}

func (r *stubJurRepo) Upsert(records []*domain.GLEIFLegalJurisdiction) error {
	r.upserted = append(r.upserted, records...)
	return nil
}
func (r *stubJurRepo) DeactivateAll() error  { r.deactivateCalled++; return nil }
func (r *stubJurRepo) Count() (int64, error) { return int64(len(r.upserted)), nil }
func (r *stubJurRepo) FindAll(_ int, _ int) ([]*domain.GLEIFLegalJurisdiction, error) {
	return r.upserted, nil
}
func (r *stubJurRepo) FindByCode(_ string) (*domain.GLEIFLegalJurisdiction, error) { return nil, nil }

var _ repository.GLEIFLegalJurisdictionRepository = (*stubJurRepo)(nil)

// --- helpers ---

func newTestGLEIFSvc(
	client *http.Client,
	raRepo repository.GLEIFRegistrationAuthorityRepository,
	elfRepo repository.GLEIFEntityLegalFormRepository,
	roleRepo repository.GLEIFOrganizationalRoleRepository,
	jurRepo repository.GLEIFLegalJurisdictionRepository,
) *gleifReferenceService {
	return &gleifReferenceService{
		raRepo:   raRepo,
		elfRepo:  elfRepo,
		roleRepo: roleRepo,
		jurRepo:  jurRepo,
		client:   client,
		urls:     DefaultGLEIFReferenceURLs(),
	}
}

// --- tests ---

func TestParseRegistrationAuthoritiesCSV(t *testing.T) {
	// Tab-separated: RA-ID | Org Name | Jurisdiction | International Name | Languages | Website | Comments
	csvData := "RA-ID\tOrg\tJurisdiction\tIntl Name\tLangs\tWebsite\tComments\n" +
		"RA000001\tAustrian Business Authority\tAT\tRegistrar Austria\ten\thttps://example.com\t\n" +
		"RA000002\tGerman Commercial Register\tDE\t\tde\thttps://example.de\t\n"

	records, err := parseRegistrationAuthoritiesCSV(io.NopCloser(strings.NewReader(csvData)))
	if err != nil {
		t.Fatalf("parseRegistrationAuthoritiesCSV: %v", err)
	}
	if len(records) != 2 {
		t.Fatalf("expected 2 records, got %d", len(records))
	}
	if records[0].RAID != "RA000001" {
		t.Errorf("expected RAID RA000001, got %s", records[0].RAID)
	}
	if records[0].OrganizationName != "Austrian Business Authority" {
		t.Errorf("unexpected org name: %s", records[0].OrganizationName)
	}
	if records[0].Jurisdiction != "AT" {
		t.Errorf("expected jurisdiction AT, got %s", records[0].Jurisdiction)
	}
	if records[1].RAID != "RA000002" {
		t.Errorf("expected RAID RA000002, got %s", records[1].RAID)
	}
	if !records[0].Active {
		t.Errorf("expected Active=true")
	}
}

func TestParseRegistrationAuthoritiesCSV_SkipsCommentAndEmptyRows(t *testing.T) {
	csvData := "Header\n" +
		"#comment\n" +
		"\t\n" +
		"RA000001\tValid Authority\tUS\t\t\t\t\n"

	records, err := parseRegistrationAuthoritiesCSV(io.NopCloser(strings.NewReader(csvData)))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}
	if records[0].RAID != "RA000001" {
		t.Errorf("expected RA000001, got %s", records[0].RAID)
	}
}

func TestParseEntityLegalFormsCSV(t *testing.T) {
	// Tab-separated: ELF Code | Country | Subdivision | Legal Form Name | Abbreviation | Status
	csvData := "ELF Code\tCountry\tSubdivision\tLegalFormName\tAbbreviation\tStatus\n" +
		"2HBR\tDE\t\tGmbH (private limited company)\tGmbH\tACTIVE\n" +
		"3FWQ\tFR\t\tSociete Anonyme\tSA\t\n"

	records, err := parseEntityLegalFormsCSV(io.NopCloser(strings.NewReader(csvData)))
	if err != nil {
		t.Fatalf("parseEntityLegalFormsCSV: %v", err)
	}
	if len(records) != 2 {
		t.Fatalf("expected 2 records, got %d", len(records))
	}
	if records[0].ELFCode != "2HBR" {
		t.Errorf("expected ELF code 2HBR, got %s", records[0].ELFCode)
	}
	if records[0].EntityLegalFormName != "GmbH (private limited company)" {
		t.Errorf("unexpected legal form name: %s", records[0].EntityLegalFormName)
	}
	if records[0].CountryOfFormation != "DE" {
		t.Errorf("expected country DE, got %s", records[0].CountryOfFormation)
	}
	// Status defaults to ACTIVE when blank
	if records[1].Status != "ACTIVE" {
		t.Errorf("expected default ACTIVE status, got %s", records[1].Status)
	}
}

func TestParseOrganizationalRolesCSV(t *testing.T) {
	// Tab-separated: Role Code | Role Name | Description
	csvData := "Role Code\tRole Name\tDescription\n" +
		"DIRECTOR\tDirector\tMember of the board of directors\n" +
		"CEO\tChief Executive Officer\tHead of the company\n"

	records, err := parseOrganizationalRolesCSV(io.NopCloser(strings.NewReader(csvData)))
	if err != nil {
		t.Fatalf("parseOrganizationalRolesCSV: %v", err)
	}
	if len(records) != 2 {
		t.Fatalf("expected 2 records, got %d", len(records))
	}
	if records[0].RoleCode != "DIRECTOR" {
		t.Errorf("expected DIRECTOR, got %s", records[0].RoleCode)
	}
	if records[1].RoleName != "Chief Executive Officer" {
		t.Errorf("unexpected role name: %s", records[1].RoleName)
	}
}

func TestParseLegalJurisdictionsCSV(t *testing.T) {
	// Tab-separated: Code | Name | Country
	csvData := "Code\tName\tCountry\n" +
		"US-CA\tCalifornia\tUS\n" +
		"DE\tGermany\tDE\n"

	records, err := parseLegalJurisdictionsCSV(io.NopCloser(strings.NewReader(csvData)))
	if err != nil {
		t.Fatalf("parseLegalJurisdictionsCSV: %v", err)
	}
	if len(records) != 2 {
		t.Fatalf("expected 2 records, got %d", len(records))
	}
	if records[0].JurisdictionCode != "US-CA" {
		t.Errorf("expected US-CA, got %s", records[0].JurisdictionCode)
	}
	if records[0].CountryCode != "US" {
		t.Errorf("expected country US, got %s", records[0].CountryCode)
	}
	if records[1].JurisdictionCode != "DE" {
		t.Errorf("expected DE, got %s", records[1].JurisdictionCode)
	}
}

func TestParseLegalJurisdictionsCSV_DeriveCountryFromCode(t *testing.T) {
	// When column 2 is absent, country code is derived from the jurisdiction code prefix.
	csvData := "Code\tName\n" +
		"GB-ENG\tEngland\n"

	records, err := parseLegalJurisdictionsCSV(io.NopCloser(strings.NewReader(csvData)))
	if err != nil {
		t.Fatalf("parseLegalJurisdictionsCSV: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}
	if records[0].CountryCode != "GB" {
		t.Errorf("expected derived country GB, got %s", records[0].CountryCode)
	}
}

func TestGLEIFDownloadCSV_NonOKStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	svc := newTestGLEIFSvc(srv.Client(), &stubRARepo{}, &stubELFRepo{}, &stubRoleRepo{}, &stubJurRepo{})

	_, err := svc.downloadCSV(srv.URL)
	if err == nil {
		t.Fatal("expected error for non-200 status, got nil")
	}
	if !strings.Contains(err.Error(), "404") {
		t.Errorf("expected 404 in error, got: %v", err)
	}
}

func TestSafeCol_OutOfRange(t *testing.T) {
	row := []string{"a", "b"}
	if got := safeCol(row, 5); got != "" {
		t.Errorf("expected empty string for out-of-range index, got %q", got)
	}
	if got := safeCol(row, 0); got != "a" {
		t.Errorf("expected 'a', got %q", got)
	}
}
