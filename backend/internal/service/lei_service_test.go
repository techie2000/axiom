package service

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/repository"
)

// stubLEIRepo is a minimal LEIRepository stub for unit testing.
// Only BatchUpsertLEIRecords and UpdateSourceFile are exercised by processRecordsArray.
type stubLEIRepo struct {
	batchErr           error
	updateSourceFileFn func(file *domain.SourceFile)
	updateCalls        []*domain.SourceFile // snapshots of sourceFile at each UpdateSourceFile call
}

func (r *stubLEIRepo) BatchUpsertLEIRecords(records []*domain.LEIRecord) (int, int, error) {
	if r.batchErr != nil {
		return 0, 0, r.batchErr
	}
	return len(records), 0, nil
}

func (r *stubLEIRepo) UpdateSourceFile(file *domain.SourceFile) error {
	cp := *file
	r.updateCalls = append(r.updateCalls, &cp)
	if r.updateSourceFileFn != nil {
		r.updateSourceFileFn(file)
	}
	return nil
}

// Remaining interface methods – all no-ops required to satisfy repository.LEIRepository.
func (r *stubLEIRepo) CreateLEIRecord(*domain.LEIRecord) error                                    { return nil }
func (r *stubLEIRepo) FindLEIByLEI(string) (*domain.LEIRecord, error)                             { return nil, nil }
func (r *stubLEIRepo) FindLEIByID(string) (*domain.LEIRecord, error)                              { return nil, nil }
func (r *stubLEIRepo) FindAllLEI(int, int) ([]*domain.LEIRecord, error)                           { return nil, nil }
func (r *stubLEIRepo) FindAllLEIWithFilters(int, int, string, string, string, string, string, string, string) ([]*domain.LEIRecord, error) {
	return nil, nil
}
func (r *stubLEIRepo) CountLEIRecords() (int64, error)                              { return 0, nil }
func (r *stubLEIRepo) GetDistinctCountries() ([]string, error)                      { return nil, nil }
func (r *stubLEIRepo) GetDistinctRegions() ([]string, error)                        { return nil, nil }
func (r *stubLEIRepo) GetDistinctLegalForms() ([]string, error)                     { return nil, nil }
func (r *stubLEIRepo) UpdateLEIRecord(*domain.LEIRecord) error                      { return nil }
func (r *stubLEIRepo) UpsertLEIRecord(*domain.LEIRecord) (bool, error)              { return false, nil }
func (r *stubLEIRepo) DeleteLEI(string) error                                       { return nil }
func (r *stubLEIRepo) CreateSourceFile(*domain.SourceFile) error                    { return nil }
func (r *stubLEIRepo) FindSourceFileByID(string) (*domain.SourceFile, error)        { return nil, nil }
func (r *stubLEIRepo) FindSourceFileByHash(string) (*domain.SourceFile, error)      { return nil, nil }
func (r *stubLEIRepo) FindLatestSourceFile(string) (*domain.SourceFile, error)      { return nil, nil }
func (r *stubLEIRepo) FindPendingSourceFiles() ([]*domain.SourceFile, error)        { return nil, nil }
func (r *stubLEIRepo) FindRetryableFailedFiles() ([]*domain.SourceFile, error)      { return nil, nil }
func (r *stubLEIRepo) ResetFailedFileForRetry(uuid.UUID) error                      { return nil }
func (r *stubLEIRepo) FindProcessingStatus(string) (*domain.FileProcessingStatus, error) {
	return nil, nil
}
func (r *stubLEIRepo) UpdateProcessingStatus(*domain.FileProcessingStatus) error { return nil }
func (r *stubLEIRepo) CreateAuditRecord(*domain.LEIRecordAudit) error            { return nil }
func (r *stubLEIRepo) FindAuditHistoryByLEI(string, int) ([]*domain.LEIRecordAudit, error) {
	return nil, nil
}

var _ repository.LEIRepository = (*stubLEIRepo)(nil) // compile-time interface check

// makeTestLEIArrayJSON builds a JSON array of n minimal valid LEI records,
// ready for a json.Decoder positioned at the start of the array.
// Generated LEI codes follow the pattern 5493001KJTIIG<5-digit-index>12 (20 chars, valid pattern).
func makeTestLEIArrayJSON(n int) *strings.Reader {
	var buf bytes.Buffer
	buf.WriteByte('[')
	for i := 0; i < n; i++ {
		if i > 0 {
			buf.WriteByte(',')
		}
		lei := fmt.Sprintf("5493001KJTIIG%05d12", i)
		fmt.Fprintf(&buf, `{"LEI":{"$":%q},"Entity":{"LegalName":{"$":"Entity %d"},"EntityStatus":{"$":"ACTIVE"}},"Registration":{"ManagingLOU":{"$":"5493001KJTIIGC8Y1R12"}}}`, lei, i)
	}
	buf.WriteByte(']')
	return strings.NewReader(buf.String())
}

// newTestSourceFile returns a minimal SourceFile suitable for processRecordsArray tests.
func newTestSourceFile() *domain.SourceFile {
	now := time.Now()
	return &domain.SourceFile{
		ID:              uuid.New(),
		FileName:        "test.json",
		FileType:        "FULL",
		FileURL:         "http://example.com/test.json",
		ProcessingStatus: "IN_PROGRESS",
		ProcessingStartedAt: &now,
	}
}

func TestIsTerminalJSONDecodeError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{name: "nil error", err: nil, want: false},
		{name: "io eof", err: io.EOF, want: true},
		{name: "io unexpected eof", err: io.ErrUnexpectedEOF, want: true},
		{name: "wrapped unexpected eof", err: errors.New("decode failure: unexpected EOF"), want: true},
		{name: "other decode error", err: errors.New("invalid character 'x' looking for beginning of value"), want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isTerminalJSONDecodeError(tt.err)
			if got != tt.want {
				t.Fatalf("expected %v, got %v", tt.want, got)
			}
		})
	}
}

func TestNormalizeLEIRecordNullLikeFields(t *testing.T) {
	record := &domain.LEIRecord{
		EntityStatus:            "NULL",
		EntityCategory:          " null ",
		TransliteratedLegalName: "null",
		SuccessorLEI:            "NULL",
		ManagingLOU:             "5493001KJTIIGC8Y1R12",
		LegalAddressCity:        "Lagos",
	}

	normalizeLEIRecordNullLikeFields(record)

	if record.EntityStatus != "" {
		t.Fatalf("expected EntityStatus to be normalized to empty string, got %q", record.EntityStatus)
	}
	if record.EntityCategory != "" {
		t.Fatalf("expected EntityCategory to be normalized to empty string, got %q", record.EntityCategory)
	}
	if record.TransliteratedLegalName != "" {
		t.Fatalf("expected TransliteratedLegalName to be normalized to empty string, got %q", record.TransliteratedLegalName)
	}
	if record.SuccessorLEI != "" {
		t.Fatalf("expected SuccessorLEI to be normalized to empty string, got %q", record.SuccessorLEI)
	}
	if record.ManagingLOU != "5493001KJTIIGC8Y1R12" {
		t.Fatalf("expected ManagingLOU to remain unchanged, got %q", record.ManagingLOU)
	}
	if record.LegalAddressCity != "Lagos" {
		t.Fatalf("expected LegalAddressCity to remain unchanged, got %q", record.LegalAddressCity)
	}
}

func TestJSONToDomainRecord_NormalizesNullLikeFields(t *testing.T) {
	svc := &leiService{}
	sourceFileID := uuid.New()

	jsonRecord := &LEIJSONRecord{
		LEI: LEIValueField{Value: " 5493001kjtiigc8y1r12 "},
		Entity: LEIEntity{
			LegalName:       LEILegalName{Value: "Example Entity"},
			EntityStatus:    LEIValueField{Value: "NULL"},
			EntityCategory:  LEIValueField{Value: "null"},
			LegalAddress:    LEIAddress{FirstAddressLine: LEIValueField{Value: "NULL"}, City: LEIValueField{Value: "Lagos"}, Country: LEIValueField{Value: "NG"}},
			SuccessorEntity: []LEISuccessorEntity{{SuccessorLEI: LEIValueField{Value: " 5493001kjtiigc8y1r12 "}}},
		},
		Registration: LEIRegistration{
			ManagingLOU: LEIValueField{Value: "NULL"},
		},
	}

	record := svc.jsonToDomainRecord(jsonRecord, sourceFileID)

	if record.LEI != "5493001KJTIIGC8Y1R12" {
		t.Fatalf("expected LEI to be normalized to uppercase trimmed value, got %q", record.LEI)
	}

	if record.EntityStatus != "" {
		t.Fatalf("expected EntityStatus to be normalized to empty string, got %q", record.EntityStatus)
	}
	if record.EntityCategory != "" {
		t.Fatalf("expected EntityCategory to be normalized to empty string, got %q", record.EntityCategory)
	}
	if record.ManagingLOU != "" {
		t.Fatalf("expected ManagingLOU to be normalized to empty string, got %q", record.ManagingLOU)
	}
	if record.SuccessorLEI != "5493001KJTIIGC8Y1R12" {
		t.Fatalf("expected SuccessorLEI to be normalized to uppercase trimmed value, got %q", record.SuccessorLEI)
	}
	if record.LegalAddressLine1 != "" {
		t.Fatalf("expected LegalAddressLine1 to be normalized to empty string, got %q", record.LegalAddressLine1)
	}
	if record.LegalAddressCity != "Lagos" {
		t.Fatalf("expected LegalAddressCity to remain unchanged, got %q", record.LegalAddressCity)
	}
}

func TestNormalizeLEIRecordNullLikeFields_InvalidSuccessorLEIBecomesEmpty(t *testing.T) {
	record := &domain.LEIRecord{
		SuccessorLEI: "INVALID_SUCCESSOR",
	}

	normalizeLEIRecordNullLikeFields(record)

	if record.SuccessorLEI != "" {
		t.Fatalf("expected invalid SuccessorLEI to be cleared, got %q", record.SuccessorLEI)
	}
}

func TestNormalizeLEICodeValue(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "empty", input: "", want: ""},
		{name: "null-like", input: " null ", want: ""},
		{name: "valid mixed-case with spaces", input: " 5493001kjtiigc8y1r12 ", want: "5493001KJTIIGC8Y1R12"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := normalizeLEICodeValue(tt.input)
			if got != tt.want {
				t.Fatalf("expected %q, got %q", tt.want, got)
			}
		})
	}
}

func TestIsValidLEICode(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  bool
	}{
		{name: "valid code", input: "5493001KJTIIGC8Y1R12", want: true},
		{name: "empty", input: "", want: false},
		{name: "short", input: "5493001KJTIIGC8Y1R1", want: false},
		{name: "invalid suffix", input: "5493001KJTIIGC8Y1RXX", want: false},
		{name: "lowercase invalid", input: "5493001kjtiigc8y1r12", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isValidLEICode(tt.input)
			if got != tt.want {
				t.Fatalf("expected %v, got %v", tt.want, got)
			}
		})
	}
}

func TestNormalizeLEICodePointer(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		wantNil   bool
		wantValue string
	}{
		{name: "empty string", input: "", wantNil: true},
		{name: "whitespace only", input: "   ", wantNil: true},
		{name: "valid mixed case", input: "5493001kjtiigc8y1r12", wantNil: false, wantValue: "5493001KJTIIGC8Y1R12"},
		{name: "valid with surrounding spaces", input: "  5493001KJTIIGC8Y1R12  ", wantNil: false, wantValue: "5493001KJTIIGC8Y1R12"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := normalizeLEICodePointer(tt.input)
			if tt.wantNil {
				if got != nil {
					t.Fatalf("expected nil, got %q", *got)
				}
				return
			}

			if got == nil {
				t.Fatalf("expected non-nil pointer, got nil")
			}

			if *got != tt.wantValue {
				t.Fatalf("expected %q, got %q", tt.wantValue, *got)
			}
		})
	}
}

func TestLEICodeValue(t *testing.T) {
	if got := leiCodeValue(nil); got != "" {
		t.Fatalf("expected empty string for nil pointer, got %q", got)
	}

	value := "5493001KJTIIGC8Y1R12"
	if got := leiCodeValue(&value); got != value {
		t.Fatalf("expected %q, got %q", value, got)
	}
}

func TestResolveProgressTotalRecords(t *testing.T) {
	tests := []struct {
		name          string
		sourceFile    *domain.SourceFile
		scanned       int
		expectedTotal int
	}{
		{
			name:          "uses source file total when available",
			sourceFile:    &domain.SourceFile{TotalRecords: 3211232},
			scanned:       10000,
			expectedTotal: 3211232,
		},
		{
			name:          "falls back to scanned when source total missing",
			sourceFile:    &domain.SourceFile{TotalRecords: 0},
			scanned:       10000,
			expectedTotal: 10000,
		},
		{
			name:          "falls back to scanned when source file nil",
			sourceFile:    nil,
			scanned:       500,
			expectedTotal: 500,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := resolveProgressTotalRecords(tt.sourceFile, tt.scanned)
			if got != tt.expectedTotal {
				t.Fatalf("expected %d, got %d", tt.expectedTotal, got)
			}
		})
	}
}

func TestCapProcessedRecords(t *testing.T) {
	tests := []struct {
		name      string
		total     int
		processed int
		expected  int
	}{
		{name: "keeps processed when within total", total: 100, processed: 80, expected: 80},
		{name: "caps processed at total", total: 100, processed: 190, expected: 100},
		{name: "allows processed when total unknown", total: 0, processed: 190, expected: 190},
		{name: "normalizes negative processed", total: 100, processed: -1, expected: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := capProcessedRecords(tt.total, tt.processed)
			if got != tt.expected {
				t.Fatalf("expected %d, got %d", tt.expected, got)
			}
		})
	}
}

func TestSanitizeSourceFileProgress(t *testing.T) {
	sourceFile := &domain.SourceFile{
		TotalRecords:     3223073,
		ProcessedRecords: 6135146,
		FailedRecords:    10,
	}

	sanitizeSourceFileProgress(sourceFile)

	if sourceFile.ProcessedRecords != 3223073 {
		t.Fatalf("expected processed records to be capped at total, got %d", sourceFile.ProcessedRecords)
	}

	if sourceFile.FailedRecords != 10 {
		t.Fatalf("expected failed records to remain unchanged when valid, got %d", sourceFile.FailedRecords)
	}

	sourceFile = &domain.SourceFile{
		TotalRecords:     100,
		ProcessedRecords: 60,
		FailedRecords:    190,
	}

	sanitizeSourceFileProgress(sourceFile)

	if sourceFile.FailedRecords != 60 {
		t.Fatalf("expected failed records to be capped at processed, got %d", sourceFile.FailedRecords)
	}
}

// TestProcessRecordsArray_FinalUpdatePersistsLastProcessedLEI verifies that the final
// UpdateSourceFile call always carries the correct LastProcessedLEI, even when the total
// record count is less than the checkpoint interval (5 000) so no intermediate checkpoint
// is written during processing.
func TestProcessRecordsArray_FinalUpdatePersistsLastProcessedLEI(t *testing.T) {
	const recordCount = 5
	stub := &stubLEIRepo{}
	svc := &leiService{repo: stub}

	sf := newTestSourceFile()
	decoder := json.NewDecoder(makeTestLEIArrayJSON(recordCount))

	if err := svc.processRecordsArray(decoder, sf, ""); err != nil {
		t.Fatalf("processRecordsArray returned unexpected error: %v", err)
	}

	if len(stub.updateCalls) == 0 {
		t.Fatal("expected at least one UpdateSourceFile call (final update), got none")
	}

	finalUpdate := stub.updateCalls[len(stub.updateCalls)-1]
	if finalUpdate.LastProcessedLEI == nil {
		t.Fatal("final UpdateSourceFile call had nil LastProcessedLEI; expected last LEI code")
	}

	// The last LEI in the generated set has index recordCount-1.
	wantLEI := fmt.Sprintf("5493001KJTIIG%05d12", recordCount-1)
	if *finalUpdate.LastProcessedLEI != wantLEI {
		t.Fatalf("final LastProcessedLEI = %q, want %q", *finalUpdate.LastProcessedLEI, wantLEI)
	}

	if finalUpdate.ProcessedRecords != recordCount {
		t.Fatalf("final ProcessedRecords = %d, want %d", finalUpdate.ProcessedRecords, recordCount)
	}
}

// TestProcessRecordsArray_CheckpointIntervalAndFinalLEI verifies two properties for a run
// that crosses the 5 000-record checkpoint boundary:
//  1. At least one intermediate checkpoint UpdateSourceFile is issued.
//  2. The final UpdateSourceFile call carries the correct LastProcessedLEI.
func TestProcessRecordsArray_CheckpointIntervalAndFinalLEI(t *testing.T) {
	const recordCount = 5001 // one record beyond the first checkpoint (5 000)
	stub := &stubLEIRepo{}
	svc := &leiService{repo: stub}

	sf := newTestSourceFile()
	sf.TotalRecords = recordCount
	decoder := json.NewDecoder(makeTestLEIArrayJSON(recordCount))

	if err := svc.processRecordsArray(decoder, sf, ""); err != nil {
		t.Fatalf("processRecordsArray returned unexpected error: %v", err)
	}

	// Expect: one checkpoint at processedRecords==5000 and one final update.
	if len(stub.updateCalls) < 2 {
		t.Fatalf("expected at least 2 UpdateSourceFile calls (1 checkpoint + 1 final), got %d", len(stub.updateCalls))
	}

	// The first call should be the checkpoint at 5 000 processed records.
	checkpoint := stub.updateCalls[0]
	if checkpoint.ProcessedRecords != 5000 {
		t.Fatalf("checkpoint ProcessedRecords = %d, want 5000", checkpoint.ProcessedRecords)
	}
	if checkpoint.LastProcessedLEI == nil {
		t.Fatal("checkpoint LastProcessedLEI is nil; expected a valid LEI code")
	}

	// The final call should reflect all 5 001 records and the very last LEI.
	finalUpdate := stub.updateCalls[len(stub.updateCalls)-1]
	if finalUpdate.ProcessedRecords != recordCount {
		t.Fatalf("final ProcessedRecords = %d, want %d", finalUpdate.ProcessedRecords, recordCount)
	}
	if finalUpdate.LastProcessedLEI == nil {
		t.Fatal("final UpdateSourceFile call had nil LastProcessedLEI")
	}

	wantLEI := fmt.Sprintf("5493001KJTIIG%05d12", recordCount-1)
	if *finalUpdate.LastProcessedLEI != wantLEI {
		t.Fatalf("final LastProcessedLEI = %q, want %q", *finalUpdate.LastProcessedLEI, wantLEI)
	}
}
