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
	reader := bufio.NewReader(r)
	peek, _ := reader.Peek(256)
	header := strings.ToLower(string(peek))
	decoder := json.NewDecoder(reader)

	if strings.Contains(header, "\"relations\"") {
		return s.parseAndUpsertRRWrapped(decoder, sourceFileID)
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
			failed++
			continue
		}

		record, mapErr := mapRawRRToRelationshipRecord(&raw, sourceFileID)
		if mapErr != nil {
			log.Warn().Err(mapErr).Msg("Failed to map RR record, skipping")
			failed++
			continue
		}

		batch = append(batch, record)
		if len(batch) < level2UpsertBatchSize {
			continue
		}

		batchProcessed, batchFailed, flushErr := s.flushRRBatch(batch)
		if flushErr != nil {
			return processed, failed, flushErr
		}
		processed += batchProcessed
		failed += batchFailed
		if processed%10000 == 0 {
			log.Info().Int("processed", processed).Int("failed", failed).Msg("RR processing progress")
		}
		batch = batch[:0]
	}

	batchProcessed, batchFailed, flushErr := s.flushRRBatch(batch)
	if flushErr != nil {
		return processed, failed, flushErr
	}
	processed += batchProcessed
	failed += batchFailed

	return processed, failed, nil
}

func (s *leiLevel2Service) parseAndUpsertRRWrapped(decoder *json.Decoder, sourceFileID uuid.UUID) (processed, failed int, err error) {
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
				failed++
				continue
			}

			record, mapErr := mapRawRRToRelationshipRecord(&raw, sourceFileID)
			if mapErr != nil {
				log.Warn().Err(mapErr).Msg("Failed to map RR record, skipping")
				failed++
				continue
			}

			batch = append(batch, record)
			if len(batch) < level2UpsertBatchSize {
				continue
			}

			batchProcessed, batchFailed, flushErr := s.flushRRBatch(batch)
			if flushErr != nil {
				return processed, failed, flushErr
			}
			processed += batchProcessed
			failed += batchFailed
			if processed%10000 == 0 {
				log.Info().Int("processed", processed).Int("failed", failed).Msg("RR processing progress")
			}
			batch = batch[:0]
		}

		batchProcessed, batchFailed, flushErr := s.flushRRBatch(batch)
		if flushErr != nil {
			return processed, failed, flushErr
		}
		processed += batchProcessed
		failed += batchFailed

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

func (s *leiLevel2Service) flushRRBatch(batch []*domain.LEIRelationshipRecord) (processed int, failed int, err error) {
	if len(batch) == 0 {
		return 0, 0, nil
	}

	if batchErr := s.repo.BatchUpsertRelationshipRecords(batch); batchErr == nil {
		return len(batch), 0, nil
	} else {
		log.Warn().Err(batchErr).Int("batch_size", len(batch)).Msg("RR batch upsert failed, falling back to row-by-row")
	}

	for _, record := range batch {
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
	}

	return processed, failed, nil
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

func joinGLEIFReasons(reasons []gleifString) string {
	if len(reasons) == 0 {
		return ""
	}

	parts := make([]string, 0, len(reasons))
	for _, reason := range reasons {
		v := reason.String()
		if v != "" {
			parts = append(parts, v)
		}
	}

	return strings.Join(parts, ",")
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
	reader := bufio.NewReader(r)
	peek, _ := reader.Peek(256)
	header := strings.ToLower(string(peek))
	decoder := json.NewDecoder(reader)

	if strings.Contains(header, "\"exceptions\"") {
		return s.parseAndUpsertREPEXWrapped(decoder, sourceFileID)
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
			failed++
			continue
		}

		exc := &domain.LEIReportingException{
			LEI:                raw.LEI.String(),
			ExceptionCategory:  raw.ExceptionCategory.String(),
			ExceptionReason:    joinGLEIFReasons(raw.ExceptionReason),
			ExceptionReference: raw.ExceptionReference.String(),
			SourceFileID:       &sourceFileID,
		}

		batch = append(batch, exc)
		if len(batch) < level2UpsertBatchSize {
			continue
		}

		batchProcessed, batchFailed, flushErr := s.flushREPEXBatch(batch)
		if flushErr != nil {
			return processed, failed, flushErr
		}
		processed += batchProcessed
		failed += batchFailed
		if processed%10000 == 0 {
			log.Info().Int("processed", processed).Int("failed", failed).Msg("REPEX processing progress")
		}
		batch = batch[:0]
	}

	batchProcessed, batchFailed, flushErr := s.flushREPEXBatch(batch)
	if flushErr != nil {
		return processed, failed, flushErr
	}
	processed += batchProcessed
	failed += batchFailed

	return processed, failed, nil
}

func (s *leiLevel2Service) parseAndUpsertREPEXWrapped(decoder *json.Decoder, sourceFileID uuid.UUID) (processed, failed int, err error) {
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
				failed++
				continue
			}

			exc := &domain.LEIReportingException{
				LEI:                raw.LEI.String(),
				ExceptionCategory:  raw.ExceptionCategory.String(),
				ExceptionReason:    joinGLEIFReasons(raw.ExceptionReason),
				ExceptionReference: raw.ExceptionReference.String(),
				SourceFileID:       &sourceFileID,
			}

			batch = append(batch, exc)
			if len(batch) < level2UpsertBatchSize {
				continue
			}

			batchProcessed, batchFailed, flushErr := s.flushREPEXBatch(batch)
			if flushErr != nil {
				return processed, failed, flushErr
			}
			processed += batchProcessed
			failed += batchFailed
			if processed%10000 == 0 {
				log.Info().Int("processed", processed).Int("failed", failed).Msg("REPEX processing progress")
			}
			batch = batch[:0]
		}

		batchProcessed, batchFailed, flushErr := s.flushREPEXBatch(batch)
		if flushErr != nil {
			return processed, failed, flushErr
		}
		processed += batchProcessed
		failed += batchFailed

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

	return processed, failed, nil
}

func (s *leiLevel2Service) flushREPEXBatch(batch []*domain.LEIReportingException) (processed int, failed int, err error) {
	if len(batch) == 0 {
		return 0, 0, nil
	}

	if batchErr := s.repo.BatchUpsertReportingExceptions(batch); batchErr == nil {
		return len(batch), 0, nil
	} else {
		log.Warn().Err(batchErr).Int("batch_size", len(batch)).Msg("REPEX batch upsert failed, falling back to row-by-row")
	}

	for _, exc := range batch {
		if upsertErr := s.repo.UpsertReportingException(exc); upsertErr != nil {
			log.Warn().
				Err(upsertErr).
				Str("lei", exc.LEI).
				Msg("Failed to upsert reporting exception, skipping")
			failed++
			continue
		}
		processed++
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
