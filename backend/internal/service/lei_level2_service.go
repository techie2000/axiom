package service

import (
	"archive/zip"
	"bufio"
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

const level2UpsertBatchSize = 1000
const level2ProgressCheckpointInterval = 1000

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

	// GetProcessingFailures returns persisted Level 2 processing failures.
	GetProcessingFailures(jobType string, openOnly bool, limit, offset int) ([]*domain.LEILevel2ProcessingFailure, int64, error)
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

func shouldSkipDuplicateHash(existing *domain.SourceFile) bool {
	if existing == nil {
		return false
	}

	if existing.ProcessingStatus != "COMPLETED" {
		return false
	}

	if existing.FailedRecords > 0 {
		return false
	}

	if existing.ProcessedRecords <= 0 {
		return false
	}

	if existing.TotalRecords > 0 && existing.ProcessedRecords < existing.TotalRecords {
		return false
	}

	return true
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

	// Check for duplicate (already processed successfully)
	existing, err := s.leiRepo.FindSourceFileByHash(fileHash)
	if err == nil && shouldSkipDuplicateHash(existing) {
		log.Info().
			Str("file_type", fileType).
			Str("hash", fileHash).
			Msg("Level 2 file already processed (duplicate hash), skipping")
		if removeErr := os.Remove(filePath); removeErr != nil {
			log.Warn().Err(removeErr).Str("file", filePath).Msg("Failed to remove duplicate download")
		}
		return nil, fmt.Errorf("duplicate file already processed: %s", fileHash)
	}

	if err == nil && existing != nil {
		log.Info().
			Str("file_type", fileType).
			Str("hash", fileHash).
			Str("previous_status", existing.ProcessingStatus).
			Int("previous_processed", existing.ProcessedRecords).
			Int("previous_failed", existing.FailedRecords).
			Msg("Reprocessing duplicate Level 2 file because previous run was not fully successful")
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
	jobType := domain.JobTypeFromFileType(fileType)
	sourceFile := &domain.SourceFile{
		FileName:         fileName,
		FileType:         fileType,
		JobType:          jobType,
		JobLabel:         domain.JobTypeDisplayName(jobType),
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
	RelationshipRecord rrPayload `json:"RelationshipRecord"`
	rrPayload
}

type gleifString string

func (s *gleifString) UnmarshalJSON(data []byte) error {
	if len(data) == 0 || string(data) == "null" {
		*s = ""
		return nil
	}

	var plain string
	if err := json.Unmarshal(data, &plain); err == nil {
		*s = gleifString(plain)
		return nil
	}

	var wrapped struct {
		Value string `json:"$"`
	}
	if err := json.Unmarshal(data, &wrapped); err == nil {
		*s = gleifString(wrapped.Value)
		return nil
	}

	var list []json.RawMessage
	if err := json.Unmarshal(data, &list); err == nil {
		if len(list) == 0 {
			*s = ""
			return nil
		}

		values := make([]string, 0, len(list))
		for _, item := range list {
			var nested gleifString
			if itemErr := json.Unmarshal(item, &nested); itemErr != nil {
				return fmt.Errorf("unsupported GLEIF string list item format: %s", string(item))
			}
			if nested.String() != "" {
				values = append(values, nested.String())
			}
		}

		*s = gleifString(strings.Join(values, ","))
		return nil
	}

	return fmt.Errorf("unsupported GLEIF string format: %s", string(data))
}

func (s gleifString) String() string {
	return strings.TrimSpace(string(s))
}

type rrPayload struct {
	Relationship rrRelationship `json:"Relationship"`
	Registration rrRegistration `json:"Registration"`
}

type rrRelationship struct {
	StartNode               rrNode          `json:"StartNode"`
	EndNode                 rrNode          `json:"EndNode"`
	RelationshipType        gleifString     `json:"RelationshipType"`
	RelationshipStatus      gleifString     `json:"RelationshipStatus"`
	RelationshipPeriods     json.RawMessage `json:"RelationshipPeriods"`
	RelationshipQualifiers  json.RawMessage `json:"RelationshipQualifiers"`
	RelationshipQuantifiers json.RawMessage `json:"RelationshipQuantifiers"`
}

type rrNode struct {
	NodeID     gleifString `json:"NodeID"`
	NodeIDType gleifString `json:"NodeIDType"`
}

type rrRegistration struct {
	InitialRegistrationDate gleifString `json:"InitialRegistrationDate"`
	LastUpdateDate          gleifString `json:"LastUpdateDate"`
	NextRenewalDate         gleifString `json:"NextRenewalDate"`
	RegistrationStatus      gleifString `json:"RegistrationStatus"`
	ManagingLOU             gleifString `json:"ManagingLOU"`
	ValidationSources       gleifString `json:"ValidationSources"`
	ValidationDocuments     gleifString `json:"ValidationDocuments"`
	ValidationReference     gleifString `json:"ValidationReference"`
}

func (raw *rawRRRecord) payload() rrPayload {
	if raw.RelationshipRecord.Relationship.StartNode.NodeID.String() != "" ||
		raw.RelationshipRecord.Relationship.EndNode.NodeID.String() != "" {
		return raw.RelationshipRecord
	}
	return raw.rrPayload
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
	processed, failed, err := s.processRRZip(filePath, sourceFile)

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
	s.persistLevel2Progress(sourceFile, processed, failed, true)
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

func (s *leiLevel2Service) processRRZip(filePath string, sourceFile *domain.SourceFile) (processed, failed int, err error) {
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

		p, fa, processErr := s.parseAndUpsertRR(rc, sourceFile)
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

func (s *leiLevel2Service) parseAndUpsertRR(r io.Reader, sourceFile *domain.SourceFile) (processed, failed int, err error) {
	reader := bufio.NewReader(r)
	peek, _ := reader.Peek(256)
	header := strings.ToLower(string(peek))
	decoder := json.NewDecoder(reader)
	upserted := 0

	if strings.Contains(header, "\"relations\"") {
		return s.parseAndUpsertRRWrapped(decoder, sourceFile)
	}

	batch := make([]*domain.LEIRelationshipRecord, 0, level2UpsertBatchSize)

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
			s.recordProcessingFailure("LEVEL2_RR", &sourceFile.ID, "DECODE", "", nil, decErr)
			processed++
			failed++
			s.persistLevel2Progress(sourceFile, processed, failed, upserted, false)
			continue
		}

		record, mapErr := mapRawRRToRelationshipRecord(&raw, sourceFile.ID)
		if mapErr != nil {
			log.Warn().Err(mapErr).Msg("Failed to map RR record, skipping")
			s.recordProcessingFailure("LEVEL2_RR", &sourceFile.ID, "MAP", rrNaturalKeyFromRaw(&raw), &raw, mapErr)
			processed++
			failed++
			s.persistLevel2Progress(sourceFile, processed, failed, upserted, false)
			continue
		}

		record.SourceFileID = &sourceFile.ID
		batch = append(batch, record)
		if len(batch) < level2UpsertBatchSize {
			continue
		}

		batchProcessed, batchFailed, flushErr := s.flushRRBatch(batch)
		if flushErr != nil {
			return processed, failed, flushErr
		}
		processed += len(batch)
		upserted += batchProcessed
		failed += batchFailed
		s.persistLevel2Progress(sourceFile, processed, failed, upserted, false)
		if processed%10000 == 0 {
			log.Info().Int("processed", processed).Int("failed", failed).Msg("RR processing progress")
		}
		batch = batch[:0]
	}

	batchProcessed, batchFailed, flushErr := s.flushRRBatch(batch)
	if flushErr != nil {
		return processed, failed, flushErr
	}
	processed += len(batch)
	upserted += batchProcessed
	failed += batchFailed
	s.persistLevel2Progress(sourceFile, processed, failed, upserted, true)

	return processed, failed, nil
}

func (s *leiLevel2Service) parseAndUpsertRRWrapped(decoder *json.Decoder, sourceFile *domain.SourceFile) (processed, failed int, err error) {
	upserted := 0
	startTok, err := decoder.Token()
	if err != nil {
		return 0, 0, fmt.Errorf("failed to read RR wrapper start token: %w", err)
	}
	startDelim, ok := startTok.(json.Delim)
	if !ok || startDelim != '{' {
		return 0, 0, fmt.Errorf("invalid RR wrapper start token: %v", startTok)
	}

	foundRelations := false
	for decoder.More() {
		keyTok, keyErr := decoder.Token()
		if keyErr != nil {
			return processed, failed, fmt.Errorf("failed to read RR wrapper key: %w", keyErr)
		}
		key, ok := keyTok.(string)
		if !ok {
			return processed, failed, fmt.Errorf("invalid RR wrapper key token: %v", keyTok)
		}

		if key != "relations" {
			var discard json.RawMessage
			if decErr := decoder.Decode(&discard); decErr != nil {
				return processed, failed, fmt.Errorf("failed to skip RR wrapper key %q: %w", key, decErr)
			}
			continue
		}

		foundRelations = true
		arrStartTok, arrErr := decoder.Token()
		if arrErr != nil {
			return processed, failed, fmt.Errorf("failed to read relations array start: %w", arrErr)
		}
		arrStart, ok := arrStartTok.(json.Delim)
		if !ok || arrStart != '[' {
			return processed, failed, fmt.Errorf("invalid relations array start token: %v", arrStartTok)
		}

		batch := make([]*domain.LEIRelationshipRecord, 0, level2UpsertBatchSize)

		for decoder.More() {
			var raw rawRRRecord
			if decErr := decoder.Decode(&raw); decErr != nil {
				log.Warn().Err(decErr).Msg("Failed to decode RR JSON record in relations array, skipping")
				s.recordProcessingFailure("LEVEL2_RR", &sourceFile.ID, "DECODE", "", nil, decErr)
				processed++
				failed++
				s.persistLevel2Progress(sourceFile, processed, failed, upserted, false)
				continue
			}

			record, mapErr := mapRawRRToRelationshipRecord(&raw, sourceFile.ID)
			if mapErr != nil {
				log.Warn().Err(mapErr).Msg("Failed to map RR record, skipping")
				s.recordProcessingFailure("LEVEL2_RR", &sourceFile.ID, "MAP", rrNaturalKeyFromRaw(&raw), &raw, mapErr)
				processed++
				failed++
				s.persistLevel2Progress(sourceFile, processed, failed, upserted, false)
				continue
			}

			record.SourceFileID = &sourceFile.ID
			batch = append(batch, record)
			if len(batch) < level2UpsertBatchSize {
				continue
			}

			batchProcessed, batchFailed, flushErr := s.flushRRBatch(batch)
			if flushErr != nil {
				return processed, failed, flushErr
			}
			processed += len(batch)
			upserted += batchProcessed
			failed += batchFailed
			s.persistLevel2Progress(sourceFile, processed, failed, upserted, false)
			if processed%10000 == 0 {
				log.Info().Int("processed", processed).Int("failed", failed).Msg("RR processing progress")
			}
			batch = batch[:0]
		}

		batchProcessed, batchFailed, flushErr := s.flushRRBatch(batch)
		if flushErr != nil {
			return processed, failed, flushErr
		}
		processed += len(batch)
		upserted += batchProcessed
		failed += batchFailed
		s.persistLevel2Progress(sourceFile, processed, failed, upserted, false)

		arrEndTok, arrEndErr := decoder.Token()
		if arrEndErr != nil {
			return processed, failed, fmt.Errorf("failed to read relations array end: %w", arrEndErr)
		}
		arrEnd, ok := arrEndTok.(json.Delim)
		if !ok || arrEnd != ']' {
			return processed, failed, fmt.Errorf("invalid relations array end token: %v", arrEndTok)
		}
	}

	objEndTok, objEndErr := decoder.Token()
	if objEndErr != nil {
		return processed, failed, fmt.Errorf("failed to read RR wrapper end token: %w", objEndErr)
	}
	objEnd, ok := objEndTok.(json.Delim)
	if !ok || objEnd != '}' {
		return processed, failed, fmt.Errorf("invalid RR wrapper end token: %v", objEndTok)
	}

	if !foundRelations {
		return processed, failed, fmt.Errorf("RR payload missing relations array")
	}

	s.persistLevel2Progress(sourceFile, processed, failed, upserted, true)

	return processed, failed, nil
}

func mapRawRRToRelationshipRecord(raw *rawRRRecord, sourceFileID uuid.UUID) (*domain.LEIRelationshipRecord, error) {
	payload := raw.payload()
	if payload.Relationship.StartNode.NodeID.String() == "" || payload.Relationship.EndNode.NodeID.String() == "" {
		return nil, fmt.Errorf("missing start or end node LEI")
	}

	record := &domain.LEIRelationshipRecord{
		StartNodeLEI:        payload.Relationship.StartNode.NodeID.String(),
		EndNodeLEI:          payload.Relationship.EndNode.NodeID.String(),
		RelationshipType:    payload.Relationship.RelationshipType.String(),
		RelationshipStatus:  payload.Relationship.RelationshipStatus.String(),
		RegistrationStatus:  payload.Registration.RegistrationStatus.String(),
		ManagingLOU:         payload.Registration.ManagingLOU.String(),
		ValidationSources:   payload.Registration.ValidationSources.String(),
		ValidationDocuments: payload.Registration.ValidationDocuments.String(),
		ValidationReference: payload.Registration.ValidationReference.String(),
		SourceFileID:        &sourceFileID,
	}

	if len(payload.Relationship.RelationshipPeriods) > 0 && string(payload.Relationship.RelationshipPeriods) != "null" {
		record.RelationshipPeriods = domain.JSONBString(payload.Relationship.RelationshipPeriods)
	}
	if len(payload.Relationship.RelationshipQualifiers) > 0 && string(payload.Relationship.RelationshipQualifiers) != "null" {
		record.RelationshipQualifiers = domain.JSONBString(payload.Relationship.RelationshipQualifiers)
	}
	if len(payload.Relationship.RelationshipQuantifiers) > 0 && string(payload.Relationship.RelationshipQuantifiers) != "null" {
		record.RelationshipQuantifiers = domain.JSONBString(payload.Relationship.RelationshipQuantifiers)
	}

	record.InitialRegistrationDate = parseGLEIFTime(payload.Registration.InitialRegistrationDate.String())
	record.LastUpdateDate = parseGLEIFTime(payload.Registration.LastUpdateDate.String())
	record.NextRenewalDate = parseGLEIFTime(payload.Registration.NextRenewalDate.String())

	return record, nil
}

func rrNaturalKey(startLEI, endLEI, relationshipType string) string {
	start := strings.TrimSpace(startLEI)
	end := strings.TrimSpace(endLEI)
	relType := strings.TrimSpace(relationshipType)
	if start == "" || end == "" || relType == "" {
		return ""
	}
	return start + "|" + end + "|" + relType
}

func rrNaturalKeyFromRaw(raw *rawRRRecord) string {
	if raw == nil {
		return ""
	}
	payload := raw.payload()
	return rrNaturalKey(
		payload.Relationship.StartNode.NodeID.String(),
		payload.Relationship.EndNode.NodeID.String(),
		payload.Relationship.RelationshipType.String(),
	)
}

func repexNaturalKey(lei, exceptionCategory string) string {
	leicode := strings.TrimSpace(lei)
	category := strings.TrimSpace(exceptionCategory)
	if leicode == "" || category == "" {
		return ""
	}
	return leicode + "|" + category
}

func (s *leiLevel2Service) recordProcessingFailure(
	jobType string,
	sourceFileID *uuid.UUID,
	failureStage string,
	naturalKey string,
	rawRecord interface{},
	cause error,
) {
	persistProcessingFailure(
		s.repo,
		jobType,
		sourceFileID,
		failureStage,
		strings.TrimSpace(naturalKey),
		rawRecord,
		cause,
	)
}

func (s *leiLevel2Service) resolveOpenProcessingFailures(jobType, naturalKey string, sourceFileID *uuid.UUID) {
	if err := s.repo.ResolveOpenProcessingFailures(jobType, naturalKey, sourceFileID, "Resolved by subsequent successful upsert"); err != nil {
		log.Warn().Err(err).
			Str("job_type", jobType).
			Str("natural_key", naturalKey).
			Msg("Failed to resolve Level 2 processing failure lifecycle rows")
	}
}

// batchResolveOpenProcessingFailures resolves open processing failures for a set of natural keys
// in a single UPDATE … WHERE natural_key IN (…) query, avoiding N round-trips per batch.
// Level 2 natural keys are pre-normalized by rrNaturalKey / repexNaturalKey; empty keys are
// filtered out by the repository layer.
func (s *leiLevel2Service) batchResolveOpenProcessingFailures(jobType string, naturalKeys []string, sourceFileID *uuid.UUID) {
	if len(naturalKeys) == 0 {
		return
	}
	if err := s.repo.BatchResolveOpenProcessingFailures(jobType, naturalKeys, sourceFileID, "Resolved by subsequent successful upsert"); err != nil {
		log.Warn().Err(err).
			Str("job_type", jobType).
			Int("key_count", len(naturalKeys)).
			Msg("Failed to batch-resolve Level 2 processing failure lifecycle rows")
	}
}

func (s *leiLevel2Service) flushRRBatch(batch []*domain.LEIRelationshipRecord) (processed int, failed int, err error) {
	if len(batch) == 0 {
		return 0, 0, nil
	}

	upsertBatch := batch
	if s.leiRepo != nil {
		knownLEIs, lookupErr := s.lookupExistingLEIsFromRRBatch(batch)
		if lookupErr != nil {
			log.Warn().Err(lookupErr).Int("batch_size", len(batch)).Msg("RR LEI existence pre-check failed, proceeding with DB upsert path")
		} else {
			upsertBatch = upsertBatch[:0]
			for _, record := range batch {
				missingRefs := rrMissingNodeRefs(record, knownLEIs)
				if len(missingRefs) == 0 {
					upsertBatch = append(upsertBatch, record)
					continue
				}

				s.recordProcessingFailure(
					"LEVEL2_RR",
					record.SourceFileID,
					"FK_PREREQ",
					rrNaturalKey(record.StartNodeLEI, record.EndNodeLEI, record.RelationshipType),
					record,
					fmt.Errorf("deferred RR upsert: missing LEI parent record(s): %s", strings.Join(missingRefs, ", ")),
				)
				failed++
			}
		}
	}

	if len(upsertBatch) == 0 {
		return 0, failed, nil
	}

	if created, updated, batchErr := s.repo.BatchUpsertRelationshipRecords(upsertBatch); batchErr == nil {
		naturalKeys := make([]string, 0, len(upsertBatch))
		// All records in a batch are sourced from the same file; use the first non-nil ID.
		var sourceFileID *uuid.UUID
		for _, record := range upsertBatch {
			naturalKeys = append(naturalKeys, rrNaturalKey(record.StartNodeLEI, record.EndNodeLEI, record.RelationshipType))
			if sourceFileID == nil {
				sourceFileID = record.SourceFileID
			}
		}
		s.batchResolveOpenProcessingFailures("LEVEL2_RR", naturalKeys, sourceFileID)
		return created + updated, failed, nil
	} else {
		log.Warn().Err(batchErr).Int("batch_size", len(upsertBatch)).Msg("RR batch upsert failed, falling back to row-by-row")
	}

	for _, record := range upsertBatch {
		if upsertErr := s.repo.UpsertRelationshipRecord(record); upsertErr != nil {
			log.Warn().
				Err(upsertErr).
				Str("start_lei", record.StartNodeLEI).
				Str("end_lei", record.EndNodeLEI).
				Msg("Failed to upsert relationship record, skipping")
			s.recordProcessingFailure("LEVEL2_RR", record.SourceFileID, "UPSERT", rrNaturalKey(record.StartNodeLEI, record.EndNodeLEI, record.RelationshipType), record, upsertErr)
			failed++
			continue
		}
		s.resolveOpenProcessingFailures("LEVEL2_RR", rrNaturalKey(record.StartNodeLEI, record.EndNodeLEI, record.RelationshipType), record.SourceFileID)
		processed++
	}

	return processed, failed, nil
}

func (s *leiLevel2Service) lookupExistingLEIsFromRRBatch(batch []*domain.LEIRelationshipRecord) (map[string]struct{}, error) {
	if len(batch) == 0 {
		return map[string]struct{}{}, nil
	}

	seen := make(map[string]struct{}, len(batch)*2)
	leiCodes := make([]string, 0, len(batch)*2)
	for _, record := range batch {
		start := strings.TrimSpace(record.StartNodeLEI)
		if start != "" {
			if _, exists := seen[start]; !exists {
				seen[start] = struct{}{}
				leiCodes = append(leiCodes, start)
			}
		}

		end := strings.TrimSpace(record.EndNodeLEI)
		if end != "" {
			if _, exists := seen[end]; !exists {
				seen[end] = struct{}{}
				leiCodes = append(leiCodes, end)
			}
		}
	}

	if len(leiCodes) == 0 {
		return map[string]struct{}{}, nil
	}

	namesByLEI, err := s.leiRepo.FindLegalNamesByLEICodes(leiCodes)
	if err != nil {
		return nil, err
	}

	existing := make(map[string]struct{}, len(namesByLEI))
	for lei := range namesByLEI {
		existing[strings.TrimSpace(lei)] = struct{}{}
	}

	return existing, nil
}

func rrMissingNodeRefs(record *domain.LEIRelationshipRecord, existing map[string]struct{}) []string {
	missing := make([]string, 0, 2)

	start := strings.TrimSpace(record.StartNodeLEI)
	if start != "" {
		if _, ok := existing[start]; !ok {
			missing = append(missing, "start_node_lei="+start)
		}
	}

	end := strings.TrimSpace(record.EndNodeLEI)
	if end != "" {
		if _, ok := existing[end]; !ok {
			missing = append(missing, "end_node_lei="+end)
		}
	}

	return missing
}

// --- Reporting Exceptions (REPEX) processing ---

// rawREPEXRecord is the JSON Lines structure for a single GLEIF REPEX record.
type rawREPEXRecord struct {
	LEI                gleifString     `json:"LEI"`
	ExceptionCategory  gleifString     `json:"ExceptionCategory"`
	ExceptionReason    gleifStringList `json:"ExceptionReason"`
	ExceptionReference gleifString     `json:"ExceptionReference"`
}

type gleifStringList []gleifString

func (l *gleifStringList) UnmarshalJSON(data []byte) error {
	if len(data) == 0 || string(data) == "null" {
		*l = nil
		return nil
	}

	var list []gleifString
	if err := json.Unmarshal(data, &list); err == nil {
		*l = gleifStringList(list)
		return nil
	}

	var single gleifString
	if err := json.Unmarshal(data, &single); err == nil {
		*l = gleifStringList{single}
		return nil
	}

	return fmt.Errorf("unsupported GLEIF list format: %s", string(data))
}

func gleifReasonsToJSONB(reasons []gleifString) domain.JSONBString {
	if len(reasons) == 0 {
		return domain.JSONBString("[]")
	}

	parts := make([]string, 0, len(reasons))
	for _, reason := range reasons {
		value := reason.String()
		if value != "" {
			parts = append(parts, value)
		}
	}

	encoded, err := json.Marshal(parts)
	if err != nil {
		return domain.JSONBString("[]")
	}

	return domain.JSONBString(encoded)
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
	processed, failed, err := s.processREPEXZip(filePath, sourceFile)

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
	s.persistLevel2Progress(sourceFile, processed, failed, true)
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

func (s *leiLevel2Service) processREPEXZip(filePath string, sourceFile *domain.SourceFile) (processed, failed int, err error) {
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

		p, fa, processErr := s.parseAndUpsertREPEX(rc, sourceFile)
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

func (s *leiLevel2Service) parseAndUpsertREPEX(r io.Reader, sourceFile *domain.SourceFile) (processed, failed int, err error) {
	reader := bufio.NewReader(r)
	peek, _ := reader.Peek(256)
	header := strings.ToLower(string(peek))
	decoder := json.NewDecoder(reader)
	upserted := 0

	if strings.Contains(header, "\"exceptions\"") {
		return s.parseAndUpsertREPEXWrapped(decoder, sourceFile)
	}

	batch := make([]*domain.LEIReportingException, 0, level2UpsertBatchSize)

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
			s.recordProcessingFailure("LEVEL2_REPEX", &sourceFile.ID, "DECODE", "", nil, decErr)
			processed++
			failed++
			s.persistLevel2Progress(sourceFile, processed, failed, upserted, false)
			continue
		}

		exc := &domain.LEIReportingException{
			LEI:                raw.LEI.String(),
			ExceptionCategory:  raw.ExceptionCategory.String(),
			ExceptionReasons:   gleifReasonsToJSONB(raw.ExceptionReason),
			ExceptionReference: raw.ExceptionReference.String(),
			SourceFileID:       &sourceFile.ID,
		}

		batch = append(batch, exc)
		if len(batch) < level2UpsertBatchSize {
			continue
		}

		batchProcessed, batchFailed, flushErr := s.flushREPEXBatch(batch)
		if flushErr != nil {
			return processed, failed, flushErr
		}
		processed += len(batch)
		upserted += batchProcessed
		failed += batchFailed
		s.persistLevel2Progress(sourceFile, processed, failed, upserted, false)
		if processed%10000 == 0 {
			log.Info().Int("processed", processed).Int("failed", failed).Msg("REPEX processing progress")
		}
		batch = batch[:0]
	}

	batchProcessed, batchFailed, flushErr := s.flushREPEXBatch(batch)
	if flushErr != nil {
		return processed, failed, flushErr
	}
	processed += len(batch)
	upserted += batchProcessed
	failed += batchFailed
	s.persistLevel2Progress(sourceFile, processed, failed, upserted, true)

	return processed, failed, nil
}

func (s *leiLevel2Service) parseAndUpsertREPEXWrapped(decoder *json.Decoder, sourceFile *domain.SourceFile) (processed, failed int, err error) {
	upserted := 0
	startTok, err := decoder.Token()
	if err != nil {
		return 0, 0, fmt.Errorf("failed to read REPEX wrapper start token: %w", err)
	}
	startDelim, ok := startTok.(json.Delim)
	if !ok || startDelim != '{' {
		return 0, 0, fmt.Errorf("invalid REPEX wrapper start token: %v", startTok)
	}

	foundExceptions := false
	for decoder.More() {
		keyTok, keyErr := decoder.Token()
		if keyErr != nil {
			return processed, failed, fmt.Errorf("failed to read REPEX wrapper key: %w", keyErr)
		}
		key, ok := keyTok.(string)
		if !ok {
			return processed, failed, fmt.Errorf("invalid REPEX wrapper key token: %v", keyTok)
		}

		if key != "exceptions" {
			var discard json.RawMessage
			if decErr := decoder.Decode(&discard); decErr != nil {
				return processed, failed, fmt.Errorf("failed to skip REPEX wrapper key %q: %w", key, decErr)
			}
			continue
		}

		foundExceptions = true
		arrStartTok, arrErr := decoder.Token()
		if arrErr != nil {
			return processed, failed, fmt.Errorf("failed to read exceptions array start: %w", arrErr)
		}
		arrStart, ok := arrStartTok.(json.Delim)
		if !ok || arrStart != '[' {
			return processed, failed, fmt.Errorf("invalid exceptions array start token: %v", arrStartTok)
		}

		batch := make([]*domain.LEIReportingException, 0, level2UpsertBatchSize)

		for decoder.More() {
			var raw rawREPEXRecord
			if decErr := decoder.Decode(&raw); decErr != nil {
				log.Warn().Err(decErr).Msg("Failed to decode REPEX JSON record in exceptions array, skipping")
				s.recordProcessingFailure("LEVEL2_REPEX", &sourceFile.ID, "DECODE", "", nil, decErr)
				processed++
				failed++
				s.persistLevel2Progress(sourceFile, processed, failed, upserted, false)
				continue
			}

			exc := &domain.LEIReportingException{
				LEI:                raw.LEI.String(),
				ExceptionCategory:  raw.ExceptionCategory.String(),
				ExceptionReasons:   gleifReasonsToJSONB(raw.ExceptionReason),
				ExceptionReference: raw.ExceptionReference.String(),
				SourceFileID:       &sourceFile.ID,
			}

			batch = append(batch, exc)
			if len(batch) < level2UpsertBatchSize {
				continue
			}

			batchProcessed, batchFailed, flushErr := s.flushREPEXBatch(batch)
			if flushErr != nil {
				return processed, failed, flushErr
			}
			processed += len(batch)
			upserted += batchProcessed
			failed += batchFailed
			s.persistLevel2Progress(sourceFile, processed, failed, upserted, false)
			if processed%10000 == 0 {
				log.Info().Int("processed", processed).Int("failed", failed).Msg("REPEX processing progress")
			}
			batch = batch[:0]
		}

		batchProcessed, batchFailed, flushErr := s.flushREPEXBatch(batch)
		if flushErr != nil {
			return processed, failed, flushErr
		}
		processed += len(batch)
		upserted += batchProcessed
		failed += batchFailed
		s.persistLevel2Progress(sourceFile, processed, failed, upserted, false)

		arrEndTok, arrEndErr := decoder.Token()
		if arrEndErr != nil {
			return processed, failed, fmt.Errorf("failed to read exceptions array end: %w", arrEndErr)
		}
		arrEnd, ok := arrEndTok.(json.Delim)
		if !ok || arrEnd != ']' {
			return processed, failed, fmt.Errorf("invalid exceptions array end token: %v", arrEndTok)
		}
	}

	objEndTok, objEndErr := decoder.Token()
	if objEndErr != nil {
		return processed, failed, fmt.Errorf("failed to read REPEX wrapper end token: %w", objEndErr)
	}
	objEnd, ok := objEndTok.(json.Delim)
	if !ok || objEnd != '}' {
		return processed, failed, fmt.Errorf("invalid REPEX wrapper end token: %v", objEndTok)
	}

	if !foundExceptions {
		return processed, failed, fmt.Errorf("REPEX payload missing exceptions array")
	}

	s.persistLevel2Progress(sourceFile, processed, failed, upserted, true)

	return processed, failed, nil
}

func shouldPersistLevel2ProgressCheckpoint(previousProcessed, processed, previousFailed, failed int, force bool) bool {
	if force {
		return previousProcessed != processed || previousFailed != failed
	}

	if previousFailed != failed {
		return true
	}

	if previousProcessed == processed {
		return false
	}

	return (processed / level2ProgressCheckpointInterval) > (previousProcessed / level2ProgressCheckpointInterval)
}

type level2ProgressMessage struct {
	Kind      string `json:"kind"`
	Evaluated int    `json:"evaluated"`
	Upserted  int    `json:"upserted"`
	Unchanged int    `json:"unchanged"`
	Failed    int    `json:"failed"`
	Total     int    `json:"total,omitempty"`
}

func buildLevel2ProgressMessage(total, evaluated, upserted, failed int) string {
	unchanged := evaluated - upserted - failed
	if unchanged < 0 {
		unchanged = 0
	}

	payload := level2ProgressMessage{
		Kind:      "level2-progress",
		Evaluated: evaluated,
		Upserted:  upserted,
		Unchanged: unchanged,
		Failed:    failed,
	}
	if total > 0 {
		payload.Total = total
	}

	encoded, err := json.Marshal(payload)
	if err != nil {
		return ""
	}

	return string(encoded)
}

func (s *leiLevel2Service) persistLevel2Progress(sourceFile *domain.SourceFile, processed, failed, upserted int, force bool) {
	if sourceFile == nil {
		return
	}

	if !shouldPersistLevel2ProgressCheckpoint(sourceFile.ProcessedRecords, processed, sourceFile.FailedRecords, failed, force) {
		return
	}

	sourceFile.ProcessedRecords = processed
	sourceFile.FailedRecords = failed
	if sourceFile.TotalRecords > 0 && sourceFile.ProcessedRecords > sourceFile.TotalRecords {
		sourceFile.TotalRecords = sourceFile.ProcessedRecords
	}

	if s.leiRepo != nil {
		progressMessage := buildLevel2ProgressMessage(sourceFile.TotalRecords, processed, upserted, failed)
		if progressMessage != "" {
			if err := s.leiRepo.UpdateProcessingProgressMessageByJobType(sourceFile.JobType, progressMessage); err != nil {
				log.Warn().Err(err).
					Str("source_file_id", sourceFile.ID.String()).
					Str("job_type", sourceFile.JobType).
					Int("processed", processed).
					Int("upserted", upserted).
					Int("failed", failed).
					Msg("Failed to persist Level 2 progress message")
			}
		}
	}

	if err := s.leiRepo.UpdateSourceFile(sourceFile); err != nil {
		log.Warn().Err(err).
			Str("source_file_id", sourceFile.ID.String()).
			Int("processed", processed).
			Int("failed", failed).
			Msg("Failed to persist Level 2 processing progress checkpoint")
	}
}

func (s *leiLevel2Service) flushREPEXBatch(batch []*domain.LEIReportingException) (processed int, failed int, err error) {
	if len(batch) == 0 {
		return 0, 0, nil
	}

	upsertBatch := batch
	if s.leiRepo != nil {
		knownLEIs, lookupErr := s.lookupExistingLEIsFromREPEXBatch(batch)
		if lookupErr != nil {
			log.Warn().Err(lookupErr).Int("batch_size", len(batch)).Msg("REPEX LEI existence pre-check failed, proceeding with DB upsert path")
		} else {
			upsertBatch = upsertBatch[:0]
			for _, exc := range batch {
				lei := strings.TrimSpace(exc.LEI)
				if _, ok := knownLEIs[lei]; ok || lei == "" {
					upsertBatch = append(upsertBatch, exc)
					continue
				}

				s.recordProcessingFailure(
					"LEVEL2_REPEX",
					exc.SourceFileID,
					"FK_PREREQ",
					repexNaturalKey(exc.LEI, exc.ExceptionCategory),
					exc,
					fmt.Errorf("deferred REPEX upsert: missing LEI parent record: %s", lei),
				)
				failed++
			}
		}
	}

	if len(upsertBatch) == 0 {
		return 0, failed, nil
	}

	if created, updated, batchErr := s.repo.BatchUpsertReportingExceptions(upsertBatch); batchErr == nil {
		naturalKeys := make([]string, 0, len(upsertBatch))
		// All exceptions in a batch are sourced from the same file; use the first non-nil ID.
		var sourceFileID *uuid.UUID
		for _, exc := range upsertBatch {
			naturalKeys = append(naturalKeys, repexNaturalKey(exc.LEI, exc.ExceptionCategory))
			if sourceFileID == nil {
				sourceFileID = exc.SourceFileID
			}
		}
		s.batchResolveOpenProcessingFailures("LEVEL2_REPEX", naturalKeys, sourceFileID)
		return created + updated, failed, nil
	} else {
		log.Warn().Err(batchErr).Int("batch_size", len(upsertBatch)).Msg("REPEX batch upsert failed, falling back to row-by-row")
	}

	for _, exc := range upsertBatch {
		if upsertErr := s.repo.UpsertReportingException(exc); upsertErr != nil {
			log.Warn().
				Err(upsertErr).
				Str("lei", exc.LEI).
				Msg("Failed to upsert reporting exception, skipping")
			s.recordProcessingFailure("LEVEL2_REPEX", exc.SourceFileID, "UPSERT", repexNaturalKey(exc.LEI, exc.ExceptionCategory), exc, upsertErr)
			failed++
			continue
		}
		s.resolveOpenProcessingFailures("LEVEL2_REPEX", repexNaturalKey(exc.LEI, exc.ExceptionCategory), exc.SourceFileID)
		processed++
	}

	return processed, failed, nil
}

func (s *leiLevel2Service) lookupExistingLEIsFromREPEXBatch(batch []*domain.LEIReportingException) (map[string]struct{}, error) {
	if len(batch) == 0 {
		return map[string]struct{}{}, nil
	}

	seen := make(map[string]struct{}, len(batch))
	leiCodes := make([]string, 0, len(batch))
	for _, exc := range batch {
		lei := strings.TrimSpace(exc.LEI)
		if lei != "" {
			if _, exists := seen[lei]; !exists {
				seen[lei] = struct{}{}
				leiCodes = append(leiCodes, lei)
			}
		}
	}

	if len(leiCodes) == 0 {
		return map[string]struct{}{}, nil
	}

	namesByLEI, err := s.leiRepo.FindLegalNamesByLEICodes(leiCodes)
	if err != nil {
		return nil, err
	}

	existing := make(map[string]struct{}, len(namesByLEI))
	for lei := range namesByLEI {
		existing[strings.TrimSpace(lei)] = struct{}{}
	}

	return existing, nil
}

// --- Counts ---

func (s *leiLevel2Service) CountRelationshipRecords() (int64, error) {
	return s.repo.CountRelationshipRecords()
}

func (s *leiLevel2Service) CountReportingExceptions() (int64, error) {
	return s.repo.CountReportingExceptions()
}

func (s *leiLevel2Service) GetProcessingFailures(jobType string, openOnly bool, limit, offset int) ([]*domain.LEILevel2ProcessingFailure, int64, error) {
	failures, err := s.repo.ListProcessingFailures(jobType, openOnly, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	total, err := s.repo.CountProcessingFailures(jobType, openOnly)
	if err != nil {
		return nil, 0, err
	}
	return failures, total, nil
}

// parseGLEIFTime parses common GLEIF timestamp formats, including sub-second variants
// such as "2026-04-09T10:21:26.360Z" that appear on newly-issued LEI records.
func parseGLEIFTime(value string) *time.Time {
	if value == "" {
		return nil
	}
	for _, layout := range []string{
		time.RFC3339Nano, // handles .360Z, .000Z, etc.
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
