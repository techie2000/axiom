package service

import (
	"errors"
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

// ---------------------------------------------------------------------------
// NormalizeProcessingJobType (exported) and normalizeProcessingJobType (private)
// ---------------------------------------------------------------------------

func TestNormalizeProcessingJobType(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		// Level-1 aliases
		{input: "DAILY_FULL", want: "LEVEL1_FULL"},
		{input: "LEVEL1_FULL", want: "LEVEL1_FULL"},
		{input: "DAILY_DELTA", want: "LEVEL1_DELTA"},
		{input: "LEVEL1_DELTA", want: "LEVEL1_DELTA"},
		// Level-2 pass-throughs
		{input: "LEVEL2_RR", want: "LEVEL2_RR"},
		{input: "LEVEL2_REPEX", want: "LEVEL2_REPEX"},
		// Unknown types → empty string
		{input: "UNKNOWN", want: ""},
		{input: "", want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := NormalizeProcessingJobType(tt.input)
			if got != tt.want {
				t.Fatalf("NormalizeProcessingJobType(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestNormalizeProcessingJobTypePrivateDelegates(t *testing.T) {
	// The private function must map the same known aliases as the exported one
	// and pass unknown / Level-2 types through unchanged.
	cases := []struct {
		input string
		want  string
	}{
		{"DAILY_FULL", "LEVEL1_FULL"},
		{"LEVEL1_FULL", "LEVEL1_FULL"},
		{"DAILY_DELTA", "LEVEL1_DELTA"},
		{"LEVEL1_DELTA", "LEVEL1_DELTA"},
		{"LEVEL2_RR", "LEVEL2_RR"},
		{"LEVEL2_REPEX", "LEVEL2_REPEX"},
		{"UNKNOWN_TYPE", "UNKNOWN_TYPE"}, // pass-through
		{"", ""},                         // empty → empty
	}
	for _, c := range cases {
		got := normalizeProcessingJobType(c.input)
		if got != c.want {
			t.Errorf("normalizeProcessingJobType(%q) = %q, want %q", c.input, got, c.want)
		}
	}
}

// ---------------------------------------------------------------------------
// batchResolveOpenProcessingFailures (leiService) – stub-based tests
// ---------------------------------------------------------------------------

// leiRepoStub embeds the full LEIRepository interface so that only the
// BatchResolveOpenProcessingFailures method needs to be overridden.
type leiRepoStub struct {
	repository.LEIRepository
	calledJobType  string
	calledKeys     []string
	calledSourceID *uuid.UUID
	calledNote     string
	returnErr      error
	callCount      int
}

func (s *leiRepoStub) BatchResolveOpenProcessingFailures(
	jobType string,
	naturalKeys []string,
	resolvedSourceFileID *uuid.UUID,
	resolvedNote string,
) error {
	s.callCount++
	s.calledJobType = jobType
	s.calledKeys = naturalKeys
	s.calledSourceID = resolvedSourceFileID
	s.calledNote = resolvedNote
	return s.returnErr
}

func newLeiServiceWithBatchRepoStub(stub *leiRepoStub) *leiService {
	return &leiService{repo: stub}
}

func TestBatchResolveOpenProcessingFailures_Service_EmptyKeys(t *testing.T) {
	stub := &leiRepoStub{}
	svc := newLeiServiceWithBatchRepoStub(stub)
	sourceID := uuid.New()

	svc.batchResolveOpenProcessingFailures("LEVEL1_FULL", []string{}, &sourceID)

	if stub.callCount != 0 {
		t.Fatalf("expected repo not to be called for empty key slice, got %d calls", stub.callCount)
	}
}

func TestBatchResolveOpenProcessingFailures_Service_AllInvalidKeys(t *testing.T) {
	stub := &leiRepoStub{}
	svc := newLeiServiceWithBatchRepoStub(stub)
	sourceID := uuid.New()

	// normalizeLEICodeValue converts "null" / whitespace to empty string.
	svc.batchResolveOpenProcessingFailures("LEVEL1_FULL", []string{"null", "  ", "NULL"}, &sourceID)

	if stub.callCount != 0 {
		t.Fatalf("expected repo not to be called when all keys are invalid, got %d calls", stub.callCount)
	}
}

func TestBatchResolveOpenProcessingFailures_Service_ValidKeys(t *testing.T) {
	stub := &leiRepoStub{}
	svc := newLeiServiceWithBatchRepoStub(stub)
	sourceID := uuid.New()

	keys := []string{"5493001kjtiigc8y1r12", " AAAAAAAAAAAAAAAAAA01 "}
	svc.batchResolveOpenProcessingFailures("DAILY_FULL", keys, &sourceID)

	if stub.callCount != 1 {
		t.Fatalf("expected exactly 1 repo call, got %d", stub.callCount)
	}
	// Job type must be normalised (DAILY_FULL → LEVEL1_FULL).
	if stub.calledJobType != "LEVEL1_FULL" {
		t.Errorf("expected calledJobType LEVEL1_FULL, got %q", stub.calledJobType)
	}
	// LEI codes must be upper-cased and trimmed.
	if len(stub.calledKeys) != 2 {
		t.Fatalf("expected 2 normalised keys, got %d: %v", len(stub.calledKeys), stub.calledKeys)
	}
	if stub.calledKeys[0] != "5493001KJTIIGC8Y1R12" {
		t.Errorf("expected first key normalised to uppercase, got %q", stub.calledKeys[0])
	}
	if stub.calledSourceID != &sourceID {
		t.Errorf("sourceFileID not forwarded correctly")
	}
}

func TestBatchResolveOpenProcessingFailures_Service_MixedKeys(t *testing.T) {
	stub := &leiRepoStub{}
	svc := newLeiServiceWithBatchRepoStub(stub)

	// Mix of valid and invalid keys.
	svc.batchResolveOpenProcessingFailures("LEVEL1_FULL", []string{"5493001KJTIIGC8Y1R12", "null", ""}, nil)

	if stub.callCount != 1 {
		t.Fatalf("expected 1 repo call for mixed keys, got %d", stub.callCount)
	}
	if len(stub.calledKeys) != 1 {
		t.Fatalf("expected 1 valid key forwarded to repo, got %d", len(stub.calledKeys))
	}
}

func TestBatchResolveOpenProcessingFailures_Service_RepoErrorIsLogged(t *testing.T) {
	// When the repo returns an error the service must not panic or propagate it;
	// errors are logged as warnings.
	stub := &leiRepoStub{returnErr: errors.New("db failure")}
	svc := newLeiServiceWithBatchRepoStub(stub)

	// Should not panic.
	svc.batchResolveOpenProcessingFailures("LEVEL1_FULL", []string{"5493001KJTIIGC8Y1R12"}, nil)

	if stub.callCount != 1 {
		t.Fatalf("expected 1 repo call even when it fails, got %d", stub.callCount)
	}
}
