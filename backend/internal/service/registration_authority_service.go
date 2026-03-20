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

// GLEIFRAListURL is the default URL for the GLEIF Registration Authorities List CSV download.
// Override via GLEIF_RA_LIST_URL environment variable.
const GLEIFRAListURL = "https://www.gleif.org/en/lei-data/code-lists/gleif-registration-authorities-list/download"

// RegistrationAuthorityService downloads and synchronises GLEIF registration authority
// reference data into the local database.
type RegistrationAuthorityService interface {
	// SyncFromGLEIF downloads the GLEIF Registration Authorities List CSV and upserts all
	// records into the database with a full audit trail.
	// Returns (created, updated, error).
	SyncFromGLEIF() (int, int, error)

	// GetByRACode looks up a single registration authority by its GLEIF code.
	GetByRACode(raCode string) (*domain.RegistrationAuthority, error)
}

type registrationAuthorityService struct {
	repo   repository.RegistrationAuthorityRepository
	raURL  string
	client *http.Client
}

// NewRegistrationAuthorityService creates a new RegistrationAuthorityService.
// raListURL may be empty to use the built-in default.
func NewRegistrationAuthorityService(
	repo repository.RegistrationAuthorityRepository,
	raListURL string,
) RegistrationAuthorityService {
	url := raListURL
	if url == "" {
		url = GLEIFRAListURL
	}
	return &registrationAuthorityService{
		repo:  repo,
		raURL: url,
		client: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// GetByRACode delegates to the repository.
func (s *registrationAuthorityService) GetByRACode(raCode string) (*domain.RegistrationAuthority, error) {
	return s.repo.FindByRACode(raCode)
}

// SyncFromGLEIF downloads the CSV, parses it, and upserts every row.
func (s *registrationAuthorityService) SyncFromGLEIF() (int, int, error) {
	log.Info().Str("url", s.raURL).Msg("Downloading GLEIF Registration Authorities List")

	body, err := s.downloadCSV()
	if err != nil {
		return 0, 0, fmt.Errorf("failed to download GLEIF RA list: %w", err)
	}

	records, err := s.parseCSV(body)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to parse GLEIF RA list CSV: %w", err)
	}

	log.Info().Int("record_count", len(records)).Msg("Parsed GLEIF RA list")

	var created, updated int
	var firstErr error
	for _, ra := range records {
		isUpdated, upsertErr := s.repo.UpsertRegistrationAuthority(ra)
		if upsertErr != nil {
			log.Error().
				Err(upsertErr).
				Str("ra_code", ra.RACode).
				Msg("Failed to upsert registration authority")
			if firstErr == nil {
				firstErr = upsertErr
			}
			continue
		}
		if isUpdated {
			updated++
		} else {
			created++
		}
	}

	log.Info().
		Int("created", created).
		Int("updated", updated).
		Msg("GLEIF Registration Authorities sync complete")

	return created, updated, firstErr
}

// downloadCSV fetches the CSV content from the GLEIF URL.
func (s *registrationAuthorityService) downloadCSV() (string, error) {
	req, err := http.NewRequest(http.MethodGet, s.raURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "text/csv,application/csv,text/plain,*/*")
	req.Header.Set("User-Agent", "axiom-lei-ingest/1.0")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected HTTP status %d from GLEIF RA list", resp.StatusCode)
	}

	buf := new(strings.Builder)
	if _, err := io.Copy(buf, resp.Body); err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}
	return buf.String(), nil
}

// parseCSV converts the raw CSV text into a slice of RegistrationAuthority domain objects.
//
// The GLEIF Registration Authorities List CSV has the following header structure
// (column order may vary; we detect by header name to be robust):
//
//   - Registration Authority Code
//   - Country Code
//   - Registration Authority Name
//   - International name of the Registration Authority
//   - Website
//   - Notes
func (s *registrationAuthorityService) parseCSV(csvText string) ([]*domain.RegistrationAuthority, error) {
	reader := csv.NewReader(strings.NewReader(csvText))
	reader.LazyQuotes = true
	reader.TrimLeadingSpace = true

	// Read header row
	headers, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("failed to read CSV headers: %w", err)
	}

	// Map header names to column indices (case-insensitive, trimmed)
	colIndex := buildColumnIndex(headers)

	raCodeIdx := resolveColumn(colIndex,
		"registration authority code",
		"ra code",
		"racode",
		"code",
	)
	countryCodeIdx := resolveColumn(colIndex,
		"country code",
		"countrycode",
		"country",
	)
	nameIdx := resolveColumn(colIndex,
		"registration authority name",
		"ra name",
		"raname",
		"name",
	)
	intlNameIdx := resolveColumn(colIndex,
		"international name of the registration authority",
		"international name",
		"international registration authority name",
		"intlname",
	)
	websiteIdx := resolveColumn(colIndex,
		"website",
		"url",
	)
	notesIdx := resolveColumn(colIndex,
		"notes",
		"gleif notes",
	)

	if raCodeIdx < 0 {
		return nil, fmt.Errorf("CSV is missing a recognized RA code column; got headers: %v", headers)
	}
	if nameIdx < 0 {
		return nil, fmt.Errorf("CSV is missing a recognized RA name column; got headers: %v", headers)
	}

	var results []*domain.RegistrationAuthority
	lineNum := 1 // header was line 0

	for {
		lineNum++
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			log.Warn().Err(err).Int("line", lineNum).Msg("Skipping malformed CSV row")
			continue
		}

		raCode := strings.TrimSpace(safeGet(row, raCodeIdx))
		if raCode == "" {
			log.Warn().Int("line", lineNum).Msg("Skipping row with empty RA code")
			continue
		}

		raName := strings.TrimSpace(safeGet(row, nameIdx))
		if raName == "" {
			log.Warn().Str("ra_code", raCode).Int("line", lineNum).Msg("Skipping row with empty RA name")
			continue
		}

		ra := &domain.RegistrationAuthority{
			RACode:            raCode,
			CountryCode:       strings.TrimSpace(safeGet(row, countryCodeIdx)),
			RAName:            raName,
			InternationalName: strings.TrimSpace(safeGet(row, intlNameIdx)),
			Website:           strings.TrimSpace(safeGet(row, websiteIdx)),
			GLEIFNotes:        strings.TrimSpace(safeGet(row, notesIdx)),
			IsDeprecated:      false,
		}

		results = append(results, ra)
	}

	if len(results) == 0 {
		return nil, fmt.Errorf("CSV contained no usable rows (checked %d lines)", lineNum)
	}

	return results, nil
}

// buildColumnIndex builds a map from lower-cased, trimmed header name to zero-based column index.
func buildColumnIndex(headers []string) map[string]int {
	idx := make(map[string]int, len(headers))
	for i, h := range headers {
		idx[strings.ToLower(strings.TrimSpace(h))] = i
	}
	return idx
}

// resolveColumn returns the first index in colIndex that matches any of the candidate names,
// or -1 if none match.
func resolveColumn(colIndex map[string]int, candidates ...string) int {
	for _, c := range candidates {
		if i, ok := colIndex[strings.ToLower(c)]; ok {
			return i
		}
	}
	return -1
}

// safeGet returns row[i] when i is within bounds, or an empty string otherwise.
func safeGet(row []string, i int) string {
	if i < 0 || i >= len(row) {
		return ""
	}
	return row[i]
}
