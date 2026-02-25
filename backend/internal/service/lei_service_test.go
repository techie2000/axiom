package service

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"testing"

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

// testLEICode returns a deterministic, valid 20-character LEI code for index i.
// Format: "5493001KTEST" (12 chars) + zero-padded i (6 digits) + i%100 (2 digits).
func testLEICode(i int) string {
	return fmt.Sprintf("5493001KTEST%06d%02d", i, i%100)
}

// leiArrayDecoder builds an in-memory JSON array of n minimal LEI records and
// returns a *json.Decoder positioned at the start of that array, ready to be
// handed to processRecordsArray.
func leiArrayDecoder(n int) *json.Decoder {
	var buf bytes.Buffer
	buf.WriteString("[")
	for i := 1; i <= n; i++ {
		if i > 1 {
			buf.WriteByte(',')
		}
		lei := testLEICode(i)
		fmt.Fprintf(&buf,
			`{"LEI":{"$":%q},"Entity":{"LegalName":{"$":"E"},"LegalAddress":{"Country":{"$":"US"}}},"Registration":{}}`,
			lei,
		)
	}
	buf.WriteString("]")
	return json.NewDecoder(&buf)
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

// TestProcessRecordsArray_CheckpointFrequency verifies that UpdateSourceFile is
// called once for every sourceFileProgressCheckpointInterval (5 000) records
// processed, plus a mandatory final call at the end of processing.
func TestProcessRecordsArray_CheckpointFrequency(t *testing.T) {
	const totalRecords = 11000
	// 2 checkpoints (at 5 000 and 10 000) + 1 final = 3 calls.
	const wantCalls = 3

	stub := &stubLEIRepo{}
	svc := &leiService{repo: stub}
	sf := &domain.SourceFile{ID: uuid.New()}

	if err := svc.processRecordsArray(leiArrayDecoder(totalRecords), sf, ""); err != nil {
		t.Fatalf("processRecordsArray returned unexpected error: %v", err)
	}

	if got := len(stub.updateCalls); got != wantCalls {
		t.Fatalf("expected %d UpdateSourceFile calls, got %d", wantCalls, got)
	}

	// Each checkpoint call must land on an exact 5 000-record boundary.
	wantCheckpoints := []int{5000, 10000}
	for idx, want := range wantCheckpoints {
		if got := stub.updateCalls[idx].ProcessedRecords; got != want {
			t.Errorf("checkpoint call %d: expected processedRecords=%d, got %d", idx+1, want, got)
		}
	}

	// The final call must reflect the full record count.
	if got := stub.updateCalls[wantCalls-1].ProcessedRecords; got != totalRecords {
		t.Errorf("final UpdateSourceFile call: expected processedRecords=%d, got %d", totalRecords, got)
	}
}

// TestProcessRecordsArray_FinalUpdatePersistsLastLEI verifies that the
// LastProcessedLEI in the mandatory final UpdateSourceFile call reflects the
// actual last record processed, and that ProcessedRecords reflects every record
// actually processed (including those after the last checkpoint boundary).
func TestProcessRecordsArray_FinalUpdatePersistsLastLEI(t *testing.T) {
	// 5 001 records: checkpoint fires at 5 000 (sets LastProcessedLEI to the
	// 5 000th record's LEI); the remaining 1 record is flushed without hitting
	// another checkpoint; the final UpdateSourceFile carries processedRecords=5 001
	// and LastProcessedLEI for the 5 001st record.
	const totalRecords = 5001
	expectedCheckpointLEI := testLEICode(5000) // LEI captured at the checkpoint
	expectedFinalLEI := testLEICode(5001)       // actual last record's LEI

	stub := &stubLEIRepo{}
	svc := &leiService{repo: stub}
	sf := &domain.SourceFile{ID: uuid.New()}

	if err := svc.processRecordsArray(leiArrayDecoder(totalRecords), sf, ""); err != nil {
		t.Fatalf("processRecordsArray returned unexpected error: %v", err)
	}

	// Expect exactly 2 calls: checkpoint at 5 000 and final at 5 001.
	if got := len(stub.updateCalls); got != 2 {
		t.Fatalf("expected 2 UpdateSourceFile calls, got %d", got)
	}

	checkpoint := stub.updateCalls[0]
	if checkpoint.ProcessedRecords != 5000 {
		t.Errorf("checkpoint call: expected processedRecords=5000, got %d", checkpoint.ProcessedRecords)
	}
	if checkpoint.LastProcessedLEI == nil {
		t.Error("checkpoint call: LastProcessedLEI is nil, want non-nil")
	} else if *checkpoint.LastProcessedLEI != expectedCheckpointLEI {
		t.Errorf("checkpoint call: LastProcessedLEI=%q, want %q", *checkpoint.LastProcessedLEI, expectedCheckpointLEI)
	}

	final := stub.updateCalls[1]
	if final.ProcessedRecords != totalRecords {
		t.Errorf("final call: expected processedRecords=%d, got %d", totalRecords, final.ProcessedRecords)
	}
	// LastProcessedLEI is kept in sync after every batch flush, so the final
	// call carries the actual last record's LEI rather than the checkpoint LEI.
	if final.LastProcessedLEI == nil {
		t.Error("final call: LastProcessedLEI is nil, want last record's LEI")
	} else if *final.LastProcessedLEI != expectedFinalLEI {
		t.Errorf("final call: LastProcessedLEI=%q, want %q (actual last record)", *final.LastProcessedLEI, expectedFinalLEI)
	}
}
