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

// --- helpers for processRecordsArray tests ---

// checkpointStubRepo is a minimal stub of repository.LEIRepository that records
// every UpdateSourceFile call so tests can assert checkpoint frequency and
// the LastProcessedLEI value persisted at each call.
type checkpointStubRepo struct {
	repository.LEIRepository // satisfies interface; unused methods panic on call
	updateCalls []sfUpdate
}

type sfUpdate struct {
	processedRecords int
	lastProcessedLEI *string // nil-safe copy taken at call time
}

func (r *checkpointStubRepo) BatchUpsertLEIRecords(records []*domain.LEIRecord) (int, int, error) {
	return 0, len(records), nil
}

func (r *checkpointStubRepo) UpdateSourceFile(f *domain.SourceFile) error {
	snap := sfUpdate{processedRecords: f.ProcessedRecords}
	if f.LastProcessedLEI != nil {
		s := *f.LastProcessedLEI
		snap.lastProcessedLEI = &s
	}
	r.updateCalls = append(r.updateCalls, snap)
	return nil
}

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

// TestProcessRecordsArray_CheckpointFrequency verifies that UpdateSourceFile is
// called once for every sourceFileProgressCheckpointInterval (5 000) records
// processed, plus a mandatory final call at the end of processing.
func TestProcessRecordsArray_CheckpointFrequency(t *testing.T) {
	const totalRecords = 11000
	// 2 checkpoints (at 5 000 and 10 000) + 1 final = 3 calls.
	const wantCalls = 3

	stub := &checkpointStubRepo{}
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
		if got := stub.updateCalls[idx].processedRecords; got != want {
			t.Errorf("checkpoint call %d: expected processedRecords=%d, got %d", idx+1, want, got)
		}
	}

	// The final call must reflect the full record count.
	if got := stub.updateCalls[wantCalls-1].processedRecords; got != totalRecords {
		t.Errorf("final UpdateSourceFile call: expected processedRecords=%d, got %d", totalRecords, got)
	}
}

// TestProcessRecordsArray_FinalUpdatePersistsLastLEI verifies that the
// LastProcessedLEI written during the last checkpoint is preserved in the
// mandatory final UpdateSourceFile call, and that ProcessedRecords in that
// final call reflects every record actually processed (including those after
// the last checkpoint boundary).
func TestProcessRecordsArray_FinalUpdatePersistsLastLEI(t *testing.T) {
	// 5 001 records: checkpoint fires at 5 000 (sets LastProcessedLEI to the
	// 5 000th record's LEI); the remaining 1 record is flushed without hitting
	// another checkpoint; the final UpdateSourceFile carries processedRecords=5 001
	// and the LastProcessedLEI written at the 5 000-record checkpoint.
	const totalRecords = 5001
	expectedCheckpointLEI := testLEICode(5000) // LEI captured at the checkpoint

	stub := &checkpointStubRepo{}
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
	if checkpoint.processedRecords != 5000 {
		t.Errorf("checkpoint call: expected processedRecords=5000, got %d", checkpoint.processedRecords)
	}
	if checkpoint.lastProcessedLEI == nil {
		t.Error("checkpoint call: LastProcessedLEI is nil, want non-nil")
	} else if *checkpoint.lastProcessedLEI != expectedCheckpointLEI {
		t.Errorf("checkpoint call: LastProcessedLEI=%q, want %q", *checkpoint.lastProcessedLEI, expectedCheckpointLEI)
	}

	final := stub.updateCalls[1]
	if final.processedRecords != totalRecords {
		t.Errorf("final call: expected processedRecords=%d, got %d", totalRecords, final.processedRecords)
	}
	// The final UpdateSourceFile does not re-set LastProcessedLEI; it carries
	// through the value written during the last checkpoint.
	if final.lastProcessedLEI == nil {
		t.Error("final call: LastProcessedLEI is nil, want value from last checkpoint")
	} else if *final.lastProcessedLEI != expectedCheckpointLEI {
		t.Errorf("final call: LastProcessedLEI=%q, want %q (from checkpoint)", *final.lastProcessedLEI, expectedCheckpointLEI)
	}
}
