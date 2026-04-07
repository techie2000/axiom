package service

import (
	"fmt"
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
	// Use comma format (current GLEIF format); detector reads the header line to choose delimiter.
	csvData := "\"Registration Authority Code\",\"Country\",\"Country Code\",\"Jurisdiction\",\"International name of Register\",\"Local name\",\"Intl org name\",\"Local org name\",\"Website\",\"Comments\"\n" +
		"\"#comment\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"\n" +
		"\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"\n" +
		"\"RA000001\",\"United States\",\"US\",\"US\",\"\",\"\",\"Valid Authority\",\"\",\"https://example.us\",\"\"\n"

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

func TestParseRegistrationAuthoritiesCSV_CommaFormat(t *testing.T) {
	csvData := "\"Registration Authority Code\",\"Country\",\"Country Code\",\"Jurisdiction\",\"International name of Register\",\"Local name of Register\",\"International name of organisation responsible for the Register\",\"Local name of organisation responsible for the Register\",\"Website\",\"Comments\"\n" +
		"\"RA000001\",\"Austria\",\"AT\",\"Austria\",\"Commercial Register\",\"\",\"Federal Ministry of Justice\",\"\",\"https://example.at\",\"\"\n"

	records, err := parseRegistrationAuthoritiesCSV(io.NopCloser(strings.NewReader(csvData)))
	if err != nil {
		t.Fatalf("parseRegistrationAuthoritiesCSV: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}
	if records[0].RAID != "RA000001" {
		t.Fatalf("expected RA000001, got %s", records[0].RAID)
	}
	if records[0].OrganizationName != "Federal Ministry of Justice" {
		t.Fatalf("unexpected organization name: %s", records[0].OrganizationName)
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

func TestParseEntityLegalFormsCSV_CommaFormat(t *testing.T) {
	csvData := "\"ELF Code\",\"Country of formation\",\"Country Code (ISO 3166-1)\",\"Jurisdiction\",\"Subdivision\",\"Entity Legal Form name Local name\",\"Language\",\"Language Code\",\"Entity Legal Form name Transliterated\",\"Abbreviations Local\",\"Abbreviations transliterated\",\"Date created\",\"ELF Status ACTV/INAC\"\n" +
		"\"F0A6\",\"Argentina\",\"AR\",\"\",\"\",\"Sociedad Anonima\",\"Spanish\",\"es\",\"Sociedad Anonima\",\"S.A.\",\"\",\"2020-11-19\",\"ACTV\"\n"

	records, err := parseEntityLegalFormsCSV(io.NopCloser(strings.NewReader(csvData)))
	if err != nil {
		t.Fatalf("parseEntityLegalFormsCSV: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}
	if records[0].ELFCode != "F0A6" {
		t.Fatalf("expected F0A6, got %s", records[0].ELFCode)
	}
	if records[0].CountryOfFormation != "AR" {
		t.Fatalf("expected AR, got %s", records[0].CountryOfFormation)
	}
	if records[0].Status != "ACTIVE" {
		t.Fatalf("expected ACTIVE, got %s", records[0].Status)
	}
}

func TestParseEntityLegalFormsCSV_TruncatesLongAbbreviations(t *testing.T) {
	longAbbrev := strings.Repeat("A", 140)
	csvData := "\"ELF Code\",\"Country\",\"Country Code\",\"Jurisdiction\",\"Subdivision\",\"Name\",\"Language\",\"LangCode\",\"Name Transl\",\"Abbrev Local\",\"Abbrev Transl\",\"Date\",\"Status\"\n" +
		"\"F0A6\",\"Argentina\",\"AR\",\"\",\"\",\"Sociedad Anonima\",\"Spanish\",\"es\",\"Sociedad Anonima\",\"" + longAbbrev + "\",\"\",\"2020-11-19\",\"ACTV\"\n"

	records, err := parseEntityLegalFormsCSV(io.NopCloser(strings.NewReader(csvData)))
	if err != nil {
		t.Fatalf("parseEntityLegalFormsCSV: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}
	if len(records[0].Abbreviations) != 100 {
		t.Fatalf("expected abbreviations length 100, got %d", len(records[0].Abbreviations))
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

func TestParseLegalJurisdictionsCSV_CommaFormat(t *testing.T) {
	csvData := "\"Jurisdiction\",\"Code\",\"Type\"\n" +
		"\"United Arab Emirates\",\"AE\",\"COUNTRY_AND_SUBDIVISION\"\n"

	records, err := parseLegalJurisdictionsCSV(io.NopCloser(strings.NewReader(csvData)))
	if err != nil {
		t.Fatalf("parseLegalJurisdictionsCSV: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}
	if records[0].JurisdictionCode != "AE" {
		t.Fatalf("expected AE, got %s", records[0].JurisdictionCode)
	}
	if records[0].JurisdictionName != "United Arab Emirates" {
		t.Fatalf("unexpected name: %s", records[0].JurisdictionName)
	}
	if records[0].CountryCode != "AE" {
		t.Fatalf("expected country AE, got %s", records[0].CountryCode)
	}
}

func TestDedupeOrganizationalRoles(t *testing.T) {
	roles := []*domain.GLEIFOrganizationalRole{
		{RoleCode: "CEO", RoleName: "Chief Executive Officer"},
		{RoleCode: "CEO", RoleName: "Chief Executive Officer Updated"},
		{RoleCode: "CFO", RoleName: "Chief Financial Officer"},
	}

	deduped, dropped, dupCodes := dedupeOrganizationalRoles(roles)
	if dropped != 1 {
		t.Fatalf("expected 1 dropped duplicate, got %d", dropped)
	}
	if len(deduped) != 2 {
		t.Fatalf("expected 2 deduplicated roles, got %d", len(deduped))
	}
	if deduped[0].RoleCode != "CEO" || deduped[0].RoleName != "Chief Executive Officer Updated" {
		t.Fatalf("expected last duplicate to win for CEO, got %+v", deduped[0])
	}
	if len(dupCodes) != 1 || dupCodes[0] != "CEO" {
		t.Errorf("expected duplicate_codes=[CEO], got %v", dupCodes)
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

func TestGLEIFDownloadCSV_SetsHeaders(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("User-Agent"), "AxiomGLEIFSync") {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		if !strings.Contains(strings.ToLower(r.Header.Get("Accept")), "text/csv") {
			w.WriteHeader(http.StatusNotAcceptable)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("col1\tcol2\n"))
	}))
	defer srv.Close()

	svc := newTestGLEIFSvc(srv.Client(), &stubRARepo{}, &stubELFRepo{}, &stubRoleRepo{}, &stubJurRepo{})

	body, err := svc.downloadCSV(srv.URL)
	if err != nil {
		t.Fatalf("expected successful download, got error: %v", err)
	}
	if len(body) == 0 {
		t.Fatal("expected non-empty CSV body")
	}
}

func TestShouldAttemptDiscoveryFallback(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{name: "nil", err: nil, want: false},
		{name: "404", err: fmt.Errorf("HTTP 404 from url"), want: true},
		{name: "redirect loop", err: fmt.Errorf("Get x: stopped after 10 redirects"), want: true},
		{name: "too many redirects", err: fmt.Errorf("Get x: too many redirects"), want: true},
		{name: "other", err: fmt.Errorf("dial tcp timeout"), want: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := shouldAttemptDiscoveryFallback(tc.err)
			if got != tc.want {
				t.Fatalf("shouldAttemptDiscoveryFallback() = %v, want %v", got, tc.want)
			}
		})
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

func TestExtractCSVLinkCandidates(t *testing.T) {
	html := `<a href="/lei-data/code-lists/gleif-registration-authorities-list/2024-11-20_ra-list-v1.8.1.csv">csv</a>
<a href="https://www.gleif.org/lei-data/code-lists/gleif-registration-authorities-list/2024-11-20_ra-list-v1.8.1-changelog.csv">changes</a>`

	candidates := extractCSVLinkCandidates(html)
	if len(candidates) != 2 {
		t.Fatalf("expected 2 candidates, got %d", len(candidates))
	}
	if !strings.Contains(candidates[0], "ra-list-v1.8.1.csv") {
		t.Fatalf("unexpected first candidate: %s", candidates[0])
	}
}

func TestChooseBestCSVLink_PrefersKeywordAndNonChangelog(t *testing.T) {
	candidates := []string{
		"https://www.gleif.org/lei-data/code-lists/iso-20275-entity-legal-forms-code-list/2026-02-19-elf-code-list-changes-from-v1.5-to-v1.6.csv",
		"https://www.gleif.org/lei-data/code-lists/iso-20275-entity-legal-forms-code-list/2026-02-19-elf-code-list-v1.6.csv",
	}

	selected := chooseBestCSVLink(candidates, []string{"elf", "legal", "forms"})
	if !strings.Contains(selected, "elf-code-list-v1.6.csv") {
		t.Fatalf("expected non-changelog ELF CSV, got %s", selected)
	}
}

func TestSyncRegistrationAuthorities_UsesExistingDataWhenDownloadFails(t *testing.T) {
	raRepo := &stubRARepo{
		upserted: []*domain.GLEIFRegistrationAuthority{{RAID: "RA000001"}},
	}
	svc := newTestGLEIFSvc(http.DefaultClient, raRepo, &stubELFRepo{}, &stubRoleRepo{}, &stubJurRepo{})
	svc.urls.RegistrationAuthorities = "http://127.0.0.1:1/unreachable.csv"
	svc.urls.RegistrationAuthoritiesAPI = "http://127.0.0.1:1/unreachable-api"

	err := svc.SyncRegistrationAuthorities()
	if err != nil {
		t.Fatalf("expected nil error when cached RA data exists, got: %v", err)
	}
	if raRepo.deactivateCalled != 0 {
		t.Fatalf("expected no deactivate when download fails and cached data is reused")
	}
}

func TestSyncRegistrationAuthorities_FailsWhenDownloadFailsAndNoExistingData(t *testing.T) {
	raRepo := &stubRARepo{}
	svc := newTestGLEIFSvc(http.DefaultClient, raRepo, &stubELFRepo{}, &stubRoleRepo{}, &stubJurRepo{})
	svc.urls.RegistrationAuthorities = "http://127.0.0.1:1/unreachable.csv"
	svc.urls.RegistrationAuthoritiesAPI = "http://127.0.0.1:1/unreachable-api"

	err := svc.SyncRegistrationAuthorities()
	if err == nil {
		t.Fatal("expected error when download fails and no cached RA data exists")
	}
	if !strings.Contains(err.Error(), "download registration authorities") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestSyncRegistrationAuthorities_UsesAPIFallbackWhenCSVFails(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"links":{"next":""},"data":[{"id":"RA000100","attributes":{"code":"RA000100","internationalOrganizationName":"API Org","website":"https://example.org","jurisdictions":[{"countryCode":"GB","jurisdiction":"United Kingdom"}]}}]}`))
	}))
	defer srv.Close()

	raRepo := &stubRARepo{}
	svc := newTestGLEIFSvc(http.DefaultClient, raRepo, &stubELFRepo{}, &stubRoleRepo{}, &stubJurRepo{})
	svc.urls.RegistrationAuthorities = "http://127.0.0.1:1/unreachable.csv"
	svc.urls.RegistrationAuthoritiesAPI = srv.URL

	err := svc.SyncRegistrationAuthorities()
	if err != nil {
		t.Fatalf("expected nil error with API fallback, got: %v", err)
	}
	if raRepo.deactivateCalled != 1 {
		t.Fatalf("expected deactivate called once, got %d", raRepo.deactivateCalled)
	}
	if len(raRepo.upserted) != 1 || raRepo.upserted[0].RAID != "RA000100" {
		t.Fatalf("unexpected upserted records: %+v", raRepo.upserted)
	}
}

func TestFetchRegistrationAuthoritiesFromAPI_PaginatesAndMaps(t *testing.T) {
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/page1" {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"links":{"next":"` + srv.URL + `/page2"},"data":[{"id":"RA000001","attributes":{"code":"RA000001","internationalName":"Intl Name 1","internationalOrganizationName":"Org 1","website":"https://example.org/1","jurisdictions":[{"countryCode":"US","jurisdiction":"United States"}]}}]}`))
			return
		}
		if r.URL.Path == "/page2" {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"links":{"next":""},"data":[{"id":"RA000002","attributes":{"code":"RA000002","internationalName":"","localName":"Local Name 2","localOrganizationName":"Org 2","website":"https://example.org/2","jurisdictions":[{"countryCode":"DE","jurisdiction":"Germany"}]}}]}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	page1 := srv.URL + "/page1"

	svc := newTestGLEIFSvc(srv.Client(), &stubRARepo{}, &stubELFRepo{}, &stubRoleRepo{}, &stubJurRepo{})
	records, pages, err := svc.fetchRegistrationAuthoritiesFromAPI(page1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(pages) != 2 {
		t.Fatalf("expected 2 API pages, got %d", len(pages))
	}
	if len(records) != 2 {
		t.Fatalf("expected 2 records, got %d", len(records))
	}
	if records[0].RAID != "RA000001" || records[0].Jurisdiction != "US" {
		t.Fatalf("unexpected first record: %+v", records[0])
	}
	if records[1].OrganizationName != "Org 2" {
		t.Fatalf("expected fallback organization name Org 2, got %q", records[1].OrganizationName)
	}
}
