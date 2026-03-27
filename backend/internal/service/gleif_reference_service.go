package service

import (
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/repository"
)

// GLEIF CSV source URLs (defaults; override via env if GLEIF changes URLs)
const (
	defaultGLEIFRegistrationAuthoritiesURL = "https://www.gleif.org/content/2-about-lei/6-code-lists/2-gleif-registration-authorities-list/gleif-ra-list-v1.5.csv"
	defaultGLEIFEntityLegalFormsURL        = "https://www.gleif.org/content/2-about-lei/6-code-lists/1-iso-20275-entity-legal-forms/20275_EntitiesLegalForms.csv"
	defaultGLEIFOrganizationalRolesURL     = "https://www.gleif.org/content/2-about-lei/6-code-lists/4-iso-5009-official-organizational-roles/iso-5009-official-organizational-roles.csv"
	defaultGLEIFLegalJurisdictionsURL      = "https://www.gleif.org/content/2-about-lei/6-code-lists/3-gleif-accepted-legal-jurisdictions/gleif-jurisdictions-list.csv"

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
}

type gleifReferenceService struct {
	raRepo   repository.GLEIFRegistrationAuthorityRepository
	elfRepo  repository.GLEIFEntityLegalFormRepository
	roleRepo repository.GLEIFOrganizationalRoleRepository
	jurRepo  repository.GLEIFLegalJurisdictionRepository
	client   *http.Client
}

// GLEIFReferenceURLs holds configurable URLs for the four GLEIF reference CSV downloads.
type GLEIFReferenceURLs struct {
	RegistrationAuthorities string
	EntityLegalForms        string
	OrganizationalRoles     string
	LegalJurisdictions      string
}

// DefaultGLEIFReferenceURLs returns the production GLEIF CSV URL defaults.
func DefaultGLEIFReferenceURLs() GLEIFReferenceURLs {
	return GLEIFReferenceURLs{
		RegistrationAuthorities: defaultGLEIFRegistrationAuthoritiesURL,
		EntityLegalForms:        defaultGLEIFEntityLegalFormsURL,
		OrganizationalRoles:     defaultGLEIFOrganizationalRolesURL,
		LegalJurisdictions:      defaultGLEIFLegalJurisdictionsURL,
	}
}

// NewGLEIFReferenceService creates a new GLEIFReferenceService.
func NewGLEIFReferenceService(
	raRepo repository.GLEIFRegistrationAuthorityRepository,
	elfRepo repository.GLEIFEntityLegalFormRepository,
	roleRepo repository.GLEIFOrganizationalRoleRepository,
	jurRepo repository.GLEIFLegalJurisdictionRepository,
) GLEIFReferenceService {
	return &gleifReferenceService{
		raRepo:   raRepo,
		elfRepo:  elfRepo,
		roleRepo: roleRepo,
		jurRepo:  jurRepo,
		client:   &http.Client{Timeout: gleifHTTPTimeout},
	}
}

// SyncAll downloads and upserts all four GLEIF reference code lists in sequence.
func (s *gleifReferenceService) SyncAll() error {
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

// parseRegistrationAuthoritiesCSV reads tab-separated registration authority rows from r
// (header already consumed) and returns the parsed records.
// Exported for testing.
func parseRegistrationAuthoritiesCSV(r io.ReadCloser) ([]*domain.GLEIFRegistrationAuthority, error) {
	reader := csv.NewReader(r)
	reader.Comma = '\t'
	reader.LazyQuotes = true
	reader.FieldsPerRecord = -1

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
		records = append(records, &domain.GLEIFRegistrationAuthority{
			RAID:              raID,
			OrganizationName:  safeCol(row, 1),
			Jurisdiction:      safeCol(row, 2),
			InternationalName: safeCol(row, 3),
			LanguagesUsed:     safeCol(row, 4),
			Website:           safeCol(row, 5),
			Comments:          safeCol(row, 6),
			Active:            true,
			UpdatedBy:         "gleif_sync",
		})
	}
	return records, nil
}

// parseEntityLegalFormsCSV reads tab-separated entity legal form rows from r
// (header already consumed) and returns the parsed records.
func parseEntityLegalFormsCSV(r io.ReadCloser) ([]*domain.GLEIFEntityLegalForm, error) {
	reader := csv.NewReader(r)
	reader.Comma = '\t'
	reader.LazyQuotes = true
	reader.FieldsPerRecord = -1

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
		status := strings.TrimSpace(safeCol(row, 5))
		if status == "" {
			status = "ACTIVE"
		}
		records = append(records, &domain.GLEIFEntityLegalForm{
			ELFCode:                       elfCode,
			EntityLegalFormName:           safeCol(row, 3),
			Abbreviations:                 safeCol(row, 4),
			CountryOfFormation:            safeCol(row, 1),
			CountrySubdivisionOfFormation: safeCol(row, 2),
			Status:                        status,
			UpdatedBy:                     "gleif_sync",
		})
	}
	return records, nil
}

// parseOrganizationalRolesCSV reads tab-separated organizational role rows from r
// (header already consumed) and returns the parsed records.
func parseOrganizationalRolesCSV(r io.ReadCloser) ([]*domain.GLEIFOrganizationalRole, error) {
	reader := csv.NewReader(r)
	reader.Comma = '\t'
	reader.LazyQuotes = true
	reader.FieldsPerRecord = -1

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
		records = append(records, &domain.GLEIFOrganizationalRole{
			RoleCode:    roleCode,
			RoleName:    safeCol(row, 1),
			Description: safeCol(row, 2),
			Active:      true,
			UpdatedBy:   "gleif_sync",
		})
	}
	return records, nil
}

// parseLegalJurisdictionsCSV reads tab-separated legal jurisdiction rows from r
// (header already consumed) and returns the parsed records.
func parseLegalJurisdictionsCSV(r io.ReadCloser) ([]*domain.GLEIFLegalJurisdiction, error) {
	reader := csv.NewReader(r)
	reader.Comma = '\t'
	reader.LazyQuotes = true
	reader.FieldsPerRecord = -1

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
		code := strings.TrimSpace(row[0])
		if code == "" {
			continue
		}
		countryCode := safeCol(row, 2)
		if countryCode == "" && len(code) >= 2 {
			countryCode = strings.ToUpper(code[:2])
		}
		records = append(records, &domain.GLEIFLegalJurisdiction{
			JurisdictionCode: code,
			JurisdictionName: safeCol(row, 1),
			CountryCode:      countryCode,
			Active:           true,
			UpdatedBy:        "gleif_sync",
		})
	}
	return records, nil
}

// SyncRegistrationAuthorities downloads and upserts the GLEIF registration authorities list.
// CSV columns (tab-separated): RA ID | Organization Name | Jurisdiction | International Name | Languages | Website | Comments
func (s *gleifReferenceService) SyncRegistrationAuthorities() error {
	body, err := s.downloadCSV(defaultGLEIFRegistrationAuthoritiesURL)
	if err != nil {
		return fmt.Errorf("download registration authorities: %w", err)
	}
	defer func() {
		if closeErr := body.Close(); closeErr != nil {
			log.Warn().Err(closeErr).Msg("Failed to close registration authorities response body")
		}
	}()

	records, err := parseRegistrationAuthoritiesCSV(body)
	if err != nil {
		return fmt.Errorf("parse registration authorities: %w", err)
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
	return nil
}

// SyncEntityLegalForms downloads and upserts the ISO 20275 entity legal forms list.
// CSV columns (tab-separated): ELF Code | Country | Subdivision | Legal Form Name | Abbreviations | Status
func (s *gleifReferenceService) SyncEntityLegalForms() error {
	body, err := s.downloadCSV(defaultGLEIFEntityLegalFormsURL)
	if err != nil {
		return fmt.Errorf("download entity legal forms: %w", err)
	}
	defer func() {
		if closeErr := body.Close(); closeErr != nil {
			log.Warn().Err(closeErr).Msg("Failed to close entity legal forms response body")
		}
	}()

	records, err := parseEntityLegalFormsCSV(body)
	if err != nil {
		return fmt.Errorf("parse entity legal forms: %w", err)
	}

	if err := s.elfRepo.DeactivateAll(); err != nil {
		return fmt.Errorf("deactivate entity legal forms: %w", err)
	}

	for i := 0; i < len(records); i += gleifBatchSize {
		end := i + gleifBatchSize
		if end > len(records) {
			end = len(records)
		}
		if err := s.elfRepo.Upsert(records[i:end]); err != nil {
			return fmt.Errorf("upsert entity legal forms batch: %w", err)
		}
	}

	log.Info().Int("total", len(records)).Msg("Entity legal forms upserted")
	return nil
}

// SyncOrganizationalRoles downloads and upserts the ISO 5009 organizational roles list.
// CSV columns (tab-separated): Role Code | Role Name | Description
func (s *gleifReferenceService) SyncOrganizationalRoles() error {
	body, err := s.downloadCSV(defaultGLEIFOrganizationalRolesURL)
	if err != nil {
		return fmt.Errorf("download organizational roles: %w", err)
	}
	defer func() {
		if closeErr := body.Close(); closeErr != nil {
			log.Warn().Err(closeErr).Msg("Failed to close organizational roles response body")
		}
	}()

	records, err := parseOrganizationalRolesCSV(body)
	if err != nil {
		return fmt.Errorf("parse organizational roles: %w", err)
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
	return nil
}

// SyncLegalJurisdictions downloads and upserts the GLEIF legal jurisdictions list.
// CSV columns (tab-separated): Jurisdiction Code | Jurisdiction Name | Country Code
func (s *gleifReferenceService) SyncLegalJurisdictions() error {
	body, err := s.downloadCSV(defaultGLEIFLegalJurisdictionsURL)
	if err != nil {
		return fmt.Errorf("download legal jurisdictions: %w", err)
	}
	defer func() {
		if closeErr := body.Close(); closeErr != nil {
			log.Warn().Err(closeErr).Msg("Failed to close legal jurisdictions response body")
		}
	}()

	records, err := parseLegalJurisdictionsCSV(body)
	if err != nil {
		return fmt.Errorf("parse legal jurisdictions: %w", err)
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
	return nil
}

// downloadCSV fetches a URL and returns the response body as an io.ReadCloser.
// The caller is responsible for closing the returned body.
func (s *gleifReferenceService) downloadCSV(url string) (io.ReadCloser, error) {
	resp, err := s.client.Get(url) //nolint:noctx
	if err != nil {
		return nil, fmt.Errorf("HTTP GET %s: %w", url, err)
	}
	if resp.StatusCode != http.StatusOK {
		if closeErr := resp.Body.Close(); closeErr != nil {
			log.Warn().Err(closeErr).Str("url", url).Msg("Failed to close response body for non-OK status")
		}
		return nil, fmt.Errorf("HTTP %d from %s", resp.StatusCode, url)
	}
	return resp.Body, nil
}

// safeCol returns row[idx] trimmed, or "" if idx is out of range.
func safeCol(row []string, idx int) string {
	if idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[idx])
}
