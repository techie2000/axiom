package service

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/repository"
)

func isTerminalJSONDecodeError(err error) bool {
	if err == nil {
		return false
	}

	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		return true
	}

	errMsg := strings.ToLower(err.Error())
	return strings.Contains(errMsg, "unexpected eof")
}

// GLEIF API endpoints and data directory configuration
const (
	// Base URL for GLEIF golden copy API
	GLEIFBaseURL = "https://goldencopy.gleif.org"

	// Discovery endpoint to get latest file URLs
	// Returns bulk file metadata - format differs from single LEI API queries
	GLEIFLatestPublishesURL = "https://goldencopy.gleif.org/api/v2/golden-copies/publishes/latest"

	// Data directory for downloaded files (relative to working directory)
	DefaultDataDirectory = "./data/lei"
)

var leiCodePattern = regexp.MustCompile(`^[0-9A-Z]{18}[0-9]{2}$`)

const distinctLookupCacheTTL = 5 * time.Minute

// GLEIFPublishesResponse represents the response from the GLEIF latest publishes endpoint
type GLEIFPublishesResponse struct {
	Data GLEIFPublishesData `json:"data"`
}

type GLEIFPublishesData struct {
	LEI2 GLEIFFileFormats `json:"lei2"`
}

type GLEIFFileFormats struct {
	Type        string               `json:"type"`
	PublishDate string               `json:"publish_date"`
	FullFile    GLEIFFileGroup       `json:"full_file"`
	DeltaFiles  GLEIFDeltaFileGroups `json:"delta_files"`
}

type GLEIFFileGroup struct {
	JSON GLEIFJSONFileInfo `json:"json"`
}

type GLEIFDeltaFileGroups struct {
	IntraDay  GLEIFFileGroup `json:"IntraDay"`
	LastDay   GLEIFFileGroup `json:"LastDay"`
	LastWeek  GLEIFFileGroup `json:"LastWeek"`
	LastMonth GLEIFFileGroup `json:"LastMonth"`
}

type GLEIFJSONFileInfo struct {
	URL         string `json:"url"`
	Size        int64  `json:"size"`
	RecordCount int    `json:"record_count"`
	PublishedAt string `json:"published_at"`
	DeltaType   string `json:"delta_type"`
}

// LEIService interface
type LEIService interface {
	// File download and management
	DownloadFullFile() (*domain.SourceFile, error)
	DownloadDeltaFile() (*domain.SourceFile, error)
	SourceFileExists(sourceFileID uuid.UUID) (bool, error)

	// File processing
	ProcessSourceFile(sourceFileID uuid.UUID) error
	ProcessSourceFileWithResume(sourceFileID uuid.UUID, resumeFromLEI string) error
	FindPendingSourceFiles() ([]*domain.SourceFile, error)
	FindRetryableFailedFiles() ([]*domain.SourceFile, error)
	ResetFailedFileForRetry(fileID uuid.UUID) error
	UpdateSourceFile(file *domain.SourceFile) error

	// Record management
	CreateLEIRecord(record *domain.LEIRecord) error
	GetLEIByCode(lei string) (*domain.LEIRecord, error)
	GetPredecessorLEIs(lei string) ([]*domain.LEIRecord, error)
	GetLEIByID(id string) (*domain.LEIRecord, error)
	GetAllLEI(limit, offset int) ([]*domain.LEIRecord, error)
	GetAllLEIWithFilters(limit, offset int, search, status, category, country, sortBy, sortOrder, columns string, includeLinkedNames bool) ([]*domain.LEIRecord, error)
	CountLEIRecords() (int64, error)
	GetDistinctCountries() ([]domain.Country, error)
	GetDistinctCategories() ([]string, error)
	GetDistinctRegions() ([]string, error)
	GetDistinctLegalForms() ([]string, error)
	GetLegalNamesByLEICodes(codes []string) (map[string]string, error)
	UpdateLEIRecord(record *domain.LEIRecord) error

	// Audit and history
	GetAuditHistory(lei string, limit int) ([]*domain.LEIRecordAudit, error)

	// Processing status
	GetProcessingStatus(jobType string) (*domain.FileProcessingStatus, error)
	UpdateProcessingStatus(status *domain.FileProcessingStatus) error

	// File cleanup
	CleanupOldFiles(keepFullFiles, keepDeltaFiles int) error
}

type leiService struct {
	repo        repository.LEIRepository
	countryRepo repository.CountryRepository
	dataDir     string // Directory to store downloaded files

	lookupCacheMu              sync.RWMutex
	distinctCategories         []string
	distinctCategoriesCachedAt time.Time
	distinctRegions            []string
	distinctRegionsCachedAt    time.Time
	distinctLegalForms         []string
	distinctLegalFormsCachedAt time.Time
}

// NewLEIService creates a new LEI service
func NewLEIService(repo repository.LEIRepository, countryRepo repository.CountryRepository, dataDir string) LEIService {
	return &leiService{
		repo:        repo,
		countryRepo: countryRepo,
		dataDir:     dataDir,
	}
}

func cloneStringSlice(values []string) []string {
	if len(values) == 0 {
		return []string{}
	}
	cloned := make([]string, len(values))
	copy(cloned, values)
	return cloned
}

func statusJobTypeFromFileType(fileType string) string {
	switch strings.ToUpper(strings.TrimSpace(fileType)) {
	case "FULL":
		return "DAILY_FULL"
	case "DELTA":
		return "DAILY_DELTA"
	default:
		return ""
	}
}

func (s *leiService) setProgressMessage(jobType, message string) {
	if strings.TrimSpace(jobType) == "" {
		return
	}

	status, err := s.GetProcessingStatus(jobType)
	if err != nil {
		log.Warn().Err(err).Str("job_type", jobType).Msg("Unable to set progress message: status not found")
		return
	}

	status.ProgressMessage = strings.TrimSpace(message)
	if err := s.UpdateProcessingStatus(status); err != nil {
		log.Warn().Err(err).Str("job_type", jobType).Msg("Unable to persist progress message")
	}
}

// progressWriter wraps an io.Writer to log extraction progress periodically
type progressWriter struct {
	writer      io.Writer
	written     int64
	total       int64
	fileName    string
	startTime   time.Time
	lastLog     time.Time
	logInterval time.Duration
}

func (pw *progressWriter) Write(p []byte) (int, error) {
	n, err := pw.writer.Write(p)
	pw.written += int64(n)

	// Log progress at intervals
	now := time.Now()
	if now.Sub(pw.lastLog) >= pw.logInterval {
		percentComplete := float64(pw.written) / float64(pw.total) * 100
		mbWritten := float64(pw.written) / (1024 * 1024)
		mbTotal := float64(pw.total) / (1024 * 1024)
		elapsed := now.Sub(pw.startTime).Seconds()
		mbPerSec := mbWritten / elapsed
		remainingMB := mbTotal - mbWritten
		estimatedSecondsRemaining := remainingMB / mbPerSec

		log.Info().
			Str("file", pw.fileName).
			Float64("percent_complete", percentComplete).
			Float64("mb_written", mbWritten).
			Float64("mb_total", mbTotal).
			Float64("mb_per_second", mbPerSec).
			Float64("estimated_seconds_remaining", estimatedSecondsRemaining).
			Msg("ZIP extraction progress")

		pw.lastLog = now
	}

	return n, err
}

// getLatestFileURLs fetches the latest file URLs from GLEIF API
func (s *leiService) getLatestFileURLs() (*GLEIFPublishesResponse, error) {
	log.Info().Str("url", GLEIFLatestPublishesURL).Msg("Fetching latest file URLs from GLEIF")

	resp, err := http.Get(GLEIFLatestPublishesURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch latest publishes: %w", err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			log.Error().Err(err).Msg("Failed to close response body")
		}
	}()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch latest publishes: HTTP %d", resp.StatusCode)
	}

	// Read the response body for debugging
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var publishesResp GLEIFPublishesResponse
	if err := json.Unmarshal(body, &publishesResp); err != nil {
		log.Error().Err(err).Str("body_preview", string(body[:500])).Msg("Failed to parse GLEIF API response")
		return nil, fmt.Errorf("failed to decode publishes response: %w", err)
	}

	// Debug: Log the parsed structure to verify unmarshaling
	fullURL := publishesResp.Data.LEI2.FullFile.JSON.URL
	deltaURL := publishesResp.Data.LEI2.DeltaFiles.LastWeek.JSON.URL

	log.Info().
		Str("full_url", fullURL).
		Int64("full_size", publishesResp.Data.LEI2.FullFile.JSON.Size).
		Int("full_records", publishesResp.Data.LEI2.FullFile.JSON.RecordCount).
		Str("delta_url", deltaURL).
		Int64("delta_size", publishesResp.Data.LEI2.DeltaFiles.LastWeek.JSON.Size).
		Int("delta_records", publishesResp.Data.LEI2.DeltaFiles.LastWeek.JSON.RecordCount).
		Msgf("Retrieved latest file information (full empty: %v, delta empty: %v)", fullURL == "", deltaURL == "")

	return &publishesResp, nil
}

// DownloadFullFile downloads the full LEI data file from GLEIF
func (s *leiService) DownloadFullFile() (*domain.SourceFile, error) {
	publishes, err := s.getLatestFileURLs()
	if err != nil {
		return nil, fmt.Errorf("failed to get latest file URLs: %w", err)
	}

	url := publishes.Data.LEI2.FullFile.JSON.URL
	publishedAt := publishes.Data.LEI2.PublishDate
	recordCount := publishes.Data.LEI2.FullFile.JSON.RecordCount
	return s.downloadFile(url, "FULL", publishedAt, recordCount)
}

// DownloadDeltaFile downloads the delta LEI data file from GLEIF
func (s *leiService) DownloadDeltaFile() (*domain.SourceFile, error) {
	publishes, err := s.getLatestFileURLs()
	if err != nil {
		return nil, fmt.Errorf("failed to get latest file URLs: %w", err)
	}

	url := publishes.Data.LEI2.DeltaFiles.LastWeek.JSON.URL
	publishedAt := publishes.Data.LEI2.PublishDate
	recordCount := publishes.Data.LEI2.DeltaFiles.LastWeek.JSON.RecordCount
	return s.downloadFile(url, "DELTA", publishedAt, recordCount)
}

// downloadFile downloads a file from GLEIF and creates a SourceFile record
func (s *leiService) downloadFile(url, fileType, publishedAt string, expectedRecordCount int) (*domain.SourceFile, error) {
	log.Info().Str("url", url).Str("type", fileType).Msg("Starting file download from GLEIF")
	jobType := statusJobTypeFromFileType(fileType)
	remoteFileName := filepath.Base(strings.TrimSpace(url))
	if remoteFileName == "." || remoteFileName == "" || remoteFileName == "/" {
		remoteFileName = "latest file"
	}
	s.setProgressMessage(jobType, fmt.Sprintf("Downloading %s", remoteFileName))

	// Create data directory if it doesn't exist
	if err := os.MkdirAll(s.dataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	// Download file
	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to download file: %w", err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			log.Error().Err(err).Msg("Failed to close response body")
		}
	}()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to download file: HTTP %d", resp.StatusCode)
	}

	// Generate filename with timestamp
	timestamp := time.Now().Format("20060102-150405")
	fileName := fmt.Sprintf("lei-%s-%s.json.zip", fileType, timestamp)
	filePath := filepath.Join(s.dataDir, fileName)

	// Create file
	out, err := os.Create(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to create file: %w", err)
	}
	defer func() {
		if err := out.Close(); err != nil {
			log.Error().Err(err).Msg("Failed to close output file")
		}
	}()

	// Calculate hash while downloading
	hash := sha256.New()
	multiWriter := io.MultiWriter(out, hash)

	// Copy data
	fileSize, err := io.Copy(multiWriter, resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to save file: %w", err)
	}

	fileHash := hex.EncodeToString(hash.Sum(nil))

	log.Info().
		Str("file", fileName).
		Int64("size", fileSize).
		Str("hash", fileHash).
		Msg("File downloaded successfully")
	s.setProgressMessage(jobType, fmt.Sprintf("Downloaded %s", fileName))

	// Check if we already have a completed file with this hash
	existingFile, err := s.repo.FindSourceFileByHash(fileHash)
	if err != nil {
		log.Error().Err(err).Str("hash", fileHash).Msg("Failed to check for duplicate file")
		// Continue anyway - better to process duplicate than fail
	} else if existingFile != nil {
		// Duplicate found - delete newly downloaded file and skip
		if err := os.Remove(filePath); err != nil {
			log.Error().Err(err).Str("file", filePath).Msg("Failed to remove duplicate file")
		}
		log.Info().
			Str("hash", fileHash).
			Str("existing_file", existingFile.FileName).
			Str("existing_id", existingFile.ID.String()).
			Time("existing_completed", *existingFile.ProcessingCompletedAt).
			Msg("Skipping duplicate file - already processed successfully")
		return nil, fmt.Errorf("duplicate file already processed: %s", existingFile.FileName)
	}

	// Parse publication date
	var publicationDate time.Time
	if publishedAt != "" {
		if t, err := time.Parse(time.RFC3339, publishedAt); err == nil {
			publicationDate = t
		} else {
			publicationDate = time.Now()
		}
	} else {
		publicationDate = time.Now()
	}

	// Create SourceFile record
	sourceFileJobType := domain.JobTypeFromFileType(fileType)
	sourceFile := &domain.SourceFile{
		FileName:         fileName,
		FileType:         fileType,
		JobType:          sourceFileJobType,
		JobLabel:         domain.JobTypeDisplayName(sourceFileJobType),
		FileURL:          url,
		FileSize:         fileSize,
		FileHash:         fileHash,
		DownloadedAt:     time.Now(),
		PublicationDate:  publicationDate,
		ProcessingStatus: "PENDING",
		TotalRecords:     expectedRecordCount,
	}

	if err := s.repo.CreateSourceFile(sourceFile); err != nil {
		return nil, fmt.Errorf("failed to create source file record: %w", err)
	}

	s.setProgressMessage(jobType, fmt.Sprintf("Extracting %s", fileName))

	return sourceFile, nil
}

// ProcessSourceFile processes a downloaded source file
func (s *leiService) ProcessSourceFile(sourceFileID uuid.UUID) error {
	return s.ProcessSourceFileWithResume(sourceFileID, "")
}

// ProcessSourceFileWithResume processes a source file, optionally resuming from a specific LEI
func (s *leiService) ProcessSourceFileWithResume(sourceFileID uuid.UUID, resumeFromLEI string) error {
	log.Info().Str("source_file_id", sourceFileID.String()).Str("resume_from", resumeFromLEI).Msg("Starting file processing")

	// Get source file
	sourceFile, err := s.repo.FindSourceFileByID(sourceFileID.String())
	if err != nil {
		return fmt.Errorf("failed to find source file: %w", err)
	}

	jobType := statusJobTypeFromFileType(sourceFile.FileType)
	s.setProgressMessage(jobType, fmt.Sprintf("Extracting %s", sourceFile.FileName))

	// Update status to IN_PROGRESS and clear any historical failure data
	sourceFile.ProcessingStatus = "IN_PROGRESS"
	startTime := time.Now()
	sourceFile.ProcessingStartedAt = &startTime
	// Clear historical failure data from previous attempts
	sourceFile.FailureCategory = ""
	sourceFile.ProcessingError = ""
	if err := s.repo.UpdateSourceFile(sourceFile); err != nil {
		return fmt.Errorf("failed to update source file status: %w", err)
	}

	// Extract and process file
	filePath := filepath.Join(s.dataDir, sourceFile.FileName)

	// Check if already extracted (from previous run)
	jsonPath := filePath + ".extracted.json"
	if _, err := os.Stat(jsonPath); os.IsNotExist(err) {
		// Extracted file doesn't exist, try to extract from zip
		log.Info().
			Str("source_file_id", sourceFileID.String()).
			Str("file_path", filePath).
			Msg("Extracted file not found, starting extraction from ZIP")

		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			sourceFile.ProcessingStatus = "FAILED"
			sourceFile.ProcessingError = fmt.Sprintf("source file not found: %s", filePath)
			sourceFile.FailureCategory = "FILE_MISSING"
			if err := s.repo.UpdateSourceFile(sourceFile); err != nil {
				log.Error().Err(err).Msg("Failed to update source file status")
			}
			return fmt.Errorf("source file not found: %s", filePath)
		}

		// Unzip file
		var extractErr error
		jsonPath, extractErr = s.extractZipFile(filePath)
		if extractErr != nil {
			sourceFile.ProcessingStatus = "FAILED"
			sourceFile.ProcessingError = extractErr.Error()
			sourceFile.FailureCategory = "FILE_CORRUPTION"
			if err := s.repo.UpdateSourceFile(sourceFile); err != nil {
				log.Error().Err(err).Msg("Failed to update source file status")
			}
			return fmt.Errorf("failed to extract file: %w", extractErr)
		}
		log.Info().Str("json_path", jsonPath).Msg("File extracted successfully")
		s.setProgressMessage(jobType, fmt.Sprintf("Processing records from %s", sourceFile.FileName))
	} else {
		log.Info().Str("json_path", jsonPath).Msg("Using previously extracted file")
		s.setProgressMessage(jobType, fmt.Sprintf("Processing records from %s", sourceFile.FileName))
	}
	defer func() {
		if err := os.Remove(jsonPath); err != nil {
			log.Error().Err(err).Str("file", jsonPath).Msg("Failed to remove extracted JSON file")
		}
	}() // Clean up extracted JSON

	// Parse and process JSON
	if err := s.processJSONFile(jsonPath, sourceFile, resumeFromLEI); err != nil {
		sourceFile.ProcessingStatus = "FAILED"
		sourceFile.ProcessingError = err.Error()

		// Categorize the failure for retry logic (defensive: ensure always set)
		errorMsg := err.Error()
		if strings.Contains(errorMsg, "column") && strings.Contains(errorMsg, "does not exist") {
			sourceFile.FailureCategory = "SCHEMA_ERROR"
		} else if strings.Contains(errorMsg, "value too long") {
			sourceFile.FailureCategory = "SCHEMA_ERROR"
		} else if strings.Contains(errorMsg, "connection") || strings.Contains(errorMsg, "timeout") {
			sourceFile.FailureCategory = "NETWORK_ERROR"
		} else if strings.Contains(errorMsg, "invalid JSON") || strings.Contains(errorMsg, "unexpected EOF") {
			sourceFile.FailureCategory = "FILE_CORRUPTION"
		} else {
			// Defensive: ensure category is always set for FAILED status
			sourceFile.FailureCategory = "UNKNOWN"
		}

		// Defensive check: ensure failure_category is never empty when status is FAILED
		if sourceFile.FailureCategory == "" {
			sourceFile.FailureCategory = "UNKNOWN"
		}

		log.Warn().
			Str("failure_category", sourceFile.FailureCategory).
			Int("retry_count", sourceFile.RetryCount).
			Int("max_retries", sourceFile.MaxRetries).
			Bool("can_retry", sourceFile.RetryCount < sourceFile.MaxRetries).
			Msg("File processing failed with categorized error")

		if err := s.repo.UpdateSourceFile(sourceFile); err != nil {
			log.Error().Err(err).Msg("Failed to update source file status")
		}
		return fmt.Errorf("failed to process JSON file: %w", err)
	}

	// Update status to COMPLETED and clear any failure fields from previous attempts
	sourceFile.ProcessingStatus = "COMPLETED"
	completedTime := time.Now()
	sourceFile.ProcessingCompletedAt = &completedTime
	sourceFile.FailureCategory = "" // Clear failure category from any previous failed attempts
	sourceFile.ProcessingError = "" // Clear error message from any previous failed attempts
	if err := s.repo.UpdateSourceFile(sourceFile); err != nil {
		return fmt.Errorf("failed to update source file status: %w", err)
	}

	log.Info().
		Str("source_file_id", sourceFileID.String()).
		Int("total", sourceFile.TotalRecords).
		Int("processed", sourceFile.ProcessedRecords).
		Int("failed", sourceFile.FailedRecords).
		Msg("File processing completed")

	return nil
}

// extractZipFile extracts the JSON file from a ZIP archive
func (s *leiService) extractZipFile(zipPath string) (string, error) {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return "", err
	}
	defer func() {
		if err := r.Close(); err != nil {
			log.Error().Err(err).Msg("Failed to close ZIP reader")
		}
	}()

	// Find the JSON file in the ZIP
	for _, f := range r.File {
		if filepath.Ext(f.Name) == ".json" || filepath.Ext(f.Name) == ".jsonl" {
			rc, err := f.Open()
			if err != nil {
				return "", err
			}
			defer func() {
				if err := rc.Close(); err != nil {
					log.Error().Err(err).Msg("Failed to close ZIP file entry")
				}
			}()

			// Create output file
			jsonPath := zipPath + ".extracted.json"
			outFile, err := os.Create(jsonPath)
			if err != nil {
				return "", err
			}
			defer func() {
				if err := outFile.Close(); err != nil {
					log.Error().Err(err).Msg("Failed to close output file")
				}
			}()

			// Log extraction start
			uncompressedSize := f.UncompressedSize64
			log.Info().
				Str("file", f.Name).
				Uint64("size_bytes", uncompressedSize).
				Float64("size_mb", float64(uncompressedSize)/(1024*1024)).
				Msg("Starting file extraction from ZIP")

			// Copy content with progress tracking
			startTime := time.Now()
			progressWriter := &progressWriter{
				writer:      outFile,
				total:       int64(uncompressedSize),
				fileName:    f.Name,
				startTime:   startTime,
				lastLog:     startTime,
				logInterval: 10 * time.Second, // Log every 10 seconds
			}
			written, err := io.Copy(progressWriter, rc)
			if err != nil {
				return "", err
			}
			elapsed := time.Since(startTime).Seconds()

			log.Info().
				Int64("bytes_written", written).
				Float64("mb_written", float64(written)/(1024*1024)).
				Float64("duration_seconds", elapsed).
				Float64("mb_per_second", float64(written)/(1024*1024)/elapsed).
				Msg("File extraction completed")

			return jsonPath, nil
		}
	}

	return "", fmt.Errorf("no JSON file found in ZIP archive")
}

// FindPendingSourceFiles finds all source files that are pending or in-progress
func (s *leiService) FindPendingSourceFiles() ([]*domain.SourceFile, error) {
	return s.repo.FindPendingSourceFiles()
}

// FindRetryableFailedFiles finds failed files that can be retried
func (s *leiService) FindRetryableFailedFiles() ([]*domain.SourceFile, error) {
	return s.repo.FindRetryableFailedFiles()
}

// ResetFailedFileForRetry resets a failed file to PENDING for retry
func (s *leiService) ResetFailedFileForRetry(fileID uuid.UUID) error {
	return s.repo.ResetFailedFileForRetry(fileID)
}

// UpdateSourceFile updates a source file record
func (s *leiService) UpdateSourceFile(file *domain.SourceFile) error {
	return s.repo.UpdateSourceFile(file)
}

// SourceFileExists checks whether the source file record exists and its file is present on disk
func (s *leiService) SourceFileExists(sourceFileID uuid.UUID) (bool, error) {
	sourceFile, err := s.repo.FindSourceFileByID(sourceFileID.String())
	if err != nil {
		return false, err
	}

	filePath := filepath.Join(s.dataDir, sourceFile.FileName)
	if _, err := os.Stat(filePath); err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

// processJSONFile parses and processes the LEI JSON file
// GLEIF JSON format: {"records": [ {...}, {...}, ... ]}
func (s *leiService) processJSONFile(jsonPath string, sourceFile *domain.SourceFile, resumeFromLEI string) error {
	// Get file size for progress tracking
	fileInfo, err := os.Stat(jsonPath)
	if err != nil {
		return err
	}
	fileSize := fileInfo.Size()

	log.Info().
		Str("file", jsonPath).
		Int64("size_bytes", fileSize).
		Float64("size_mb", float64(fileSize)/(1024*1024)).
		Str("source_file_id", sourceFile.ID.String()).
		Msg("Starting JSON file parsing")

	file, err := os.Open(jsonPath)
	if err != nil {
		return err
	}
	defer func() {
		if err := file.Close(); err != nil {
			log.Error().Err(err).Msg("Failed to close JSON file")
		}
	}()

	// Create a JSON decoder
	decoder := json.NewDecoder(file)

	// Read the opening brace
	token, err := decoder.Token()
	if err != nil {
		return fmt.Errorf("failed to read opening brace: %w", err)
	}
	if delim, ok := token.(json.Delim); !ok || delim != '{' {
		return fmt.Errorf("expected '{', got %v", token)
	}

	log.Info().
		Str("source_file_id", sourceFile.ID.String()).
		Msg("JSON structure validated, searching for records array")

	// Read until we find the "records" key
	for decoder.More() {
		token, err := decoder.Token()
		if err != nil {
			return fmt.Errorf("failed to read token: %w", err)
		}

		if key, ok := token.(string); ok && key == "records" {
			log.Info().
				Str("source_file_id", sourceFile.ID.String()).
				Msg("Found records array, starting record processing")
			// Found the records array, start processing
			return s.processRecordsArray(decoder, sourceFile, resumeFromLEI)
		}

		// Skip the value for non-records keys
		var skipValue interface{}
		if err := decoder.Decode(&skipValue); err != nil {
			return fmt.Errorf("failed to skip value: %w", err)
		}
	}

	return fmt.Errorf("records array not found in JSON file")
}

// processRecordsArray processes the records array from the JSON decoder using batch processing
func (s *leiService) processRecordsArray(decoder *json.Decoder, sourceFile *domain.SourceFile, resumeFromLEI string) (retErr error) {
	// Panic recovery to catch any unhandled errors
	defer func() {
		if r := recover(); r != nil {
			log.Error().Interface("panic", r).Str("source_file_id", sourceFile.ID.String()).Msg("PANIC in processRecordsArray")
			retErr = fmt.Errorf("panic during processing: %v", r)
		}
	}()

	// Read the opening bracket of the records array
	token, err := decoder.Token()
	if err != nil {
		return fmt.Errorf("failed to read array opening: %w", err)
	}
	if delim, ok := token.(json.Delim); !ok || delim != '[' {
		return fmt.Errorf("expected '[', got %v", token)
	}

	// Start counters based on whether we're resuming or starting fresh
	var scannedRecords int
	var processedRecords int
	var failedRecords int
	// DB write counters — derived from actual BatchUpsertLEIRecords results.
	// totalCreated: net-new rows inserted. totalUpdated: rows whose data changed and were written.
	// totalUnchanged: rows present in the batch whose existing DB values were identical (intentional no-op).
	var totalCreated int
	var totalUpdated int
	shouldProcess := resumeFromLEI == ""
	var lastProcessedLEI string

	// Track checkpoint value separately from session progress
	checkpointProcessed := 0

	// Only load existing progress if resuming an interrupted file
	// If starting fresh, reset all counters to avoid accumulation on reprocessing
	if resumeFromLEI != "" {
		// Resuming: initialize totalRecords at checkpoint to account for skipped records
		// processedRecords tracks only NEW records processed in this session
		checkpointProcessed = sourceFile.ProcessedRecords
		scannedRecords = sourceFile.ProcessedRecords // Start counting from checkpoint
		processedRecords = 0                         // Track only new records in this session
		failedRecords = sourceFile.FailedRecords
	} else {
		// Starting fresh: reset all counters
		scannedRecords = 0
		processedRecords = 0
		failedRecords = 0
	}

	progressTotalRecords := resolveProgressTotalRecords(sourceFile, scannedRecords)

	log.Info().
		Int("starting_total", scannedRecords).
		Int("expected_total", progressTotalRecords).
		Int("checkpoint_processed", checkpointProcessed).
		Int("session_processed", processedRecords).
		Int("starting_failed", failedRecords).
		Str("resume_from", resumeFromLEI).
		Bool("is_resume", resumeFromLEI != "").
		Msg("Starting array processing with counters")

	// Start heartbeat ticker for progress monitoring (every 15 seconds)
	heartbeatTicker := time.NewTicker(15 * time.Second)
	defer heartbeatTicker.Stop()
	lastHeartbeatTime := time.Now()
	lastHeartbeatProcessed := processedRecords

	// Goroutine for periodic heartbeat logging
	go func() {
		for range heartbeatTicker.C {
			elapsed := time.Since(lastHeartbeatTime).Seconds()
			recordsSinceLastHeartbeat := processedRecords - lastHeartbeatProcessed
			rate := float64(recordsSinceLastHeartbeat) / elapsed

			cumulativeProcessed := capProcessedRecords(progressTotalRecords, checkpointProcessed+processedRecords)
			remainingRecords := progressTotalRecords - cumulativeProcessed
			if remainingRecords < 0 {
				remainingRecords = 0
			}
			etaSeconds := 0.0
			if rate > 0 {
				etaSeconds = float64(remainingRecords) / rate
			}

			percentComplete := 0.0
			if progressTotalRecords > 0 {
				percentComplete = (float64(cumulativeProcessed) / float64(progressTotalRecords)) * 100
			}

			totalUnchanged := processedRecords - totalCreated - totalUpdated
			if totalUnchanged < 0 {
				totalUnchanged = 0
			}
			log.Info().
				Int("total_records", progressTotalRecords).
				Int("scanned_records", scannedRecords).
				Int("checkpoint_processed", checkpointProcessed).
				Int("session_processed", processedRecords).
				Int("cumulative_processed", cumulativeProcessed).
				Int("db_inserted", totalCreated).
				Int("db_updated", totalUpdated).
				Int("db_unchanged", totalUnchanged).
				Int("failed_records", failedRecords).
				Float64("percent_complete", percentComplete).
				Float64("records_per_sec", rate).
				Float64("eta_seconds", etaSeconds).
				Str("last_lei", lastProcessedLEI).
				Msg("HEARTBEAT: LEI import in progress")

			lastHeartbeatTime = time.Now()
			lastHeartbeatProcessed = processedRecords
		}
	}()

	const batchSize = 1000
	const sourceFileProgressCheckpointInterval = 5000
	batch := make([]*domain.LEIRecord, 0, batchSize)

	// flushBatch processes accumulated records using batch upsert
	flushBatch := func() error {
		if len(batch) == 0 {
			return nil
		}

		// Calculate progress for flush message
		cumulativeProcessed := capProcessedRecords(progressTotalRecords, checkpointProcessed+processedRecords)
		flushPercent := 0.0
		if progressTotalRecords > 0 {
			flushPercent = (float64(cumulativeProcessed) / float64(progressTotalRecords)) * 100
		}

		log.Info().
			Int("batch_size", len(batch)).
			Int("checkpoint_processed", checkpointProcessed).
			Int("session_processed", processedRecords).
			Int("cumulative_processed", cumulativeProcessed).
			Int("total_records", progressTotalRecords).
			Int("scanned_records", scannedRecords).
			Float64("percent_complete", flushPercent).
			Str("last_lei", lastProcessedLEI).
			Msg("Flushing batch to database")

		created, updated, err := s.repo.BatchUpsertLEIRecords(batch)
		if err != nil {
			log.Error().
				Err(err).
				Int("batch_size", len(batch)).
				Str("first_lei", batch[0].LEI).
				Str("last_lei", batch[len(batch)-1].LEI).
				Msg("CRITICAL: Failed to batch upsert LEI records")
			jobType := normalizeProcessingJobType(sourceFile.JobType)
			batchErr := fmt.Errorf("batch upsert of %d LEI records failed: %w", len(batch), err)
			s.recordProcessingFailure(jobType, &sourceFile.ID, "UPSERT", "", nil, batchErr)
			failedRecords += len(batch)
			// Return error to stop processing
			return fmt.Errorf("batch upsert failed: %w", err)
		} else {
			jobType := normalizeProcessingJobType(sourceFile.JobType)
			naturalKeys := make([]string, 0, len(batch))
			for _, r := range batch {
				naturalKeys = append(naturalKeys, r.LEI)
			}
			s.batchResolveOpenProcessingFailures(jobType, naturalKeys, &sourceFile.ID)

			// Accumulate actual DB write outcomes.
			totalCreated += created
			totalUpdated += updated

			// processedRecords counts records attempted against the DB (used for progress/ETA).
			processedRecords += len(batch)

			// Always keep LastProcessedLEI in sync so the mandatory final UpdateSourceFile
			// call reflects the actual last record, even for batches that do not hit a
			// checkpoint boundary (e.g. files smaller than sourceFileProgressCheckpointInterval).
			cumulativeProcessed = capProcessedRecords(progressTotalRecords, checkpointProcessed+processedRecords)
			sourceFile.LastProcessedLEI = normalizeLEICodePointer(lastProcessedLEI)
			if processedRecords%sourceFileProgressCheckpointInterval == 0 {
				sourceFile.TotalRecords = progressTotalRecords
				sourceFile.ProcessedRecords = cumulativeProcessed
				sourceFile.FailedRecords = failedRecords
				if err := s.repo.UpdateSourceFile(sourceFile); err != nil {
					log.Error().Err(err).Msg("Failed to update source file progress checkpoint")
				}
			}

			// Calculate progress percentage
			percentComplete := 0.0
			if progressTotalRecords > 0 {
				percentComplete = (float64(cumulativeProcessed) / float64(progressTotalRecords)) * 100
			}

			batchUnchanged := len(batch) - created - updated
			if batchUnchanged < 0 {
				batchUnchanged = 0
			}
			log.Info().
				Int("total_scanned", scannedRecords).
				Int("expected_total", progressTotalRecords).
				Int("cumulative_processed", cumulativeProcessed).
				Int("session_processed", processedRecords).
				Int("batch_inserted", created).
				Int("batch_updated", updated).
				Int("batch_unchanged", batchUnchanged).
				Int("total_inserted", totalCreated).
				Int("total_updated", totalUpdated).
				Int("failed", failedRecords).
				Float64("percent_complete", percentComplete).
				Str("last_lei", lastProcessedLEI).
				Msg("Batch processing progress")
		}

		// Clear batch for next iteration
		batch = make([]*domain.LEIRecord, 0, batchSize)
		return nil
	}

	// Process each record in the array
	recordCount := 0
	for decoder.More() {
		recordCount++
		var jsonRecord LEIJSONRecord
		if err := decoder.Decode(&jsonRecord); err != nil {
			jobType := normalizeProcessingJobType(sourceFile.JobType)
			if isTerminalJSONDecodeError(err) {
				log.Error().
					Err(err).
					Int("record_number", recordCount).
					Msg("Terminating LEI JSON processing due to malformed or truncated JSON payload")
				s.recordProcessingFailure(jobType, &sourceFile.ID, "DECODE", "", nil, err)
				return fmt.Errorf("terminal JSON decode error at record %d: %w", recordCount, err)
			}

			log.Error().
				Err(err).
				Int("record_number", recordCount).
				Msg("Failed to decode LEI JSON record")
			s.recordProcessingFailure(jobType, &sourceFile.ID, "DECODE", "", nil, err)
			failedRecords++
			continue
		}

		// Check if we should start processing (resume logic)
		if !shouldProcess {
			lei := s.extractLEI(&jsonRecord)
			if lei == resumeFromLEI {
				shouldProcess = true
				log.Info().
					Str("resume_lei", resumeFromLEI).
					Int("records_scanned_to_resume", recordCount).
					Msg("Found resume checkpoint, starting processing from next record")
				// Skip the checkpoint record itself (already processed)
				continue
			} else {
				// Scanning to find resume point - skip record
				// Don't increment totalRecords during skip phase (already counted in checkpoint)
				continue
			}
		}

		// Count records only after we start processing (or if not resuming)
		scannedRecords++

		// Convert JSON record to domain model
		record := s.jsonToDomainRecord(&jsonRecord, sourceFile.ID)
		if !isValidLEICode(record.LEI) {
			log.Error().
				Str("invalid_lei", record.LEI).
				Int("record_number", recordCount).
				Msg("Skipping record with invalid LEI code")
			s.recordProcessingFailure(normalizeProcessingJobType(sourceFile.JobType), &sourceFile.ID, "MAP", record.LEI, &jsonRecord, fmt.Errorf("invalid LEI code: %s", record.LEI))
			failedRecords++
			continue
		}

		lastProcessedLEI = record.LEI

		// Add to batch
		batch = append(batch, record)

		// Flush batch when it reaches batch size
		if len(batch) >= batchSize {
			if err := flushBatch(); err != nil {
				return err
			}
		}
	}

	// Flush any remaining records in the batch
	if err := flushBatch(); err != nil {
		return err
	}

	// Final update
	cumulativeProcessed := capProcessedRecords(progressTotalRecords, checkpointProcessed+processedRecords)
	sourceFile.TotalRecords = progressTotalRecords
	sourceFile.ProcessedRecords = cumulativeProcessed
	sourceFile.FailedRecords = failedRecords
	if err := s.repo.UpdateSourceFile(sourceFile); err != nil {
		log.Error().Err(err).Msg("Failed to update final source file status")
	}

	totalUnchanged := processedRecords - totalCreated - totalUpdated
	if totalUnchanged < 0 {
		totalUnchanged = 0
	}

	if processedRecords > 0 && totalCreated == 0 && totalUpdated == 0 && failedRecords == 0 {
		log.Warn().
			Int("scanned_records", scannedRecords).
			Int("session_processed", processedRecords).
			Int("db_inserted", totalCreated).
			Int("db_updated", totalUpdated).
			Int("db_unchanged", totalUnchanged).
			Msg("WARNING: processing reported success but zero DB writes occurred — all records may already be identical or a silent rollback may have happened")
	}

	log.Info().
		Int("total_records", progressTotalRecords).
		Int("scanned_records", scannedRecords).
		Int("checkpoint_processed", checkpointProcessed).
		Int("session_processed", processedRecords).
		Int("cumulative_processed", cumulativeProcessed).
		Int("db_inserted", totalCreated).
		Int("db_updated", totalUpdated).
		Int("db_unchanged", totalUnchanged).
		Int("total_failed", failedRecords).
		Msg("File processing completed")

	return nil
}

func normalizeLEICodePointer(value string) *string {
	normalized := normalizeLEICodeValue(value)
	if normalized == "" {
		return nil
	}
	return &normalized
}

func resolveProgressTotalRecords(sourceFile *domain.SourceFile, scannedRecords int) int {
	if sourceFile != nil && sourceFile.TotalRecords > 0 {
		return sourceFile.TotalRecords
	}

	return scannedRecords
}

func capProcessedRecords(totalRecords int, processedRecords int) int {
	if processedRecords < 0 {
		return 0
	}

	if totalRecords > 0 && processedRecords > totalRecords {
		return totalRecords
	}

	return processedRecords
}

func sanitizeSourceFileProgress(sourceFile *domain.SourceFile) {
	if sourceFile == nil {
		return
	}

	sourceFile.ProcessedRecords = capProcessedRecords(sourceFile.TotalRecords, sourceFile.ProcessedRecords)

	if sourceFile.FailedRecords < 0 {
		sourceFile.FailedRecords = 0
	}

	if sourceFile.FailedRecords > sourceFile.ProcessedRecords {
		sourceFile.FailedRecords = sourceFile.ProcessedRecords
	}
}

func (s *leiService) recordProcessingFailure(
	jobType string,
	sourceFileID *uuid.UUID,
	failureStage string,
	naturalKey string,
	rawRecord interface{},
	cause error,
) {
	persistProcessingFailure(
		s.repo,
		normalizeProcessingJobType(jobType),
		sourceFileID,
		failureStage,
		normalizeLEICodeValue(naturalKey),
		rawRecord,
		cause,
	)
}

func normalizeLEICodeValue(value string) string {
	normalized := strings.ToUpper(strings.TrimSpace(value))
	if normalized == "" || strings.EqualFold(normalized, "NULL") {
		return ""
	}

	return normalized
}

func isValidLEICode(value string) bool {
	return leiCodePattern.MatchString(value)
}

func leiCodeValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

// extractLEI extracts the LEI string from a JSON record (handles nested $ structure)
func (s *leiService) extractLEI(jsonRecord *LEIJSONRecord) string {
	return normalizeLEICodeValue(jsonRecord.LEI.Value)
}

// LEIJSONRecord represents the JSON structure from GLEIF bulk files
// NOTE: This is the BULK FILE FORMAT. The single LEI API query format is different.
// Bulk files use nested objects with $ properties for values.
// Single LEI queries return a different structure - implement separately if needed.
type LEIJSONRecord struct {
	LEI          LEIValueField   `json:"LEI"`
	Entity       LEIEntity       `json:"Entity"`
	Registration LEIRegistration `json:"Registration"`
}

// LEIValueField represents a simple value field with $ property
type LEIValueField struct {
	Value string `json:"$"`
}

type LEIEntity struct {
	LegalName                      LEILegalName             `json:"LegalName"`
	OtherEntityNames               LEIOtherEntityNames      `json:"OtherEntityNames"`
	TransliteratedOtherEntityNames LEIOtherEntityNames      `json:"TransliteratedOtherEntityNames"`
	LegalAddress                   LEIAddress               `json:"LegalAddress"`
	HeadquartersAddress            LEIAddress               `json:"HeadquartersAddress"`
	RegistrationAuthority          LEIRegistrationAuthority `json:"RegistrationAuthority"`
	LegalJurisdiction              LEIValueField            `json:"LegalJurisdiction"`
	EntityCategory                 LEIValueField            `json:"EntityCategory"`
	EntitySubCategory              LEIValueField            `json:"EntitySubCategory"`
	LegalForm                      LEILegalForm             `json:"LegalForm"`
	EntityStatus                   LEIValueField            `json:"EntityStatus"`
	SuccessorEntity                []LEISuccessorEntity     `json:"SuccessorEntity"`
}

type LEILegalName struct {
	Value    string `json:"$"`
	Language string `json:"@xml:lang"`
}

type LEIOtherEntityNames struct {
	OtherEntityName []LEIOtherName `json:"OtherEntityName"`
}

type LEIOtherName struct {
	Value    string `json:"$"`
	Type     string `json:"@type"`
	Language string `json:"@xml:lang"`
}

type LEIAddress struct {
	FirstAddressLine      LEIValueField   `json:"FirstAddressLine"`
	AdditionalAddressLine []LEIValueField `json:"AdditionalAddressLine"`
	City                  LEIValueField   `json:"City"`
	Region                LEIValueField   `json:"Region"`
	Country               LEIValueField   `json:"Country"`
	PostalCode            LEIValueField   `json:"PostalCode"`
	Language              string          `json:"@xml:lang"`
}

type LEIRegistrationAuthority struct {
	RegistrationAuthorityID       LEIValueField `json:"RegistrationAuthorityID"`
	RegistrationAuthorityEntityID LEIValueField `json:"RegistrationAuthorityEntityID"`
}

type LEILegalForm struct {
	EntityLegalFormCode LEIValueField `json:"EntityLegalFormCode"`
	OtherLegalForm      LEIValueField `json:"OtherLegalForm"`
}

type LEISuccessorEntity struct {
	SuccessorLEI LEIValueField `json:"SuccessorLEI"`
}

type LEIRegistration struct {
	InitialRegistrationDate LEIValueField          `json:"InitialRegistrationDate"`
	LastUpdateDate          LEIValueField          `json:"LastUpdateDate"`
	RegistrationStatus      LEIValueField          `json:"RegistrationStatus"`
	NextRenewalDate         LEIValueField          `json:"NextRenewalDate"`
	ManagingLOU             LEIValueField          `json:"ManagingLOU"`
	ValidationSources       LEIValueField          `json:"ValidationSources"`
	ValidationAuthority     LEIValidationAuthority `json:"ValidationAuthority"`
}

type LEIValidationAuthority struct {
	ValidationAuthorityID       LEIValueField `json:"ValidationAuthorityID"`
	ValidationAuthorityEntityID LEIValueField `json:"ValidationAuthorityEntityID"`
}

// parseGLEIFTimeValue parses GLEIF timestamp strings, handling both whole-second
// ("2026-04-09T10:21:26Z") and sub-second ("2026-04-09T10:21:26.360Z") variants.
// Returns the zero value of time.Time if the value cannot be parsed.
func parseGLEIFTimeValue(value string) time.Time {
	for _, layout := range []string{
		time.RFC3339Nano,       // "2006-01-02T15:04:05.999999999Z07:00"
		"2006-01-02T15:04:05Z", // exact UTC, no sub-seconds
		"2006-01-02",           // date-only
	} {
		if t, err := time.Parse(layout, value); err == nil {
			return t
		}
	}
	return time.Time{}
}

func normalizeNullLikeValue(value string) string {
	if strings.EqualFold(strings.TrimSpace(value), "null") {
		return ""
	}

	return value
}

func normalizeLEIRecordNullLikeFields(record *domain.LEIRecord) {
	if record == nil {
		return
	}

	record.TransliteratedLegalName = normalizeNullLikeValue(record.TransliteratedLegalName)
	record.LegalAddressLine1 = normalizeNullLikeValue(record.LegalAddressLine1)
	record.LegalAddressLine2 = normalizeNullLikeValue(record.LegalAddressLine2)
	record.LegalAddressLine3 = normalizeNullLikeValue(record.LegalAddressLine3)
	record.LegalAddressLine4 = normalizeNullLikeValue(record.LegalAddressLine4)
	record.LegalAddressCity = normalizeNullLikeValue(record.LegalAddressCity)
	record.LegalAddressRegion = normalizeNullLikeValue(record.LegalAddressRegion)
	record.LegalAddressCountry = normalizeNullLikeValue(record.LegalAddressCountry)
	record.LegalAddressPostalCode = normalizeNullLikeValue(record.LegalAddressPostalCode)
	record.HQAddressLine1 = normalizeNullLikeValue(record.HQAddressLine1)
	record.HQAddressLine2 = normalizeNullLikeValue(record.HQAddressLine2)
	record.HQAddressLine3 = normalizeNullLikeValue(record.HQAddressLine3)
	record.HQAddressLine4 = normalizeNullLikeValue(record.HQAddressLine4)
	record.HQAddressCity = normalizeNullLikeValue(record.HQAddressCity)
	record.HQAddressRegion = normalizeNullLikeValue(record.HQAddressRegion)
	record.HQAddressCountry = normalizeNullLikeValue(record.HQAddressCountry)
	record.HQAddressPostalCode = normalizeNullLikeValue(record.HQAddressPostalCode)
	record.RegistrationAuthority = normalizeNullLikeValue(record.RegistrationAuthority)
	record.RegistrationAuthorityID = normalizeNullLikeValue(record.RegistrationAuthorityID)
	record.RegistrationNumber = normalizeNullLikeValue(record.RegistrationNumber)
	record.EntityCategory = normalizeNullLikeValue(record.EntityCategory)
	record.EntitySubCategory = normalizeNullLikeValue(record.EntitySubCategory)
	record.EntityLegalForm = normalizeNullLikeValue(record.EntityLegalForm)
	record.EntityStatus = normalizeNullLikeValue(record.EntityStatus)
	record.LegalJurisdiction = normalizeNullLikeValue(record.LegalJurisdiction)
	record.RegistrationStatus = normalizeNullLikeValue(record.RegistrationStatus)
	record.ManagingLOU = normalizeNullLikeValue(record.ManagingLOU)
	record.SuccessorLEI = normalizeLEICodeValue(record.SuccessorLEI)
	if record.SuccessorLEI != "" && !isValidLEICode(record.SuccessorLEI) {
		record.SuccessorLEI = ""
	}
	record.ValidationAuthority = normalizeNullLikeValue(record.ValidationAuthority)
}

func validationSourcesToJSONB(value string) domain.JSONBString {
	normalized := normalizeNullLikeValue(value)
	if normalized == "" {
		return ""
	}

	encoded, err := json.Marshal(normalized)
	if err != nil {
		return ""
	}

	return domain.JSONBString(encoded)
}

// jsonToDomainRecord converts a JSON record to a domain.LEIRecord
func (s *leiService) jsonToDomainRecord(jsonRecord *LEIJSONRecord, sourceFileID uuid.UUID) *domain.LEIRecord {
	record := &domain.LEIRecord{
		LEI:                    normalizeLEICodeValue(jsonRecord.LEI.Value),
		LegalName:              jsonRecord.Entity.LegalName.Value,
		LegalAddressLine1:      jsonRecord.Entity.LegalAddress.FirstAddressLine.Value,
		LegalAddressCity:       jsonRecord.Entity.LegalAddress.City.Value,
		LegalAddressRegion:     jsonRecord.Entity.LegalAddress.Region.Value,
		LegalAddressCountry:    jsonRecord.Entity.LegalAddress.Country.Value,
		LegalAddressPostalCode: jsonRecord.Entity.LegalAddress.PostalCode.Value,
		RegistrationAuthority:  jsonRecord.Entity.RegistrationAuthority.RegistrationAuthorityID.Value,
		RegistrationNumber:     jsonRecord.Entity.RegistrationAuthority.RegistrationAuthorityEntityID.Value,
		EntityCategory:         jsonRecord.Entity.EntityCategory.Value,
		EntitySubCategory:      jsonRecord.Entity.EntitySubCategory.Value,
		EntityLegalForm:        jsonRecord.Entity.LegalForm.EntityLegalFormCode.Value,
		EntityStatus:           jsonRecord.Entity.EntityStatus.Value,
		LegalJurisdiction:      jsonRecord.Entity.LegalJurisdiction.Value,
		RegistrationStatus:     jsonRecord.Registration.RegistrationStatus.Value,
		ManagingLOU:            jsonRecord.Registration.ManagingLOU.Value,
		ValidationAuthority:    jsonRecord.Registration.ValidationAuthority.ValidationAuthorityID.Value,
		SourceFileID:           &sourceFileID,
		// Initialize JSONB fields with valid JSON
		OtherNames:        "[]",
		ValidationSources: validationSourcesToJSONB(jsonRecord.Registration.ValidationSources.Value),
		ChangedFields:     "{}",
	}

	// Extract SuccessorLEI from SuccessorEntity array (if present)
	// Some entities have multiple successors (array), others have single or none
	if len(jsonRecord.Entity.SuccessorEntity) > 0 && normalizeNullLikeValue(jsonRecord.Entity.SuccessorEntity[0].SuccessorLEI.Value) != "" {
		record.SuccessorLEI = normalizeLEICodeValue(jsonRecord.Entity.SuccessorEntity[0].SuccessorLEI.Value)
	}

	// Extract transliterated legal name from TransliteratedOtherEntityNames
	// Support both AUTO_ASCII_TRANSLITERATED_LEGAL_NAME and PREFERRED_ASCII_TRANSLITERATED_LEGAL_NAME
	for _, name := range jsonRecord.Entity.TransliteratedOtherEntityNames.OtherEntityName {
		if name.Type == "AUTO_ASCII_TRANSLITERATED_LEGAL_NAME" || name.Type == "PREFERRED_ASCII_TRANSLITERATED_LEGAL_NAME" {
			record.TransliteratedLegalName = name.Value
			break
		}
	}

	// Extract other entity names and serialize as JSON array
	if len(jsonRecord.Entity.OtherEntityNames.OtherEntityName) > 0 {
		otherNames := make([]map[string]string, 0, len(jsonRecord.Entity.OtherEntityNames.OtherEntityName))
		for _, name := range jsonRecord.Entity.OtherEntityNames.OtherEntityName {
			otherNames = append(otherNames, map[string]string{
				"name":     name.Value,
				"type":     name.Type,
				"language": name.Language,
			})
		}
		if otherNamesJSON, err := json.Marshal(otherNames); err == nil {
			record.OtherNames = domain.JSONBString(otherNamesJSON)
		} else {
			log.Warn().Err(err).Str("lei", record.LEI).Msg("Failed to marshal other names to JSON")
		}
	}

	// Handle additional address lines
	if len(jsonRecord.Entity.LegalAddress.AdditionalAddressLine) > 0 {
		record.LegalAddressLine2 = jsonRecord.Entity.LegalAddress.AdditionalAddressLine[0].Value
	}
	if len(jsonRecord.Entity.LegalAddress.AdditionalAddressLine) > 1 {
		record.LegalAddressLine3 = jsonRecord.Entity.LegalAddress.AdditionalAddressLine[1].Value
	}
	if len(jsonRecord.Entity.LegalAddress.AdditionalAddressLine) > 2 {
		record.LegalAddressLine4 = jsonRecord.Entity.LegalAddress.AdditionalAddressLine[2].Value
	}

	// Handle headquarters address
	if jsonRecord.Entity.HeadquartersAddress.FirstAddressLine.Value != "" {
		record.HQAddressLine1 = jsonRecord.Entity.HeadquartersAddress.FirstAddressLine.Value
		record.HQAddressCity = jsonRecord.Entity.HeadquartersAddress.City.Value
		record.HQAddressRegion = jsonRecord.Entity.HeadquartersAddress.Region.Value
		record.HQAddressCountry = jsonRecord.Entity.HeadquartersAddress.Country.Value
		record.HQAddressPostalCode = jsonRecord.Entity.HeadquartersAddress.PostalCode.Value

		if len(jsonRecord.Entity.HeadquartersAddress.AdditionalAddressLine) > 0 {
			record.HQAddressLine2 = jsonRecord.Entity.HeadquartersAddress.AdditionalAddressLine[0].Value
		}
		if len(jsonRecord.Entity.HeadquartersAddress.AdditionalAddressLine) > 1 {
			record.HQAddressLine3 = jsonRecord.Entity.HeadquartersAddress.AdditionalAddressLine[1].Value
		}
		if len(jsonRecord.Entity.HeadquartersAddress.AdditionalAddressLine) > 2 {
			record.HQAddressLine4 = jsonRecord.Entity.HeadquartersAddress.AdditionalAddressLine[2].Value
		}
	}

	// Parse dates (ISO 8601 format)
	if jsonRecord.Registration.InitialRegistrationDate.Value != "" {
		record.InitialRegistrationDate = parseGLEIFTimeValue(jsonRecord.Registration.InitialRegistrationDate.Value)
	}
	if jsonRecord.Registration.LastUpdateDate.Value != "" {
		record.LastUpdateDate = parseGLEIFTimeValue(jsonRecord.Registration.LastUpdateDate.Value)
	}
	if jsonRecord.Registration.NextRenewalDate.Value != "" {
		record.NextRenewalDate = parseGLEIFTimeValue(jsonRecord.Registration.NextRenewalDate.Value)
	}

	normalizeLEIRecordNullLikeFields(record)

	return record
}

// CreateLEIRecord creates a new LEI record
func (s *leiService) CreateLEIRecord(record *domain.LEIRecord) error {
	return s.repo.CreateLEIRecord(record)
}

// GetLEIByCode retrieves an LEI record by LEI code
func (s *leiService) GetLEIByCode(lei string) (*domain.LEIRecord, error) {
	normalizedLEI := strings.ToUpper(strings.TrimSpace(lei))
	record, err := s.repo.FindLEIByLEI(normalizedLEI)
	if err != nil {
		return nil, err
	}

	normalizeLEIRecordNullLikeFields(record)

	return record, nil
}

// GetPredecessorLEIs retrieves LEI records that reference the provided LEI as successor.
func (s *leiService) GetPredecessorLEIs(lei string) ([]*domain.LEIRecord, error) {
	records, err := s.repo.FindPredecessorLEIsBySuccessor(lei)
	if err != nil {
		return nil, err
	}

	for _, record := range records {
		normalizeLEIRecordNullLikeFields(record)
	}

	return records, nil
}

// GetLEIByID retrieves an LEI record by ID
func (s *leiService) GetLEIByID(id string) (*domain.LEIRecord, error) {
	record, err := s.repo.FindLEIByID(id)
	if err != nil {
		return nil, err
	}

	normalizeLEIRecordNullLikeFields(record)

	return record, nil
}

// GetAllLEI retrieves all LEI records with pagination
func (s *leiService) GetAllLEI(limit, offset int) ([]*domain.LEIRecord, error) {
	records, err := s.repo.FindAllLEI(limit, offset)
	if err != nil {
		return nil, err
	}

	for _, record := range records {
		normalizeLEIRecordNullLikeFields(record)
	}

	return records, nil
}

// GetAllLEIWithFilters retrieves LEI records with search and filters
func (s *leiService) GetAllLEIWithFilters(limit, offset int, search, status, category, country, sortBy, sortOrder, columns string, includeLinkedNames bool) ([]*domain.LEIRecord, error) {
	records, err := s.repo.FindAllLEIWithFilters(limit, offset, search, status, category, country, sortBy, sortOrder, columns, includeLinkedNames)
	if err != nil {
		return nil, err
	}

	for _, record := range records {
		normalizeLEIRecordNullLikeFields(record)
	}

	return records, nil
}

// CountLEIRecords returns the total count of LEI records
func (s *leiService) CountLEIRecords() (int64, error) {
	return s.repo.CountLEIRecords()
}

// GetLegalNamesByLEICodes returns a map of LEI code → legal name for a batch of codes.
// Codes not found in the database are simply absent from the returned map.
func (s *leiService) GetLegalNamesByLEICodes(codes []string) (map[string]string, error) {
	return s.repo.FindLegalNamesByLEICodes(codes)
}

// GetDistinctCountries returns a sorted list of active countries from the countries reference table
func (s *leiService) GetDistinctCountries() ([]domain.Country, error) {
	// Fetch all countries from master data table (more efficient than DISTINCT on LEI records)
	countries, err := s.countryRepo.FindAll(1000, 0)
	if err != nil {
		return nil, err
	}

	// Filter to active countries only
	activeCountries := make([]domain.Country, 0, len(countries))
	for _, country := range countries {
		if country.Active {
			activeCountries = append(activeCountries, *country)
		}
	}

	return activeCountries, nil
}

// GetDistinctCategories returns a sorted list of unique category values from LEI records
func (s *leiService) GetDistinctCategories() ([]string, error) {
	now := time.Now()

	s.lookupCacheMu.RLock()
	if !s.distinctCategoriesCachedAt.IsZero() && now.Sub(s.distinctCategoriesCachedAt) < distinctLookupCacheTTL {
		cached := cloneStringSlice(s.distinctCategories)
		s.lookupCacheMu.RUnlock()
		return cached, nil
	}
	s.lookupCacheMu.RUnlock()

	categories, err := s.repo.GetDistinctCategories()
	if err != nil {
		return nil, err
	}

	s.lookupCacheMu.Lock()
	s.distinctCategories = cloneStringSlice(categories)
	s.distinctCategoriesCachedAt = now
	s.lookupCacheMu.Unlock()

	return categories, nil
}

// GetDistinctRegions returns a sorted list of unique region values from LEI records
func (s *leiService) GetDistinctRegions() ([]string, error) {
	now := time.Now()

	s.lookupCacheMu.RLock()
	if !s.distinctRegionsCachedAt.IsZero() && now.Sub(s.distinctRegionsCachedAt) < distinctLookupCacheTTL {
		cached := cloneStringSlice(s.distinctRegions)
		s.lookupCacheMu.RUnlock()
		return cached, nil
	}
	s.lookupCacheMu.RUnlock()

	regions, err := s.repo.GetDistinctRegions()
	if err != nil {
		return nil, err
	}

	s.lookupCacheMu.Lock()
	s.distinctRegions = cloneStringSlice(regions)
	s.distinctRegionsCachedAt = now
	s.lookupCacheMu.Unlock()

	return regions, nil
}

// GetDistinctLegalForms returns a sorted list of unique legal form values from LEI records
func (s *leiService) GetDistinctLegalForms() ([]string, error) {
	now := time.Now()

	s.lookupCacheMu.RLock()
	if !s.distinctLegalFormsCachedAt.IsZero() && now.Sub(s.distinctLegalFormsCachedAt) < distinctLookupCacheTTL {
		cached := cloneStringSlice(s.distinctLegalForms)
		s.lookupCacheMu.RUnlock()
		return cached, nil
	}
	s.lookupCacheMu.RUnlock()

	legalForms, err := s.repo.GetDistinctLegalForms()
	if err != nil {
		return nil, err
	}

	s.lookupCacheMu.Lock()
	s.distinctLegalForms = cloneStringSlice(legalForms)
	s.distinctLegalFormsCachedAt = now
	s.lookupCacheMu.Unlock()

	return legalForms, nil
}

// UpdateLEIRecord updates an LEI record
func (s *leiService) UpdateLEIRecord(record *domain.LEIRecord) error {
	return s.repo.UpdateLEIRecord(record)
}

// GetAuditHistory retrieves audit history for an LEI
func (s *leiService) GetAuditHistory(lei string, limit int) ([]*domain.LEIRecordAudit, error) {
	return s.repo.FindAuditHistoryByLEI(lei, limit)
}

// GetProcessingStatus retrieves processing status for a job type
func (s *leiService) GetProcessingStatus(jobType string) (*domain.FileProcessingStatus, error) {
	status, err := s.repo.FindProcessingStatus(jobType)
	if err != nil {
		return nil, err
	}

	if status != nil && status.CurrentSourceFile != nil {
		sanitizeSourceFileProgress(status.CurrentSourceFile)
	}

	return status, nil
}

// UpdateProcessingStatus updates processing status
func (s *leiService) UpdateProcessingStatus(status *domain.FileProcessingStatus) error {
	if status != nil {
		if status.JobType != "" {
			status.JobLabel = domain.JobTypeDisplayName(status.JobType)
		}
		if status.DependsOnJobType != "" {
			status.DependsOnJobLabel = domain.JobTypeDisplayName(status.DependsOnJobType)
		} else {
			status.DependsOnJobLabel = ""
		}
		if status.CurrentSourceFileID == nil {
			status.CurrentSourceFile = nil
		}
		// GLEIF_REFERENCE_SYNC uses ProgressMessage as a post-completion stats summary (JSON),
		// so preserve it regardless of status. All other jobs only need ProgressMessage while RUNNING.
		if status.Status != "RUNNING" && status.JobType != "GLEIF_REFERENCE_SYNC" {
			status.ProgressMessage = ""
		}
	}
	return s.repo.UpdateProcessingStatus(status)
}

// CleanupOldFiles removes old LEI files to free disk space
// Keeps the most recent N full files and N delta files
func (s *leiService) CleanupOldFiles(keepFullFiles, keepDeltaFiles int) error {
	log.Info().
		Int("keep_full", keepFullFiles).
		Int("keep_delta", keepDeltaFiles).
		Msg("Starting LEI file cleanup")

	// Read all files in data directory
	files, err := os.ReadDir(s.dataDir)
	if err != nil {
		return fmt.Errorf("failed to read data directory: %w", err)
	}

	// Separate files by type
	var fullFiles, deltaFiles []os.DirEntry
	for _, file := range files {
		if file.IsDir() {
			continue
		}
		name := file.Name()
		if strings.Contains(name, "FULL") {
			fullFiles = append(fullFiles, file)
		} else if strings.Contains(name, "DELTA") {
			deltaFiles = append(deltaFiles, file)
		}
	}

	// Sort by modification time (newest first)
	sortByModTimeDesc := func(files []os.DirEntry) {
		sort.Slice(files, func(i, j int) bool {
			infoI, _ := files[i].Info()
			infoJ, _ := files[j].Info()
			return infoI.ModTime().After(infoJ.ModTime())
		})
	}

	sortByModTimeDesc(fullFiles)
	sortByModTimeDesc(deltaFiles)

	// Remove old full files
	removedCount := 0
	var totalSize int64

	for i, file := range fullFiles {
		if i < keepFullFiles {
			continue // Keep recent files
		}
		filePath := filepath.Join(s.dataDir, file.Name())
		info, err := file.Info()
		if err != nil {
			log.Warn().Err(err).Str("file", file.Name()).Msg("Failed to get file info")
			continue
		}
		if err := os.Remove(filePath); err != nil {
			log.Warn().Err(err).Str("file", file.Name()).Msg("Failed to remove old file")
		} else {
			log.Info().
				Str("file", file.Name()).
				Int64("size_mb", info.Size()/1024/1024).
				Msg("Removed old full file")
			removedCount++
			totalSize += info.Size()
		}
	}

	// Remove old delta files
	for i, file := range deltaFiles {
		if i < keepDeltaFiles {
			continue // Keep recent files
		}
		filePath := filepath.Join(s.dataDir, file.Name())
		info, err := file.Info()
		if err != nil {
			log.Warn().Err(err).Str("file", file.Name()).Msg("Failed to get file info")
			continue
		}
		if err := os.Remove(filePath); err != nil {
			log.Warn().Err(err).Str("file", file.Name()).Msg("Failed to remove old file")
		} else {
			log.Info().
				Str("file", file.Name()).
				Int64("size_mb", info.Size()/1024/1024).
				Msg("Removed old delta file")
			removedCount++
			totalSize += info.Size()
		}
	}

	log.Info().
		Int("removed_count", removedCount).
		Int64("freed_mb", totalSize/1024/1024).
		Int("full_remaining", len(fullFiles)-removedCount).
		Int("delta_remaining", len(deltaFiles)).
		Msg("Cleanup completed successfully")

	return nil
}
