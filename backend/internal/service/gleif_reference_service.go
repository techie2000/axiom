package service

import (
	"bytes"
	"crypto/sha256"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/repository"
)

// GLEIF CSV source URLs (defaults; override via env if GLEIF changes URLs)
const (
	defaultGLEIFRegistrationAuthoritiesURL = "https://www.gleif.org/lei-data/code-lists/gleif-registration-authorities-list/2024-11-20_ra-list-v1.8.1.csv"
	defaultGLEIFEntityLegalFormsURL        = "https://www.gleif.org/lei-data/code-lists/iso-20275-entity-legal-forms-code-list/2026-02-19-elf-code-list-v1.6.csv"
	defaultGLEIFOrganizationalRolesURL     = "https://www.gleif.org/lei-data/code-lists/iso-5009-official-organizational-roles-code-list/officialorganizationalroles_v1.0.0.csv"
	defaultGLEIFLegalJurisdictionsURL      = "https://www.gleif.org/lei-data/code-lists/gleif-accepted-legal-jurisdictions-code-list/gleif_acceptedjurisdictions_v1.5.csv"

	defaultGLEIFRegistrationAuthoritiesPageURL = "https://www.gleif.org/en/lei-data/code-lists/gleif-registration-authorities-list"
	defaultGLEIFRegistrationAuthoritiesAPIURL  = "https://api.gleif.org/api/v1/registration-authorities?page[size]=200"
	defaultGLEIFEntityLegalFormsPageURL        = "https://www.gleif.org/en/lei-data/code-lists/iso-20275-entity-legal-forms-code-list"
	defaultGLEIFOrganizationalRolesPageURL     = "https://www.gleif.org/en/lei-data/code-lists/iso-5009-official-organizational-roles-code-list"
	defaultGLEIFLegalJurisdictionsPageURL      = "https://www.gleif.org/en/lei-data/code-lists/gleif-accepted-legal-jurisdictions-code-list"

	// Batch size for DB upserts to avoid extremely large transactions
	gleifBatchSize = 500

	// HTTP timeout for GLEIF downloads
	gleifHTTPTimeout = 60 * time.Second
)

// GLEIFReferenceService handles downloading and upserting GLEIF reference code lists.
// It should run before LEI Level 1/2 ingest to ensure reference codes are resolvable.
type GLEIFReferenceService interface {
	// SyncAll downloads and upserts all four GLEIF reference code lists.
	SyncAll() error

	// SyncRegistrationAuthorities downloads and upserts the GLEIF registration authorities list.
	SyncRegistrationAuthorities() error

	// SyncEntityLegalForms downloads and upserts the ISO 20275 entity legal forms list.
	SyncEntityLegalForms() error

	// SyncOrganizationalRoles downloads and upserts the ISO 5009 organizational roles list.
	SyncOrganizationalRoles() error

	// SyncLegalJurisdictions downloads and upserts the GLEIF legal jurisdictions list.
	SyncLegalJurisdictions() error

	// LastSyncStats returns summary metrics captured during the last SyncAll run.
	LastSyncStats() GLEIFSyncStats
}

type GLEIFListSyncStats struct {
	Records    int    `json:"records"`
	FilesSaved int    `json:"files_saved"`
	BytesSaved int64  `json:"bytes_saved"`
	SourceType string `json:"source_type"`
	SourceURL  string `json:"source_url"`
}

type GLEIFSyncStats struct {
	RunAtUTC     string                        `json:"run_at_utc"`
	TotalRecords int                           `json:"total_records"`
	FilesSaved   int                           `json:"files_saved"`
	BytesSaved   int64                         `json:"bytes_saved"`
	Lists        map[string]GLEIFListSyncStats `json:"lists"`
}

// GLEIFReferenceURLs holds configurable URLs for the four GLEIF reference CSV downloads.
// Use DefaultGLEIFReferenceURLs() for production defaults or supply custom URLs (e.g. in tests
// or when GLEIF changes their hosting paths).
type GLEIFReferenceURLs struct {
	RegistrationAuthorities    string
	RegistrationAuthoritiesAPI string
	EntityLegalForms           string
	OrganizationalRoles        string
	LegalJurisdictions         string
}

// DefaultGLEIFReferenceURLs returns the production GLEIF CSV URL defaults.
func DefaultGLEIFReferenceURLs() GLEIFReferenceURLs {
	return GLEIFReferenceURLs{
		RegistrationAuthorities:    defaultGLEIFRegistrationAuthoritiesURL,
		RegistrationAuthoritiesAPI: defaultGLEIFRegistrationAuthoritiesAPIURL,
		EntityLegalForms:           defaultGLEIFEntityLegalFormsURL,
		OrganizationalRoles:        defaultGLEIFOrganizationalRolesURL,
		LegalJurisdictions:         defaultGLEIFLegalJurisdictionsURL,
	}
}

type gleifReferenceService struct {
	raRepo       repository.GLEIFRegistrationAuthorityRepository
	elfRepo      repository.GLEIFEntityLegalFormRepository
	elfAuditRepo repository.GLEIFEntityLegalFormAuditRepository
	roleRepo     repository.GLEIFOrganizationalRoleRepository
	jurRepo      repository.GLEIFLegalJurisdictionRepository
	client       *http.Client
	urls         GLEIFReferenceURLs
	dataDir      string
	statsMu      sync.RWMutex
	lastStats    GLEIFSyncStats
}

// NewGLEIFReferenceService creates a new GLEIFReferenceService using the production GLEIF URLs.
// Supply a custom GLEIFReferenceURLs via NewGLEIFReferenceServiceWithURLs when the defaults need
// overriding (e.g. during testing or when GLEIF changes their hosting paths).
func NewGLEIFReferenceService(
	raRepo repository.GLEIFRegistrationAuthorityRepository,
	elfRepo repository.GLEIFEntityLegalFormRepository,
	elfAuditRepo repository.GLEIFEntityLegalFormAuditRepository,
	roleRepo repository.GLEIFOrganizationalRoleRepository,
	jurRepo repository.GLEIFLegalJurisdictionRepository,
	leiDataDir string,
) GLEIFReferenceService {
	return NewGLEIFReferenceServiceWithURLs(raRepo, elfRepo, elfAuditRepo, roleRepo, jurRepo, leiDataDir, DefaultGLEIFReferenceURLs())
}

// NewGLEIFReferenceServiceWithURLs creates a new GLEIFReferenceService with explicit CSV source URLs.
func NewGLEIFReferenceServiceWithURLs(
	raRepo repository.GLEIFRegistrationAuthorityRepository,
	elfRepo repository.GLEIFEntityLegalFormRepository,
	elfAuditRepo repository.GLEIFEntityLegalFormAuditRepository,
	roleRepo repository.GLEIFOrganizationalRoleRepository,
	jurRepo repository.GLEIFLegalJurisdictionRepository,
	leiDataDir string,
	urls GLEIFReferenceURLs,
) GLEIFReferenceService {
	return &gleifReferenceService{
		raRepo:       raRepo,
		elfRepo:      elfRepo,
		elfAuditRepo: elfAuditRepo,
		roleRepo:     roleRepo,
		jurRepo:      jurRepo,
		client:       &http.Client{Timeout: gleifHTTPTimeout},
		urls:         urls,
		dataDir:      filepath.Join(leiDataDir, "gleif-reference"),
	}
}

// SyncAll downloads and upserts all four GLEIF reference code lists in sequence.
func (s *gleifReferenceService) SyncAll() error {
	s.statsMu.Lock()
	s.lastStats = GLEIFSyncStats{
		RunAtUTC: time.Now().UTC().Format(time.RFC3339),
		Lists:    make(map[string]GLEIFListSyncStats, 4),
	}
	s.statsMu.Unlock()

	steps := []struct {
		name string
		fn   func() error
	}{
		{"registration_authorities", s.SyncRegistrationAuthorities},
		{"entity_legal_forms", s.SyncEntityLegalForms},
		{"organizational_roles", s.SyncOrganizationalRoles},
		{"legal_jurisdictions", s.SyncLegalJurisdictions},
	}

	var errs []string
	for _, step := range steps {
		log.Info().Str("list", step.name).Msg("Syncing GLEIF reference code list")
		if err := step.fn(); err != nil {
			log.Error().Err(err).Str("list", step.name).Msg("Failed to sync GLEIF reference code list")
			errs = append(errs, fmt.Sprintf("%s: %v", step.name, err))
		} else {
			log.Info().Str("list", step.name).Msg("GLEIF reference code list synced")
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("GLEIF reference sync encountered errors: %s", strings.Join(errs, "; "))
	}
	return nil
}

func (s *gleifReferenceService) LastSyncStats() GLEIFSyncStats {
	s.statsMu.RLock()
	defer s.statsMu.RUnlock()

	copyStats := s.lastStats
	copyStats.Lists = make(map[string]GLEIFListSyncStats, len(s.lastStats.Lists))
	for k, v := range s.lastStats.Lists {
		copyStats.Lists[k] = v
	}
	return copyStats
}

func (s *gleifReferenceService) setListRecords(listName string, records int) {
	s.statsMu.Lock()
	defer s.statsMu.Unlock()
	if s.lastStats.Lists == nil {
		s.lastStats.Lists = make(map[string]GLEIFListSyncStats, 4)
	}
	entry := s.lastStats.Lists[listName]
	entry.Records = records
	s.lastStats.Lists[listName] = entry

	total := 0
	for _, list := range s.lastStats.Lists {
		total += list.Records
	}
	s.lastStats.TotalRecords = total
}

func (s *gleifReferenceService) addSavedPayload(listName, sourceType, sourceURL string, size int) {
	s.statsMu.Lock()
	defer s.statsMu.Unlock()
	if s.lastStats.Lists == nil {
		s.lastStats.Lists = make(map[string]GLEIFListSyncStats, 4)
	}
	entry := s.lastStats.Lists[listName]
	entry.FilesSaved++
	entry.BytesSaved += int64(size)
	entry.SourceType = sourceType
	entry.SourceURL = sourceURL
	s.lastStats.Lists[listName] = entry

	s.lastStats.FilesSaved++
	s.lastStats.BytesSaved += int64(size)
}

func newGLEIFCSVReader(r io.ReadCloser) (*csv.Reader, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("read csv payload: %w", err)
	}

	firstLine := string(data)
	if idx := strings.Index(firstLine, "\n"); idx >= 0 {
		firstLine = firstLine[:idx]
	}

	commaCount := strings.Count(firstLine, ",")
	tabCount := strings.Count(firstLine, "\t")
	delimiter := ','
	if tabCount > commaCount {
		delimiter = '\t'
	}

	reader := csv.NewReader(bytes.NewReader(data))
	reader.Comma = delimiter
	reader.LazyQuotes = true
	reader.FieldsPerRecord = -1
	return reader, nil
}

// parseRegistrationAuthoritiesCSV reads tab-separated registration authority rows from r
// (header already consumed) and returns the parsed records.
// Exported for testing.
func parseRegistrationAuthoritiesCSV(r io.ReadCloser) ([]*domain.GLEIFRegistrationAuthority, error) {
	reader, err := newGLEIFCSVReader(r)
	if err != nil {
		return nil, err
	}

	// Skip header row
	if _, err := reader.Read(); err != nil {
		return nil, fmt.Errorf("read header: %w", err)
	}

	var records []*domain.GLEIFRegistrationAuthority
	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			log.Warn().Err(err).Msg("Skipping malformed registration authority CSV row")
			continue
		}
		if len(row) < 2 {
			continue
		}
		raID := strings.TrimSpace(row[0])
		if raID == "" || strings.HasPrefix(raID, "#") {
			continue
		}

		orgName := safeCol(row, 1)
		jurisdiction := safeCol(row, 2)
		internationalName := safeCol(row, 3)
		languagesUsed := safeCol(row, 4)
		website := safeCol(row, 5)
		comments := safeCol(row, 6)

		if len(row) >= 10 {
			orgName = firstNonEmpty(safeCol(row, 6), safeCol(row, 1), safeCol(row, 4))
			jurisdiction = firstNonEmpty(safeCol(row, 3), safeCol(row, 2))
			internationalName = safeCol(row, 4)
			languagesUsed = ""
			website = firstNonEmpty(safeCol(row, 8), safeCol(row, 5))
			comments = firstNonEmpty(safeCol(row, 9), safeCol(row, 6))
		}

		records = append(records, &domain.GLEIFRegistrationAuthority{
			RAID:              truncateString(raID, 50),
			OrganizationName:  truncateString(orgName, 500),
			Jurisdiction:      truncateString(jurisdiction, 100),
			InternationalName: truncateString(internationalName, 500),
			LanguagesUsed:     truncateString(languagesUsed, 100),
			Website:           truncateString(website, 500),
			Comments:          comments,
			Active:            true,
			UpdatedBy:         "gleif_sync",
		})
	}
	return records, nil
}

// parseEntityLegalFormsCSV reads tab-separated entity legal form rows from r
// (header already consumed) and returns the parsed records.
func parseEntityLegalFormsCSV(r io.ReadCloser) ([]*domain.GLEIFEntityLegalForm, error) {
	reader, err := newGLEIFCSVReader(r)
	if err != nil {
		return nil, err
	}

	// Skip header row
	if _, err := reader.Read(); err != nil {
		return nil, fmt.Errorf("read header: %w", err)
	}

	var records []*domain.GLEIFEntityLegalForm
	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			log.Warn().Err(err).Msg("Skipping malformed entity legal form CSV row")
			continue
		}
		if len(row) < 2 {
			continue
		}
		elfCode := strings.TrimSpace(row[0])
		if elfCode == "" {
			continue
		}
		status := strings.TrimSpace(safeCol(row, 12))
		languageCode := strings.ToLower(strings.TrimSpace(safeCol(row, 7)))
		countryOfFormation := safeCol(row, 1)
		countrySubdivision := safeCol(row, 2)
		name := safeCol(row, 3)
		abbrev := safeCol(row, 4)

		if len(row) >= 13 {
			countryOfFormation = firstNonEmpty(safeCol(row, 2), safeCol(row, 1))
			countrySubdivision = firstNonEmpty(safeCol(row, 4), safeCol(row, 2))
			name = firstNonEmpty(safeCol(row, 8), safeCol(row, 5), safeCol(row, 3))
			abbrev = firstNonEmpty(safeCol(row, 10), safeCol(row, 9), safeCol(row, 4))
		}

		if len(row) < 13 {
			status = strings.TrimSpace(safeCol(row, 5))
		}
		if status == "ACTV" {
			status = "ACTIVE"
		}
		if status == "INAC" {
			status = "DECOMMISSIONED"
		}
		if status == "" {
			status = "ACTIVE"
		}
		records = append(records, &domain.GLEIFEntityLegalForm{
			ELFCode:                       truncateString(strings.ToUpper(elfCode), 10),
			EntityLegalFormName:           truncateString(name, 500),
			Abbreviations:                 truncateString(abbrev, 100),
			LanguageCode:                  truncateString(languageCode, 10),
			CountryOfFormation:            truncateString(strings.ToUpper(countryOfFormation), 2),
			CountrySubdivisionOfFormation: truncateString(strings.ToUpper(countrySubdivision), 10),
			Status:                        truncateString(strings.ToUpper(status), 20),
			UpdatedBy:                     "gleif_sync",
		})
	}
	return records, nil
}

// parseOrganizationalRolesCSV reads tab-separated organizational role rows from r
// (header already consumed) and returns the parsed records.
func parseOrganizationalRolesCSV(r io.ReadCloser) ([]*domain.GLEIFOrganizationalRole, error) {
	reader, err := newGLEIFCSVReader(r)
	if err != nil {
		return nil, err
	}

	// Skip header row
	if _, err := reader.Read(); err != nil {
		return nil, fmt.Errorf("read header: %w", err)
	}

	var records []*domain.GLEIFOrganizationalRole
	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			log.Warn().Err(err).Msg("Skipping malformed organizational role CSV row")
			continue
		}
		if len(row) < 2 {
			continue
		}
		roleCode := strings.TrimSpace(row[0])
		if roleCode == "" {
			continue
		}

		description := safeCol(row, 2)
		languageCode := ""
		elfCode := ""
		countryOfFormation := ""
		countrySubdivisionOfFormation := ""
		if len(row) >= 19 {
			languageCode = strings.ToLower(strings.TrimSpace(safeCol(row, 9)))
			elfCode = strings.ToUpper(strings.TrimSpace(safeCol(row, 6)))
			countryOfFormation = strings.ToUpper(strings.TrimSpace(safeCol(row, 2)))
			countrySubdivisionOfFormation = strings.ToUpper(strings.TrimSpace(safeCol(row, 4)))
			description = firstNonEmpty(safeCol(row, 18), safeCol(row, 17))
		}

		records = append(records, &domain.GLEIFOrganizationalRole{
			RoleCode:                      truncateString(strings.ToUpper(roleCode), 50),
			RoleName:                      truncateString(firstNonEmpty(safeCol(row, 10), safeCol(row, 7), safeCol(row, 1)), 500),
			Description:                   description,
			LanguageCode:                  truncateString(languageCode, 10),
			ELFCode:                       truncateString(elfCode, 10),
			CountryOfFormation:            truncateString(countryOfFormation, 2),
			CountrySubdivisionOfFormation: truncateString(countrySubdivisionOfFormation, 10),
			Active:                        true,
			UpdatedBy:                     "gleif_sync",
		})
	}
	return records, nil
}

// parseLegalJurisdictionsCSV reads tab-separated legal jurisdiction rows from r
// (header already consumed) and returns the parsed records.
func parseLegalJurisdictionsCSV(r io.ReadCloser) ([]*domain.GLEIFLegalJurisdiction, error) {
	reader, err := newGLEIFCSVReader(r)
	if err != nil {
		return nil, err
	}

	// Skip header row
	if _, err := reader.Read(); err != nil {
		return nil, fmt.Errorf("read header: %w", err)
	}

	var records []*domain.GLEIFLegalJurisdiction
	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			log.Warn().Err(err).Msg("Skipping malformed legal jurisdiction CSV row")
			continue
		}
		if len(row) < 2 {
			continue
		}
		code := safeCol(row, 0)
		name := safeCol(row, 1)
		countryCode := safeCol(row, 2)

		looksLikeCode := regexp.MustCompile(`^[A-Z]{2}([\-_][A-Z0-9]{1,8})?$`).MatchString
		if !looksLikeCode(strings.ToUpper(code)) || strings.HasPrefix(strings.ToUpper(countryCode), "COUNTRY_") {
			code = safeCol(row, 1)
			name = safeCol(row, 0)
			countryCode = ""
		}

		if code == "" {
			continue
		}
		if countryCode == "" && len(code) >= 2 {
			countryCode = strings.ToUpper(code[:2])
		}
		records = append(records, &domain.GLEIFLegalJurisdiction{
			JurisdictionCode: truncateString(strings.ToUpper(code), 20),
			JurisdictionName: truncateString(name, 500),
			CountryCode:      truncateString(strings.ToUpper(countryCode), 2),
			Active:           true,
			UpdatedBy:        "gleif_sync",
		})
	}
	return records, nil
}

// SyncRegistrationAuthorities downloads and upserts the GLEIF registration authorities list.
// CSV columns (tab-separated): RA ID | Organization Name | Jurisdiction | International Name | Languages | Website | Comments
func (s *gleifReferenceService) SyncRegistrationAuthorities() error {
	payload, err := s.downloadCSVWithDiscovery(
		s.urls.RegistrationAuthorities,
		defaultGLEIFRegistrationAuthoritiesPageURL,
		[]string{"registration", "authorities"},
	)
	if err != nil {
		apiURL := strings.TrimSpace(s.urls.RegistrationAuthoritiesAPI)
		if apiURL == "" {
			apiURL = defaultGLEIFRegistrationAuthoritiesAPIURL
		}
		records, apiPages, apiErr := s.fetchRegistrationAuthoritiesFromAPI(apiURL)
		if apiErr == nil && len(records) > 0 {
			for i, page := range apiPages {
				if persistErr := s.persistPulledPayload("registration_authorities", fmt.Sprintf("api-page-%d", i+1), page.URL, page.Data); persistErr != nil {
					log.Warn().Err(persistErr).Msg("Failed to persist registration authorities API snapshot")
				} else {
					s.addSavedPayload("registration_authorities", "api", page.URL, len(page.Data))
				}
			}
			log.Warn().Err(err).Int("total", len(records)).Msg("Registration authorities CSV unavailable; using GLEIF API fallback")

			if deactivateErr := s.raRepo.DeactivateAll(); deactivateErr != nil {
				return fmt.Errorf("deactivate registration authorities: %w", deactivateErr)
			}

			for i := 0; i < len(records); i += gleifBatchSize {
				end := i + gleifBatchSize
				if end > len(records) {
					end = len(records)
				}
				if upsertErr := s.raRepo.Upsert(records[i:end]); upsertErr != nil {
					return fmt.Errorf("upsert registration authorities batch: %w", upsertErr)
				}
			}

			log.Info().Int("total", len(records)).Msg("Registration authorities upserted from API fallback")
			s.setListRecords("registration_authorities", len(records))
			return nil
		}

		existingCount, countErr := s.raRepo.Count()
		if countErr == nil && existingCount > 0 {
			log.Warn().Err(err).Err(apiErr).Int64("existing_records", existingCount).Msg("Using existing registration authorities; latest download unavailable")
			return nil
		}
		if countErr != nil {
			return fmt.Errorf("download registration authorities: %w (api fallback failed: %v; and failed to check existing records: %v)", err, apiErr, countErr)
		}
		return fmt.Errorf("download registration authorities: %w (api fallback failed: %v)", err, apiErr)
	}
	if persistErr := s.persistPulledPayload("registration_authorities", "csv", payload.ResolvedURL, payload.Data); persistErr != nil {
		log.Warn().Err(persistErr).Msg("Failed to persist registration authorities CSV snapshot")
	} else {
		s.addSavedPayload("registration_authorities", "csv", payload.ResolvedURL, len(payload.Data))
	}

	records, err := parseRegistrationAuthoritiesCSV(io.NopCloser(bytes.NewReader(payload.Data)))
	if err != nil {
		return fmt.Errorf("parse registration authorities: %w", err)
	}
	records, dropped, dupCodes := dedupeRegistrationAuthorities(records)
	if dropped > 0 {
		log.Warn().Int("dropped_duplicates", dropped).Strs("duplicate_codes", dupCodes).Msg("Dropped duplicate registration authority codes before upsert")
	}

	// Mark all existing records inactive before upserting the fresh set.
	if err := s.raRepo.DeactivateAll(); err != nil {
		return fmt.Errorf("deactivate registration authorities: %w", err)
	}

	for i := 0; i < len(records); i += gleifBatchSize {
		end := i + gleifBatchSize
		if end > len(records) {
			end = len(records)
		}
		if err := s.raRepo.Upsert(records[i:end]); err != nil {
			return fmt.Errorf("upsert registration authorities batch: %w", err)
		}
	}

	log.Info().Int("total", len(records)).Msg("Registration authorities upserted")
	s.setListRecords("registration_authorities", len(records))
	return nil
}

// SyncEntityLegalForms downloads and upserts the ISO 20275 entity legal forms list.
// CSV columns (tab-separated): ELF Code | Country | Subdivision | Legal Form Name | Abbreviations | Status
func (s *gleifReferenceService) SyncEntityLegalForms() error {
	payload, err := s.downloadCSVWithDiscovery(
		s.urls.EntityLegalForms,
		defaultGLEIFEntityLegalFormsPageURL,
		[]string{"elf", "legal", "forms"},
	)
	if err != nil {
		cachedData, cachedPath, cacheErr := s.readLatestCachedCSV("entity_legal_forms")
		if cacheErr != nil {
			return fmt.Errorf("download entity legal forms: %w", err)
		}
		log.Warn().Err(err).Str("cached_file", cachedPath).Msg("Using cached entity legal forms CSV snapshot")
		payload = &downloadedPayload{ResolvedURL: cachedPath, Data: cachedData}
	}
	if persistErr := s.persistPulledPayload("entity_legal_forms", "csv", payload.ResolvedURL, payload.Data); persistErr != nil {
		log.Warn().Err(persistErr).Msg("Failed to persist entity legal forms CSV snapshot")
	} else {
		s.addSavedPayload("entity_legal_forms", "csv", payload.ResolvedURL, len(payload.Data))
	}

	records, err := parseEntityLegalFormsCSV(io.NopCloser(bytes.NewReader(payload.Data)))
	if err != nil {
		return fmt.Errorf("parse entity legal forms: %w", err)
	}
	records, dropped, dupCodes := dedupeEntityLegalForms(records)
	if dropped > 0 {
		log.Info().Int("collapsed_rows", dropped).Int("affected_codes", len(dupCodes)).Strs("sample_codes", sampleKeys(dupCodes, 25)).Msg("Collapsed exact duplicate entity legal form rows before upsert")
	}

	existingRecords, err := s.elfRepo.FindAllForSync()
	if err != nil {
		return fmt.Errorf("load existing entity legal forms: %w", err)
	}
	existingByKey := make(map[string]*domain.GLEIFEntityLegalForm, len(existingRecords))
	for _, existing := range existingRecords {
		if existing == nil {
			continue
		}
		key := elfVariantKey(existing)
		if key == "" {
			continue
		}
		if current, found := existingByKey[key]; !found || shouldPreferELFRecord(existing, current) {
			existingByKey[key] = existing
		}
	}

	incomingByKey := make(map[string]*domain.GLEIFEntityLegalForm, len(records))
	for _, rec := range records {
		if rec == nil {
			continue
		}
		key := elfVariantKey(rec)
		if key == "" {
			continue
		}
		if current, found := incomingByKey[key]; !found || shouldPreferELFRecord(rec, current) {
			incomingByKey[key] = rec
		}
	}

	auditRecords := make([]*domain.GLEIFEntityLegalFormAudit, 0, len(records))
	for key, incoming := range incomingByKey {
		existing, found := existingByKey[key]
		if !found {
			auditRecords = append(auditRecords, buildELFAuditRecord(nil, incoming, "CREATE"))
			continue
		}
		if changedFields := buildELFChangedFields(existing, incoming); changedFields != "{}" {
			auditRecords = append(auditRecords, buildELFAuditRecord(existing, incoming, "UPDATE"))
		}
	}

	for key, existing := range existingByKey {
		if _, found := incomingByKey[key]; found {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(existing.Status), "DECOMMISSIONED") {
			continue
		}
		decommissioned := *existing
		decommissioned.Status = "DECOMMISSIONED"
		auditRecords = append(auditRecords, buildELFAuditRecord(existing, &decommissioned, "UPDATE"))
	}

	// Build a deduplicated upsert slice from incomingByKey so that two CSV rows
	// sharing the same 3-col key cannot land in the same batch and trigger
	// "ON CONFLICT DO UPDATE command cannot affect row a second time".
	upsertRecords := make([]*domain.GLEIFEntityLegalForm, 0, len(incomingByKey))
	for _, rec := range incomingByKey {
		upsertRecords = append(upsertRecords, rec)
	}

	if err := s.elfRepo.DeactivateAll(); err != nil {
		return fmt.Errorf("deactivate entity legal forms: %w", err)
	}

	for i := 0; i < len(upsertRecords); i += gleifBatchSize {
		end := i + gleifBatchSize
		if end > len(upsertRecords) {
			end = len(upsertRecords)
		}
		if err := s.elfRepo.Upsert(upsertRecords[i:end]); err != nil {
			return fmt.Errorf("upsert entity legal forms batch: %w", err)
		}
	}

	if s.elfAuditRepo != nil {
		if err := s.elfAuditRepo.UpsertAuditRecords(auditRecords); err != nil {
			return fmt.Errorf("write entity legal form audit records: %w", err)
		}
	}

	log.Info().Int("total", len(records)).Msg("Entity legal forms upserted")
	s.setListRecords("entity_legal_forms", len(records))
	return nil
}

// SyncOrganizationalRoles downloads and upserts the ISO 5009 organizational roles list.
// CSV columns (tab-separated): Role Code | Role Name | Description
func (s *gleifReferenceService) SyncOrganizationalRoles() error {
	payload, err := s.downloadCSVWithDiscovery(
		s.urls.OrganizationalRoles,
		defaultGLEIFOrganizationalRolesPageURL,
		[]string{"officialorganizationalroles", "organizational", "roles"},
	)
	if err != nil {
		cachedData, cachedPath, cacheErr := s.readLatestCachedCSV("organizational_roles")
		if cacheErr != nil {
			return fmt.Errorf("download organizational roles: %w", err)
		}
		log.Warn().Err(err).Str("cached_file", cachedPath).Msg("Using cached organizational roles CSV snapshot")
		payload = &downloadedPayload{ResolvedURL: cachedPath, Data: cachedData}
	}
	if persistErr := s.persistPulledPayload("organizational_roles", "csv", payload.ResolvedURL, payload.Data); persistErr != nil {
		log.Warn().Err(persistErr).Msg("Failed to persist organizational roles CSV snapshot")
	} else {
		s.addSavedPayload("organizational_roles", "csv", payload.ResolvedURL, len(payload.Data))
	}

	records, err := parseOrganizationalRolesCSV(io.NopCloser(bytes.NewReader(payload.Data)))
	if err != nil {
		return fmt.Errorf("parse organizational roles: %w", err)
	}
	records, dropped, dupCodes := dedupeOrganizationalRoles(records)
	if dropped > 0 {
		log.Info().Int("collapsed_rows", dropped).Int("affected_codes", len(dupCodes)).Strs("sample_codes", sampleKeys(dupCodes, 25)).Msg("Collapsed exact duplicate organizational role rows before upsert")
	}

	if err := s.roleRepo.DeactivateAll(); err != nil {
		return fmt.Errorf("deactivate organizational roles: %w", err)
	}

	for i := 0; i < len(records); i += gleifBatchSize {
		end := i + gleifBatchSize
		if end > len(records) {
			end = len(records)
		}
		if err := s.roleRepo.Upsert(records[i:end]); err != nil {
			return fmt.Errorf("upsert organizational roles batch: %w", err)
		}
	}

	log.Info().Int("total", len(records)).Msg("Organizational roles upserted")
	s.setListRecords("organizational_roles", len(records))
	return nil
}

// SyncLegalJurisdictions downloads and upserts the GLEIF legal jurisdictions list.
// CSV columns (tab-separated): Jurisdiction Code | Jurisdiction Name | Country Code
func (s *gleifReferenceService) SyncLegalJurisdictions() error {
	payload, err := s.downloadCSVWithDiscovery(
		s.urls.LegalJurisdictions,
		defaultGLEIFLegalJurisdictionsPageURL,
		[]string{"acceptedjurisdictions", "jurisdictions", "legal"},
	)
	if err != nil {
		cachedData, cachedPath, cacheErr := s.readLatestCachedCSV("legal_jurisdictions")
		if cacheErr != nil {
			return fmt.Errorf("download legal jurisdictions: %w", err)
		}
		log.Warn().Err(err).Str("cached_file", cachedPath).Msg("Using cached legal jurisdictions CSV snapshot")
		payload = &downloadedPayload{ResolvedURL: cachedPath, Data: cachedData}
	}
	if persistErr := s.persistPulledPayload("legal_jurisdictions", "csv", payload.ResolvedURL, payload.Data); persistErr != nil {
		log.Warn().Err(persistErr).Msg("Failed to persist legal jurisdictions CSV snapshot")
	} else {
		s.addSavedPayload("legal_jurisdictions", "csv", payload.ResolvedURL, len(payload.Data))
	}

	records, err := parseLegalJurisdictionsCSV(io.NopCloser(bytes.NewReader(payload.Data)))
	if err != nil {
		return fmt.Errorf("parse legal jurisdictions: %w", err)
	}
	records, dropped, dupCodes := dedupeLegalJurisdictions(records)
	if dropped > 0 {
		log.Warn().Int("dropped_duplicates", dropped).Strs("duplicate_codes", dupCodes).Msg("Dropped duplicate legal jurisdiction codes before upsert")
	}

	if err := s.jurRepo.DeactivateAll(); err != nil {
		return fmt.Errorf("deactivate legal jurisdictions: %w", err)
	}

	for i := 0; i < len(records); i += gleifBatchSize {
		end := i + gleifBatchSize
		if end > len(records) {
			end = len(records)
		}
		if err := s.jurRepo.Upsert(records[i:end]); err != nil {
			return fmt.Errorf("upsert legal jurisdictions batch: %w", err)
		}
	}

	log.Info().Int("total", len(records)).Msg("Legal jurisdictions upserted")
	s.setListRecords("legal_jurisdictions", len(records))
	return nil
}

// downloadCSV fetches a URL and returns the response body as an io.ReadCloser.
// The caller is responsible for closing the returned body.
func (s *gleifReferenceService) downloadCSV(url string) ([]byte, error) {
	resp, err := s.get(url)
	if err != nil {
		return nil, fmt.Errorf("HTTP GET %s: %w", url, err)
	}
	defer func() {
		if closeErr := resp.Body.Close(); closeErr != nil {
			log.Warn().Err(closeErr).Str("url", url).Msg("Failed to close response body")
		}
	}()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d from %s", resp.StatusCode, url)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body from %s: %w", url, err)
	}
	return body, nil
}

func (s *gleifReferenceService) get(rawURL string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}

	// GLEIF endpoints may return redirect loops for default bot-like clients.
	// Use a browser-like user-agent and broad Accept header for stable downloads.
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; AxiomGLEIFSync/1.0; +https://www.gleif.org)")
	req.Header.Set("Accept", "text/csv,application/octet-stream;q=0.9,*/*;q=0.8")

	return s.client.Do(req) //nolint:noctx
}

// downloadCSVWithDiscovery tries the configured CSV URL first. If it returns HTTP 404,
// it discovers the latest CSV link from the provided code-list landing page.
type downloadedPayload struct {
	Data        []byte
	ResolvedURL string
}

func (s *gleifReferenceService) downloadCSVWithDiscovery(csvURL string, pageURL string, keywords []string) (*downloadedPayload, error) {
	body, err := s.downloadCSV(csvURL)
	if err == nil {
		return &downloadedPayload{Data: body, ResolvedURL: csvURL}, nil
	}
	if !shouldAttemptDiscoveryFallback(err) {
		return nil, err
	}

	resolvedURL, resolveErr := s.resolveCSVURLFromLandingPage(pageURL, keywords)
	if resolveErr != nil {
		return nil, fmt.Errorf("%w; fallback discovery failed: %v", err, resolveErr)
	}
	log.Warn().Err(err).Str("stale_url", csvURL).Str("resolved_url", resolvedURL).Msg("GLEIF CSV URL fetch failed; using discovered CSV URL")
	body, retryErr := s.downloadCSV(resolvedURL)
	if retryErr != nil {
		return nil, retryErr
	}
	return &downloadedPayload{Data: body, ResolvedURL: resolvedURL}, nil
}

func shouldAttemptDiscoveryFallback(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "http 404") ||
		strings.Contains(msg, "stopped after 10 redirects") ||
		strings.Contains(msg, "too many redirects") ||
		strings.Contains(msg, "too many redirections")
}

func (s *gleifReferenceService) resolveCSVURLFromLandingPage(pageURL string, keywords []string) (string, error) {
	resp, err := s.get(pageURL)
	if err != nil {
		return "", fmt.Errorf("HTTP GET %s: %w", pageURL, err)
	}
	defer func() {
		if closeErr := resp.Body.Close(); closeErr != nil {
			log.Warn().Err(closeErr).Str("url", pageURL).Msg("Failed to close landing page response body")
		}
	}()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP %d from %s", resp.StatusCode, pageURL)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read landing page body: %w", err)
	}

	candidates := extractCSVLinkCandidates(string(bodyBytes))
	if len(candidates) == 0 {
		return "", fmt.Errorf("no CSV links found in landing page %s", pageURL)
	}

	best := chooseBestCSVLink(candidates, keywords)
	if best == "" {
		return "", fmt.Errorf("no suitable CSV link found in landing page %s", pageURL)
	}
	return best, nil
}

func extractCSVLinkCandidates(body string) []string {
	pattern := regexp.MustCompile(`https://www\.gleif\.org/[^"'\s>]+\.csv|/[^"'\s>]+\.csv`)
	matches := pattern.FindAllString(body, -1)
	if len(matches) == 0 {
		return nil
	}

	seen := make(map[string]struct{}, len(matches))
	out := make([]string, 0, len(matches))
	for _, m := range matches {
		candidate := strings.TrimSpace(m)
		if strings.HasPrefix(candidate, "/") {
			candidate = "https://www.gleif.org" + candidate
		}
		u, err := url.Parse(candidate)
		if err != nil || u.Scheme == "" || u.Host == "" {
			continue
		}
		normalized := u.String()
		if _, exists := seen[normalized]; exists {
			continue
		}
		seen[normalized] = struct{}{}
		out = append(out, normalized)
	}
	return out
}

func chooseBestCSVLink(candidates []string, keywords []string) string {
	if len(candidates) == 0 {
		return ""
	}

	containsKeyword := func(link string) bool {
		lower := strings.ToLower(link)
		for _, kw := range keywords {
			if strings.Contains(lower, strings.ToLower(kw)) {
				return true
			}
		}
		return false
	}

	isChangelog := func(link string) bool {
		lower := strings.ToLower(link)
		return strings.Contains(lower, "changelog") || strings.Contains(lower, "changes")
	}

	for _, c := range candidates {
		if containsKeyword(c) && !isChangelog(c) {
			return c
		}
	}
	for _, c := range candidates {
		if !isChangelog(c) {
			return c
		}
	}
	return candidates[0]
}

type registrationAuthoritiesAPIResponse struct {
	Links struct {
		Next string `json:"next"`
	} `json:"links"`
	Data []struct {
		ID         string `json:"id"`
		Attributes struct {
			Code                          string `json:"code"`
			InternationalName             string `json:"internationalName"`
			LocalName                     string `json:"localName"`
			InternationalOrganizationName string `json:"internationalOrganizationName"`
			LocalOrganizationName         string `json:"localOrganizationName"`
			Website                       string `json:"website"`
			Jurisdictions                 []struct {
				CountryCode  string `json:"countryCode"`
				Jurisdiction string `json:"jurisdiction"`
			} `json:"jurisdictions"`
		} `json:"attributes"`
	} `json:"data"`
}

type apiPageSnapshot struct {
	URL  string
	Data []byte
}

func (s *gleifReferenceService) fetchRegistrationAuthoritiesFromAPI(startURL string) ([]*domain.GLEIFRegistrationAuthority, []apiPageSnapshot, error) {
	nextURL := startURL
	results := make([]*domain.GLEIFRegistrationAuthority, 0, 1200)
	pages := make([]apiPageSnapshot, 0, 8)

	for pageNum := 0; nextURL != "" && pageNum < 50; pageNum++ {
		resp, err := s.get(nextURL)
		if err != nil {
			return nil, nil, fmt.Errorf("HTTP GET %s: %w", nextURL, err)
		}
		if resp.StatusCode != http.StatusOK {
			if closeErr := resp.Body.Close(); closeErr != nil {
				log.Warn().Err(closeErr).Str("url", nextURL).Msg("Failed to close API response body for non-OK status")
			}
			return nil, nil, fmt.Errorf("HTTP %d from %s", resp.StatusCode, nextURL)
		}

		bodyBytes, readErr := io.ReadAll(resp.Body)
		if closeErr := resp.Body.Close(); closeErr != nil {
			log.Warn().Err(closeErr).Str("url", nextURL).Msg("Failed to close API response body")
		}
		if readErr != nil {
			return nil, nil, fmt.Errorf("read API response %s: %w", nextURL, readErr)
		}
		pages = append(pages, apiPageSnapshot{URL: nextURL, Data: bodyBytes})

		var payload registrationAuthoritiesAPIResponse
		decodeErr := json.Unmarshal(bodyBytes, &payload)
		if decodeErr != nil {
			return nil, nil, fmt.Errorf("decode API response %s: %w", nextURL, decodeErr)
		}

		for _, item := range payload.Data {
			raID := strings.TrimSpace(item.Attributes.Code)
			if raID == "" {
				raID = strings.TrimSpace(item.ID)
			}
			if raID == "" {
				continue
			}

			orgName := firstNonEmpty(
				item.Attributes.InternationalOrganizationName,
				item.Attributes.LocalOrganizationName,
				item.Attributes.InternationalName,
				item.Attributes.LocalName,
			)
			jurisdiction := ""
			if len(item.Attributes.Jurisdictions) > 0 {
				jurisdiction = firstNonEmpty(
					item.Attributes.Jurisdictions[0].CountryCode,
					item.Attributes.Jurisdictions[0].Jurisdiction,
				)
			}

			results = append(results, &domain.GLEIFRegistrationAuthority{
				RAID:              raID,
				OrganizationName:  orgName,
				Jurisdiction:      jurisdiction,
				InternationalName: item.Attributes.InternationalName,
				LanguagesUsed:     "",
				Website:           item.Attributes.Website,
				Comments:          "",
				Active:            true,
				UpdatedBy:         "gleif_sync",
			})
		}

		nextURL = strings.TrimSpace(payload.Links.Next)
	}

	if len(results) == 0 {
		return nil, nil, fmt.Errorf("no registration authorities returned from API")
	}

	return results, pages, nil
}

func (s *gleifReferenceService) readLatestCachedCSV(listName string) ([]byte, string, error) {
	pattern := filepath.Join(s.dataDir, listName, "*_csv.csv")
	matches, err := filepath.Glob(pattern)
	if err != nil {
		return nil, "", fmt.Errorf("glob cached csv snapshots: %w", err)
	}
	if len(matches) == 0 {
		return nil, "", fmt.Errorf("no cached CSV snapshots found for %s", listName)
	}

	sort.Slice(matches, func(i, j int) bool {
		iInfo, iErr := os.Stat(matches[i])
		jInfo, jErr := os.Stat(matches[j])
		if iErr != nil || jErr != nil {
			return matches[i] > matches[j]
		}
		return iInfo.ModTime().After(jInfo.ModTime())
	})

	data, readErr := os.ReadFile(matches[0])
	if readErr != nil {
		return nil, "", fmt.Errorf("read cached CSV snapshot %s: %w", matches[0], readErr)
	}
	return data, matches[0], nil
}

func dedupeRegistrationAuthorities(records []*domain.GLEIFRegistrationAuthority) ([]*domain.GLEIFRegistrationAuthority, int, []string) {
	if len(records) == 0 {
		return records, 0, nil
	}
	seen := make(map[string]int, len(records))
	duplicateKeys := make(map[string]struct{})
	result := make([]*domain.GLEIFRegistrationAuthority, 0, len(records))
	dropped := 0
	for _, record := range records {
		if record == nil {
			continue
		}
		key := strings.TrimSpace(record.RAID)
		if key == "" {
			continue
		}
		if idx, ok := seen[key]; ok {
			result[idx] = record
			duplicateKeys[key] = struct{}{}
			dropped++
			continue
		}
		seen[key] = len(result)
		result = append(result, record)
	}
	return result, dropped, sortedKeys(duplicateKeys)
}

func dedupeEntityLegalForms(records []*domain.GLEIFEntityLegalForm) ([]*domain.GLEIFEntityLegalForm, int, []string) {
	if len(records) == 0 {
		return records, 0, nil
	}
	seen := make(map[string]int, len(records))
	duplicateKeys := make(map[string]struct{})
	result := make([]*domain.GLEIFEntityLegalForm, 0, len(records))
	dropped := 0
	for _, record := range records {
		if record == nil {
			continue
		}
		key := strings.Join([]string{
			strings.TrimSpace(record.ELFCode),
			strings.ToLower(strings.TrimSpace(record.LanguageCode)),
			strings.ToUpper(strings.TrimSpace(record.CountryOfFormation)),
			strings.ToUpper(strings.TrimSpace(record.CountrySubdivisionOfFormation)),
			strings.TrimSpace(record.EntityLegalFormName),
			strings.TrimSpace(record.Abbreviations),
			strings.ToUpper(strings.TrimSpace(record.Status)),
		}, "|")
		if key == "" {
			continue
		}
		if _, ok := seen[key]; ok {
			duplicateKeys[strings.TrimSpace(record.ELFCode)] = struct{}{}
			dropped++
			continue
		}
		seen[key] = len(result)
		result = append(result, record)
	}
	return result, dropped, sortedKeys(duplicateKeys)
}

func dedupeOrganizationalRoles(records []*domain.GLEIFOrganizationalRole) ([]*domain.GLEIFOrganizationalRole, int, []string) {
	if len(records) == 0 {
		return records, 0, nil
	}
	seen := make(map[string]int, len(records))
	duplicateKeys := make(map[string]struct{})
	result := make([]*domain.GLEIFOrganizationalRole, 0, len(records))
	dropped := 0
	for _, record := range records {
		if record == nil {
			continue
		}
		key := strings.Join([]string{
			strings.TrimSpace(record.RoleCode),
			strings.ToLower(strings.TrimSpace(record.LanguageCode)),
			strings.ToUpper(strings.TrimSpace(record.CountryOfFormation)),
			strings.ToUpper(strings.TrimSpace(record.CountrySubdivisionOfFormation)),
			strings.ToUpper(strings.TrimSpace(record.ELFCode)),
			strings.TrimSpace(record.RoleName),
			strings.TrimSpace(record.Description),
		}, "|")
		if key == "" {
			continue
		}
		if _, ok := seen[key]; ok {
			duplicateKeys[strings.TrimSpace(record.RoleCode)] = struct{}{}
			dropped++
			continue
		}
		seen[key] = len(result)
		result = append(result, record)
	}
	return result, dropped, sortedKeys(duplicateKeys)
}

func dedupeLegalJurisdictions(records []*domain.GLEIFLegalJurisdiction) ([]*domain.GLEIFLegalJurisdiction, int, []string) {
	if len(records) == 0 {
		return records, 0, nil
	}
	seen := make(map[string]int, len(records))
	duplicateKeys := make(map[string]struct{})
	result := make([]*domain.GLEIFLegalJurisdiction, 0, len(records))
	dropped := 0
	for _, record := range records {
		if record == nil {
			continue
		}
		key := strings.TrimSpace(record.JurisdictionCode)
		if key == "" {
			continue
		}
		if idx, ok := seen[key]; ok {
			result[idx] = record
			duplicateKeys[key] = struct{}{}
			dropped++
			continue
		}
		seen[key] = len(result)
		result = append(result, record)
	}
	return result, dropped, sortedKeys(duplicateKeys)
}

func elfVariantKey(record *domain.GLEIFEntityLegalForm) string {
	if record == nil {
		return ""
	}
	// Prefer subdivision; fall back to country to avoid empty middle segment collapsing
	// unrelated variants onto the same key when subdivision is absent in the source CSV.
	subdivision := strings.ToUpper(strings.TrimSpace(record.CountrySubdivisionOfFormation))
	if subdivision == "" {
		subdivision = strings.ToUpper(strings.TrimSpace(record.CountryOfFormation))
	}
	return strings.Join([]string{
		strings.TrimSpace(record.ELFCode),
		strings.ToLower(strings.TrimSpace(record.LanguageCode)),
		subdivision,
	}, "|")
}

func shouldPreferELFRecord(candidate, current *domain.GLEIFEntityLegalForm) bool {
	if current == nil {
		return true
	}
	candidateActive := strings.EqualFold(strings.TrimSpace(candidate.Status), "ACTIVE")
	currentActive := strings.EqualFold(strings.TrimSpace(current.Status), "ACTIVE")
	if candidateActive != currentActive {
		return candidateActive
	}
	if !candidate.UpdatedAt.Equal(current.UpdatedAt) {
		return candidate.UpdatedAt.After(current.UpdatedAt)
	}
	return candidate.CreatedAt.After(current.CreatedAt)
}

func buildELFChangedFields(oldRecord, newRecord *domain.GLEIFEntityLegalForm) domain.JSONBString {
	changes := make(map[string]map[string]string)
	if oldRecord == nil {
		return "{}"
	}

	add := func(field, oldValue, newValue string) {
		if strings.TrimSpace(oldValue) == strings.TrimSpace(newValue) {
			return
		}
		changes[field] = map[string]string{"old": oldValue, "new": newValue}
	}

	add("entity_legal_form_name", oldRecord.EntityLegalFormName, newRecord.EntityLegalFormName)
	add("abbreviations", oldRecord.Abbreviations, newRecord.Abbreviations)
	add("language_code", oldRecord.LanguageCode, newRecord.LanguageCode)
	add("country_of_formation", oldRecord.CountryOfFormation, newRecord.CountryOfFormation)
	add("country_subdivision_of_formation", oldRecord.CountrySubdivisionOfFormation, newRecord.CountrySubdivisionOfFormation)
	add("status", oldRecord.Status, newRecord.Status)

	if len(changes) == 0 {
		return "{}"
	}
	body, err := json.Marshal(changes)
	if err != nil {
		return "{}"
	}
	return domain.JSONBString(string(body))
}

func buildELFAuditRecord(oldRecord, newRecord *domain.GLEIFEntityLegalForm, action string) *domain.GLEIFEntityLegalFormAudit {
	audit := &domain.GLEIFEntityLegalFormAudit{
		ELFCode:        strings.TrimSpace(newRecord.ELFCode),
		Action:         action,
		RecordSnapshot: marshalELFRecordSnapshot(newRecord),
		ChangedFields:  buildELFChangedFields(oldRecord, newRecord),
		ChangedBy:      "gleif_sync",
	}
	if oldRecord != nil {
		audit.ELFVariantID = &oldRecord.ID
	}
	if oldRecord == nil {
		audit.ChangedFields = "{}"
	}
	return audit
}

func marshalELFRecordSnapshot(record *domain.GLEIFEntityLegalForm) domain.JSONBString {
	body, err := json.Marshal(map[string]string{
		"elf_code":                         strings.TrimSpace(record.ELFCode),
		"entity_legal_form_name":           strings.TrimSpace(record.EntityLegalFormName),
		"abbreviations":                    strings.TrimSpace(record.Abbreviations),
		"language_code":                    strings.TrimSpace(record.LanguageCode),
		"country_of_formation":             strings.TrimSpace(record.CountryOfFormation),
		"country_subdivision_of_formation": strings.TrimSpace(record.CountrySubdivisionOfFormation),
		"status":                           strings.ToUpper(strings.TrimSpace(record.Status)),
	})
	if err != nil {
		return "{}"
	}
	return domain.JSONBString(string(body))
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		v = strings.TrimSpace(v)
		if v != "" {
			return v
		}
	}
	return ""
}

func sampleKeys(keys []string, max int) []string {
	if max <= 0 || len(keys) <= max {
		return keys
	}
	return keys[:max]
}

// sortedKeys returns a sorted slice of the keys from a string set.
func sortedKeys(m map[string]struct{}) []string {
	if len(m) == 0 {
		return nil
	}
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func truncateString(value string, maxLen int) string {
	value = strings.TrimSpace(value)
	if maxLen <= 0 || len(value) <= maxLen {
		return value
	}
	return value[:maxLen]
}

func (s *gleifReferenceService) persistPulledPayload(listName, sourceType, sourceURL string, data []byte) error {
	if strings.TrimSpace(s.dataDir) == "" || len(data) == 0 {
		return nil
	}

	listDir := filepath.Join(s.dataDir, listName)
	if err := os.MkdirAll(listDir, 0755); err != nil {
		return fmt.Errorf("create snapshot dir: %w", err)
	}

	ts := time.Now().UTC().Format("20060102-150405")
	hash := fmt.Sprintf("%x", sha256.Sum256(data))
	baseName := fmt.Sprintf("%s_%s", ts, sourceType)
	ext := ".bin"
	if strings.Contains(strings.ToLower(sourceType), "csv") {
		ext = ".csv"
	}
	if strings.Contains(strings.ToLower(sourceType), "api") || strings.Contains(strings.ToLower(sourceType), "json") {
		ext = ".json"
	}
	dataPath := filepath.Join(listDir, baseName+ext)
	metaPath := filepath.Join(listDir, baseName+".meta.json")

	if err := os.WriteFile(dataPath, data, 0644); err != nil {
		return fmt.Errorf("write snapshot payload: %w", err)
	}

	meta := map[string]any{
		"list":        listName,
		"source_type": sourceType,
		"source_url":  sourceURL,
		"size_bytes":  len(data),
		"sha256":      hash,
		"saved_at":    time.Now().UTC().Format(time.RFC3339),
		"payload":     filepath.Base(dataPath),
	}
	metaBytes, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal snapshot metadata: %w", err)
	}
	if err := os.WriteFile(metaPath, metaBytes, 0644); err != nil {
		return fmt.Errorf("write snapshot metadata: %w", err)
	}

	log.Info().Str("list", listName).Str("payload", dataPath).Str("metadata", metaPath).Msg("Persisted GLEIF source snapshot")
	return nil
}

// safeCol returns row[idx] trimmed, or "" if idx is out of range.
func safeCol(row []string, idx int) string {
	if idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[idx])
}
