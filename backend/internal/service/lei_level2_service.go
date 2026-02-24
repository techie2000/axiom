package service

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/repository"
)

// GLEIFLevel2PublishesURL is the same discovery endpoint used for Level 1 data.
// The response includes rr and repex keys alongside lei2.
const GLEIFLevel2PublishesURL = "https://goldencopy.gleif.org/api/v2/golden-copies/publishes/latest"

// LEILevel2Service downloads and processes GLEIF Level 2 data:
//   - Relationship Records (RR)  – who owns whom
//   - Reporting Exceptions (REPEX) – entities that cannot disclose their parent
type LEILevel2Service interface {
	// DownloadRRFile downloads the full Relationship Records golden-copy file from GLEIF.
	DownloadRRFile() (*domain.SourceFile, error)
	// DownloadREPEXFile downloads the full Reporting Exceptions golden-copy file from GLEIF.
	DownloadREPEXFile() (*domain.SourceFile, error)

	// ProcessRRFile parses and upserts all relationship records from the given source file.
	ProcessRRFile(sourceFileID uuid.UUID) error
	// ProcessREPEXFile parses and upserts all reporting exceptions from the given source file.
	ProcessREPEXFile(sourceFileID uuid.UUID) error

	// CountRelationshipRecords returns the total number of relationship records stored.
	CountRelationshipRecords() (int64, error)
	// CountReportingExceptions returns the total number of reporting exceptions stored.
	CountReportingExceptions() (int64, error)
}

// gleifLevel2PublishesResponse is the minimal slice of the GLEIF API we need.
// The full response also contains lei2 (Level 1); we only parse the rr and repex sections here.
type gleifLevel2PublishesResponse struct {
	Data struct {
		RR    gleifLevel2FileFormats `json:"rr"`
		REPEX gleifLevel2FileFormats `json:"repex"`
	} `json:"data"`
}

type gleifLevel2FileFormats struct {
	PublishDate string `json:"publish_date"`
	FullFile    struct {
		JSON struct {
			URL         string `json:"url"`
			Size        int64  `json:"size"`
			RecordCount int    `json:"record_count"`
		} `json:"json"`
	} `json:"full_file"`
}

// leiLevel2Service implements LEILevel2Service.
type leiLevel2Service struct {
	repo    repository.LEILevel2Repository
	leiRepo repository.LEIRepository // used to store SourceFile records
	dataDir string
}

// NewLEILevel2Service creates a new LEILevel2Service.
func NewLEILevel2Service(
	repo repository.LEILevel2Repository,
	leiRepo repository.LEIRepository,
	dataDir string,
) LEILevel2Service {
	return &leiLevel2Service{
		repo:    repo,
		leiRepo: leiRepo,
		dataDir: dataDir,
	}
}

// getLevel2FileURLs fetches the GLEIF golden-copy metadata for Level 2 datasets.
func (s *leiLevel2Service) getLevel2FileURLs() (*gleifLevel2PublishesResponse, error) {
	log.Info().Str("url", GLEIFLevel2PublishesURL).Msg("Fetching Level 2 file URLs from GLEIF")

	resp, err := http.Get(GLEIFLevel2PublishesURL) //nolint:noctx
	if err != nil {
		return nil, fmt.Errorf("failed to fetch level 2 publishes: %w", err)
	}
	defer func() {
		if cerr := resp.Body.Close(); cerr != nil {
			log.Error().Err(cerr).Msg("Failed to close response body")
		}
	}()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch level 2 publishes: HTTP %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read level 2 publishes response: %w", err)
	}

	var result gleifLevel2PublishesResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to decode level 2 publishes response: %w", err)
	}

	log.Info().
		Str("rr_url", result.Data.RR.FullFile.JSON.URL).
		Int64("rr_size", result.Data.RR.FullFile.JSON.Size).
		Int("rr_records", result.Data.RR.FullFile.JSON.RecordCount).
		Str("repex_url", result.Data.REPEX.FullFile.JSON.URL).
		Int64("repex_size", result.Data.REPEX.FullFile.JSON.Size).
		Int("repex_records", result.Data.REPEX.FullFile.JSON.RecordCount).
		Msg("Retrieved Level 2 file information")

	return &result, nil
}

// DownloadRRFile fetches the Relationship Records golden-copy ZIP from GLEIF.
func (s *leiLevel2Service) DownloadRRFile() (*domain.SourceFile, error) {
	publishes, err := s.getLevel2FileURLs()
	if err != nil {
		return nil, fmt.Errorf("failed to get level 2 file URLs: %w", err)
	}

	url := publishes.Data.RR.FullFile.JSON.URL
	if url == "" {
		return nil, fmt.Errorf("GLEIF API returned empty URL for RR full file")
	}
	publishedAt := publishes.Data.RR.PublishDate
	recordCount := publishes.Data.RR.FullFile.JSON.RecordCount
	return s.downloadLevel2File(url, "RR_FULL", publishedAt, recordCount)
}

// DownloadREPEXFile fetches the Reporting Exceptions golden-copy ZIP from GLEIF.
func (s *leiLevel2Service) DownloadREPEXFile() (*domain.SourceFile, error) {
	publishes, err := s.getLevel2FileURLs()
	if err != nil {
		return nil, fmt.Errorf("failed to get level 2 file URLs: %w", err)
	}

	url := publishes.Data.REPEX.FullFile.JSON.URL
	if url == "" {
		return nil, fmt.Errorf("GLEIF API returned empty URL for REPEX full file")
	}
	publishedAt := publishes.Data.REPEX.PublishDate
	recordCount := publishes.Data.REPEX.FullFile.JSON.RecordCount
	return s.downloadLevel2File(url, "REPEX_FULL", publishedAt, recordCount)
}

// downloadLevel2File is the shared download helper for Level 2 files.
// It mirrors the logic in the Level 1 lei_service.downloadFile method.
func (s *leiLevel2Service) downloadLevel2File(
	url, fileType, publishedAt string, expectedRecordCount int,
) (*domain.SourceFile, error) {
	log.Info().
		Str("url", url).
		Str("file_type", fileType).
		Msg("Starting Level 2 file download from GLEIF")

	if err := os.MkdirAll(s.dataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	resp, err := http.Get(url) //nolint:noctx
	if err != nil {
		return nil, fmt.Errorf("failed to download level 2 file: %w", err)
	}
	defer func() {
		if cerr := resp.Body.Close(); cerr != nil {
			log.Error().Err(cerr).Msg("Failed to close download response body")
		}
	}()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to download level 2 file: HTTP %d", resp.StatusCode)
	}

	fileName := fmt.Sprintf("gleif-level2-%s-%s.zip", strings.ToLower(fileType), time.Now().Format("20060102-150405"))
	filePath := filepath.Join(s.dataDir, fileName)

	outFile, err := os.Create(filePath) //nolint:gosec
	if err != nil {
		return nil, fmt.Errorf("failed to create output file: %w", err)
	}
	defer func() {
		if cerr := outFile.Close(); cerr != nil {
			log.Error().Err(cerr).Str("file", filePath).Msg("Failed to close output file")
		}
	}()

	hasher := sha256.New()
	writer := io.MultiWriter(outFile, hasher)
	size, err := io.Copy(writer, resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to write level 2 file: %w", err)
	}

	fileHash := hex.EncodeToString(hasher.Sum(nil))

	// Check for duplicate (already processed)
	existing, err := s.leiRepo.FindSourceFileByHash(fileHash)
	if err == nil && existing != nil && existing.ProcessingStatus == "COMPLETED" {
		log.Info().
			Str("file_type", fileType).
			Str("hash", fileHash).
			Msg("Level 2 file already processed (duplicate hash), skipping")
		if removeErr := os.Remove(filePath); removeErr != nil {
			log.Warn().Err(removeErr).Str("file", filePath).Msg("Failed to remove duplicate download")
		}
		return nil, fmt.Errorf("duplicate file already processed: %s", fileHash)
	}

	// Parse publication date
	var pubDate time.Time
	if publishedAt != "" {
		for _, layout := range []string{"2006-01-02 15:04:05", "2006-01-02T15:04:05Z", "2006-01-02"} {
			if t, err := time.Parse(layout, publishedAt); err == nil {
				pubDate = t
				break
			}
		}
	}

	now := time.Now()
	sourceFile := &domain.SourceFile{
		FileName:         fileName,
		FileType:         fileType,
		FileURL:          url,
		FileSize:         size,
		FileHash:         fileHash,
		DownloadedAt:     now,
		PublicationDate:  pubDate,
		ProcessingStatus: "PENDING",
		TotalRecords:     expectedRecordCount,
		MaxRetries:       3,
	}

	if err := s.leiRepo.CreateSourceFile(sourceFile); err != nil {
		return nil, fmt.Errorf("failed to create source file record: %w", err)
	}

	log.Info().
		Str("file_name", fileName).
		Str("file_type", fileType).
		Int64("size_bytes", size).
		Str("hash", fileHash).
		Int("expected_records", expectedRecordCount).
		Msg("Level 2 file downloaded successfully")

	return sourceFile, nil
}

// --- Relationship Records (RR) processing ---

// rawRRRecord is the JSON Lines structure for a single GLEIF RR record.
type rawRRRecord struct {
	LEI          string `json:"LEI"`
	Relationship struct {
		StartNode struct {
			NodeID     string `json:"NodeID"`
			NodeIDType string `json:"NodeIDType"`
		} `json:"StartNode"`
		EndNode struct {
			NodeID     string `json:"NodeID"`
			NodeIDType string `json:"NodeIDType"`
		} `json:"EndNode"`
		RelationshipType     string            `json:"RelationshipType"`
		RelationshipStatus   string            `json:"RelationshipStatus"`
		RelationshipPeriods  []json.RawMessage `json:"RelationshipPeriods"`
		RelationshipQualifiers  []json.RawMessage `json:"RelationshipQualifiers"`
		RelationshipQuantifiers []json.RawMessage `json:"RelationshipQuantifiers"`
	} `json:"Relationship"`
	Registration struct {
		InitialRegistrationDate string `json:"InitialRegistrationDate"`
		LastUpdateDate          string `json:"LastUpdateDate"`
		NextRenewalDate         string `json:"NextRenewalDate"`
		RegistrationStatus      string `json:"RegistrationStatus"`
		ManagingLOU             string `json:"ManagingLOU"`
		ValidationSources       string `json:"ValidationSources"`
		ValidationDocuments     string `json:"ValidationDocuments"`
		ValidationReference     string `json:"ValidationReference"`
	} `json:"Registration"`
}

// ProcessRRFile reads a downloaded RR ZIP file and upserts all relationship records.
func (s *leiLevel2Service) ProcessRRFile(sourceFileID uuid.UUID) error {
	sourceFile, err := s.leiRepo.FindSourceFileByID(sourceFileID.String())
	if err != nil {
		return fmt.Errorf("source file not found: %w", err)
	}

	log.Info().
		Str("source_file_id", sourceFileID.String()).
		Str("file_name", sourceFile.FileName).
		Msg("Starting RR file processing")

	// Mark as IN_PROGRESS
	now := time.Now()
	sourceFile.ProcessingStatus = "IN_PROGRESS"
	sourceFile.ProcessingStartedAt = &now
	if err := s.leiRepo.UpdateSourceFile(sourceFile); err != nil {
		log.Warn().Err(err).Msg("Failed to update source file status to IN_PROGRESS")
	}

	filePath := filepath.Join(s.dataDir, sourceFile.FileName)
	processed, failed, err := s.processRRZip(filePath, sourceFileID)

	if err != nil {
		now = time.Now()
		sourceFile.ProcessingStatus = "FAILED"
		sourceFile.ProcessingCompletedAt = &now
		sourceFile.ProcessingError = err.Error()
		sourceFile.ProcessedRecords = processed
		sourceFile.FailedRecords = failed
		_ = s.leiRepo.UpdateSourceFile(sourceFile)
		return fmt.Errorf("RR file processing failed: %w", err)
	}

	now = time.Now()
	sourceFile.ProcessingStatus = "COMPLETED"
	sourceFile.ProcessingCompletedAt = &now
	sourceFile.ProcessedRecords = processed
	sourceFile.FailedRecords = failed
	if err := s.leiRepo.UpdateSourceFile(sourceFile); err != nil {
		log.Warn().Err(err).Msg("Failed to update source file to COMPLETED")
	}

	log.Info().
		Str("source_file_id", sourceFileID.String()).
		Int("processed", processed).
		Int("failed", failed).
		Msg("RR file processing completed")

	return nil
}

func (s *leiLevel2Service) processRRZip(filePath string, sourceFileID uuid.UUID) (processed, failed int, err error) {
	r, err := zip.OpenReader(filePath)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to open RR ZIP: %w", err)
	}
	defer func() {
		if cerr := r.Close(); cerr != nil {
			log.Error().Err(cerr).Msg("Failed to close RR ZIP reader")
		}
	}()

	for _, f := range r.File {
		if !strings.HasSuffix(strings.ToLower(f.Name), ".json") {
			continue
		}

		log.Info().Str("entry", f.Name).Msg("Processing RR JSON entry from ZIP")

		rc, openErr := f.Open()
		if openErr != nil {
			return processed, failed, fmt.Errorf("failed to open ZIP entry %s: %w", f.Name, openErr)
		}

		p, fa, processErr := s.parseAndUpsertRR(rc, sourceFileID)
		processed += p
		failed += fa

		if closeErr := rc.Close(); closeErr != nil {
			log.Warn().Err(closeErr).Str("entry", f.Name).Msg("Failed to close ZIP entry")
		}

		if processErr != nil {
			return processed, failed, processErr
		}
	}

	return processed, failed, nil
}

func (s *leiLevel2Service) parseAndUpsertRR(r io.Reader, sourceFileID uuid.UUID) (processed, failed int, err error) {
	decoder := json.NewDecoder(r)
	for {
		var raw rawRRRecord
		if decErr := decoder.Decode(&raw); decErr != nil {
			if decErr == io.EOF {
				break
			}
			if isTerminalJSONDecodeError(decErr) {
				break
			}
			log.Warn().Err(decErr).Msg("Failed to decode RR JSON record, skipping")
			failed++
			continue
		}

		record, mapErr := mapRawRRToRelationshipRecord(&raw, sourceFileID)
		if mapErr != nil {
			log.Warn().Err(mapErr).Msg("Failed to map RR record, skipping")
			failed++
			continue
		}

		if upsertErr := s.repo.UpsertRelationshipRecord(record); upsertErr != nil {
			log.Warn().
				Err(upsertErr).
				Str("start_lei", record.StartNodeLEI).
				Str("end_lei", record.EndNodeLEI).
				Msg("Failed to upsert relationship record, skipping")
			failed++
			continue
		}

		processed++
		if processed%10000 == 0 {
			log.Info().Int("processed", processed).Int("failed", failed).Msg("RR processing progress")
		}
	}

	return processed, failed, nil
}

func mapRawRRToRelationshipRecord(raw *rawRRRecord, sourceFileID uuid.UUID) (*domain.LEIRelationshipRecord, error) {
	if raw.Relationship.StartNode.NodeID == "" || raw.Relationship.EndNode.NodeID == "" {
		return nil, fmt.Errorf("missing start or end node LEI")
	}

	record := &domain.LEIRelationshipRecord{
		StartNodeLEI:        raw.Relationship.StartNode.NodeID,
		EndNodeLEI:          raw.Relationship.EndNode.NodeID,
		RelationshipType:    raw.Relationship.RelationshipType,
		RelationshipStatus:  raw.Relationship.RelationshipStatus,
		RegistrationStatus:  raw.Registration.RegistrationStatus,
		ManagingLOU:         raw.Registration.ManagingLOU,
		ValidationSources:   raw.Registration.ValidationSources,
		ValidationDocuments: raw.Registration.ValidationDocuments,
		ValidationReference: raw.Registration.ValidationReference,
		SourceFileID:        &sourceFileID,
	}

	if len(raw.Relationship.RelationshipPeriods) > 0 {
		b, err := json.Marshal(raw.Relationship.RelationshipPeriods)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal RelationshipPeriods: %w", err)
		}
		record.RelationshipPeriods = domain.JSONBString(b)
	}
	if len(raw.Relationship.RelationshipQualifiers) > 0 {
		b, err := json.Marshal(raw.Relationship.RelationshipQualifiers)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal RelationshipQualifiers: %w", err)
		}
		record.RelationshipQualifiers = domain.JSONBString(b)
	}
	if len(raw.Relationship.RelationshipQuantifiers) > 0 {
		b, err := json.Marshal(raw.Relationship.RelationshipQuantifiers)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal RelationshipQuantifiers: %w", err)
		}
		record.RelationshipQuantifiers = domain.JSONBString(b)
	}

	record.InitialRegistrationDate = parseGLEIFTime(raw.Registration.InitialRegistrationDate)
	record.LastUpdateDate = parseGLEIFTime(raw.Registration.LastUpdateDate)
	record.NextRenewalDate = parseGLEIFTime(raw.Registration.NextRenewalDate)

	return record, nil
}

// --- Reporting Exceptions (REPEX) processing ---

// rawREPEXRecord is the JSON Lines structure for a single GLEIF REPEX record.
type rawREPEXRecord struct {
	LEI               string `json:"LEI"`
	ExceptionCategory string `json:"ExceptionCategory"`
	ExceptionReason   string `json:"ExceptionReason"`
	ExceptionReference string `json:"ExceptionReference"`
}

// ProcessREPEXFile reads a downloaded REPEX ZIP file and upserts all reporting exceptions.
func (s *leiLevel2Service) ProcessREPEXFile(sourceFileID uuid.UUID) error {
	sourceFile, err := s.leiRepo.FindSourceFileByID(sourceFileID.String())
	if err != nil {
		return fmt.Errorf("source file not found: %w", err)
	}

	log.Info().
		Str("source_file_id", sourceFileID.String()).
		Str("file_name", sourceFile.FileName).
		Msg("Starting REPEX file processing")

	// Mark as IN_PROGRESS
	now := time.Now()
	sourceFile.ProcessingStatus = "IN_PROGRESS"
	sourceFile.ProcessingStartedAt = &now
	if err := s.leiRepo.UpdateSourceFile(sourceFile); err != nil {
		log.Warn().Err(err).Msg("Failed to update source file status to IN_PROGRESS")
	}

	filePath := filepath.Join(s.dataDir, sourceFile.FileName)
	processed, failed, err := s.processREPEXZip(filePath, sourceFileID)

	if err != nil {
		now = time.Now()
		sourceFile.ProcessingStatus = "FAILED"
		sourceFile.ProcessingCompletedAt = &now
		sourceFile.ProcessingError = err.Error()
		sourceFile.ProcessedRecords = processed
		sourceFile.FailedRecords = failed
		_ = s.leiRepo.UpdateSourceFile(sourceFile)
		return fmt.Errorf("REPEX file processing failed: %w", err)
	}

	now = time.Now()
	sourceFile.ProcessingStatus = "COMPLETED"
	sourceFile.ProcessingCompletedAt = &now
	sourceFile.ProcessedRecords = processed
	sourceFile.FailedRecords = failed
	if err := s.leiRepo.UpdateSourceFile(sourceFile); err != nil {
		log.Warn().Err(err).Msg("Failed to update source file to COMPLETED")
	}

	log.Info().
		Str("source_file_id", sourceFileID.String()).
		Int("processed", processed).
		Int("failed", failed).
		Msg("REPEX file processing completed")

	return nil
}

func (s *leiLevel2Service) processREPEXZip(filePath string, sourceFileID uuid.UUID) (processed, failed int, err error) {
	r, err := zip.OpenReader(filePath)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to open REPEX ZIP: %w", err)
	}
	defer func() {
		if cerr := r.Close(); cerr != nil {
			log.Error().Err(cerr).Msg("Failed to close REPEX ZIP reader")
		}
	}()

	for _, f := range r.File {
		if !strings.HasSuffix(strings.ToLower(f.Name), ".json") {
			continue
		}

		log.Info().Str("entry", f.Name).Msg("Processing REPEX JSON entry from ZIP")

		rc, openErr := f.Open()
		if openErr != nil {
			return processed, failed, fmt.Errorf("failed to open ZIP entry %s: %w", f.Name, openErr)
		}

		p, fa, processErr := s.parseAndUpsertREPEX(rc, sourceFileID)
		processed += p
		failed += fa

		if closeErr := rc.Close(); closeErr != nil {
			log.Warn().Err(closeErr).Str("entry", f.Name).Msg("Failed to close ZIP entry")
		}

		if processErr != nil {
			return processed, failed, processErr
		}
	}

	return processed, failed, nil
}

func (s *leiLevel2Service) parseAndUpsertREPEX(r io.Reader, sourceFileID uuid.UUID) (processed, failed int, err error) {
	decoder := json.NewDecoder(r)
	for {
		var raw rawREPEXRecord
		if decErr := decoder.Decode(&raw); decErr != nil {
			if decErr == io.EOF {
				break
			}
			if isTerminalJSONDecodeError(decErr) {
				break
			}
			log.Warn().Err(decErr).Msg("Failed to decode REPEX JSON record, skipping")
			failed++
			continue
		}

		exc := &domain.LEIReportingException{
			LEI:                raw.LEI,
			ExceptionCategory:  raw.ExceptionCategory,
			ExceptionReason:    raw.ExceptionReason,
			ExceptionReference: raw.ExceptionReference,
			SourceFileID:       &sourceFileID,
		}

		if upsertErr := s.repo.UpsertReportingException(exc); upsertErr != nil {
			log.Warn().
				Err(upsertErr).
				Str("lei", raw.LEI).
				Msg("Failed to upsert reporting exception, skipping")
			failed++
			continue
		}

		processed++
		if processed%10000 == 0 {
			log.Info().Int("processed", processed).Int("failed", failed).Msg("REPEX processing progress")
		}
	}

	return processed, failed, nil
}

// --- Counts ---

func (s *leiLevel2Service) CountRelationshipRecords() (int64, error) {
	return s.repo.CountRelationshipRecords()
}

func (s *leiLevel2Service) CountReportingExceptions() (int64, error) {
	return s.repo.CountReportingExceptions()
}

// parseGLEIFTime parses common GLEIF timestamp formats.
func parseGLEIFTime(value string) *time.Time {
	if value == "" {
		return nil
	}
	for _, layout := range []string{
		"2006-01-02T15:04:05Z",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02",
	} {
		if t, err := time.Parse(layout, value); err == nil {
			return &t
		}
	}
	return nil
}
