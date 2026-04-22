package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

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
			LegalName:         LEILegalName{Value: "Example Entity"},
			EntityStatus:      LEIValueField{Value: "NULL"},
			EntityCategory:    LEIValueField{Value: "null"},
			EntitySubCategory: LEIValueField{Value: "STATE_GOVERNMENT"},
			LegalJurisdiction: LEIValueField{Value: "NG-LA"},
			LegalAddress:      LEIAddress{FirstAddressLine: LEIValueField{Value: "NULL"}, City: LEIValueField{Value: "Lagos"}, Country: LEIValueField{Value: "NG"}},
			SuccessorEntity:   []LEISuccessorEntity{{SuccessorLEI: LEIValueField{Value: " 5493001kjtiigc8y1r12 "}}},
		},
		Registration: LEIRegistration{
			ManagingLOU:        LEIValueField{Value: "NULL"},
			RegistrationStatus: LEIValueField{Value: "ISSUED"},
			ValidationSources:  LEIValueField{Value: "FULLY_CORROBORATED"},
			ValidationAuthority: LEIValidationAuthority{
				ValidationAuthorityID: LEIValueField{Value: "RA000463"},
			},
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
	if record.EntitySubCategory != "STATE_GOVERNMENT" {
		t.Fatalf("expected EntitySubCategory to be mapped, got %q", record.EntitySubCategory)
	}
	if record.LegalJurisdiction != "NG-LA" {
		t.Fatalf("expected LegalJurisdiction to be mapped, got %q", record.LegalJurisdiction)
	}
	if record.RegistrationStatus != "ISSUED" {
		t.Fatalf("expected RegistrationStatus to be mapped, got %q", record.RegistrationStatus)
	}
	if record.ValidationAuthority != "RA000463" {
		t.Fatalf("expected ValidationAuthority to be mapped from ValidationAuthorityID, got %q", record.ValidationAuthority)
	}
	if string(record.ValidationSources) != `"FULLY_CORROBORATED"` {
		t.Fatalf("expected ValidationSources to be stored as JSON string, got %q", string(record.ValidationSources))
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

func TestValidationSourcesToJSONBEmptyProducesNullNotObject(t *testing.T) {
	got := validationSourcesToJSONB("")
	if got != "" {
		t.Fatalf("expected empty ValidationSources to produce empty JSONBString (SQL NULL), got %q", string(got))
	}
}

func TestValidationSourcesToJSONBNullLikeProducesNullNotObject(t *testing.T) {
	got := validationSourcesToJSONB("null")
	if got != "" {
		t.Fatalf("expected null-like ValidationSources to produce empty JSONBString (SQL NULL), got %q", string(got))
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

func TestCleanupOldFiles_RetainsLevel2FullFilesUsingFullRetentionRule(t *testing.T) {
	tmpDir := t.TempDir()
	svc := &leiService{dataDir: tmpDir}

	writeFileWithModTime := func(name string, modTime time.Time) {
		t.Helper()
		path := filepath.Join(tmpDir, name)
		if err := os.WriteFile(path, []byte(name), 0o644); err != nil {
			t.Fatalf("WriteFile(%s): %v", name, err)
		}
		if err := os.Chtimes(path, modTime, modTime); err != nil {
			t.Fatalf("Chtimes(%s): %v", name, err)
		}
	}

	now := time.Now()
	writeFileWithModTime("lei-FULL-20260413-120000.json.zip", now.Add(-1*time.Hour))
	writeFileWithModTime("gleif-level2-rr_full-20260413-110000.zip", now.Add(-2*time.Hour))
	writeFileWithModTime("gleif-level2-repex_full-20260413-100000.zip", now.Add(-3*time.Hour))
	writeFileWithModTime("lei-DELTA-20260413-090000.json.zip", now.Add(-4*time.Hour))

	if err := svc.CleanupOldFiles(2, 1); err != nil {
		t.Fatalf("CleanupOldFiles returned error: %v", err)
	}

	assertExists := func(name string) {
		t.Helper()
		if _, err := os.Stat(filepath.Join(tmpDir, name)); err != nil {
			t.Fatalf("expected %s to exist, got error: %v", name, err)
		}
	}

	assertMissing := func(name string) {
		t.Helper()
		if _, err := os.Stat(filepath.Join(tmpDir, name)); !errors.Is(err, os.ErrNotExist) {
			t.Fatalf("expected %s to be removed, got err=%v", name, err)
		}
	}

	assertExists("lei-FULL-20260413-120000.json.zip")
	assertExists("gleif-level2-rr_full-20260413-110000.zip")
	assertExists("lei-DELTA-20260413-090000.json.zip")
	assertMissing("gleif-level2-repex_full-20260413-100000.zip")
}

func TestCleanupOldFiles_PrunesGLEIFReferenceSnapshotsUsingFullRetentionRule(t *testing.T) {
	tmpDir := t.TempDir()
	svc := &leiService{dataDir: tmpDir}
	listDir := filepath.Join(tmpDir, "gleif-reference", "entity_legal_forms")
	if err := os.MkdirAll(listDir, 0o755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}

	writeSnapshotPair := func(baseName string, modTime time.Time) {
		t.Helper()
		payloadPath := filepath.Join(listDir, baseName+".csv")
		metaPath := filepath.Join(listDir, baseName+".meta.json")
		if err := os.WriteFile(payloadPath, []byte(baseName), 0o644); err != nil {
			t.Fatalf("WriteFile payload %s: %v", payloadPath, err)
		}
		if err := os.WriteFile(metaPath, []byte(`{"payload":"`+baseName+`.csv"}`), 0o644); err != nil {
			t.Fatalf("WriteFile meta %s: %v", metaPath, err)
		}
		if err := os.Chtimes(payloadPath, modTime, modTime); err != nil {
			t.Fatalf("Chtimes payload %s: %v", payloadPath, err)
		}
		if err := os.Chtimes(metaPath, modTime, modTime); err != nil {
			t.Fatalf("Chtimes meta %s: %v", metaPath, err)
		}
	}

	now := time.Now()
	writeSnapshotPair("20260413-120000_csv", now.Add(-1*time.Hour))
	writeSnapshotPair("20260413-110000_csv", now.Add(-2*time.Hour))
	writeSnapshotPair("20260413-100000_csv", now.Add(-3*time.Hour))

	if err := svc.CleanupOldFiles(2, 1); err != nil {
		t.Fatalf("CleanupOldFiles returned error: %v", err)
	}

	assertExists := func(relativePath string) {
		t.Helper()
		if _, err := os.Stat(filepath.Join(tmpDir, relativePath)); err != nil {
			t.Fatalf("expected %s to exist, got error: %v", relativePath, err)
		}
	}

	assertMissing := func(relativePath string) {
		t.Helper()
		if _, err := os.Stat(filepath.Join(tmpDir, relativePath)); !errors.Is(err, os.ErrNotExist) {
			t.Fatalf("expected %s to be removed, got err=%v", relativePath, err)
		}
	}

	assertExists(filepath.Join("gleif-reference", "entity_legal_forms", "20260413-120000_csv.csv"))
	assertExists(filepath.Join("gleif-reference", "entity_legal_forms", "20260413-120000_csv.meta.json"))
	assertExists(filepath.Join("gleif-reference", "entity_legal_forms", "20260413-110000_csv.csv"))
	assertExists(filepath.Join("gleif-reference", "entity_legal_forms", "20260413-110000_csv.meta.json"))
	assertMissing(filepath.Join("gleif-reference", "entity_legal_forms", "20260413-100000_csv.csv"))
	assertMissing(filepath.Join("gleif-reference", "entity_legal_forms", "20260413-100000_csv.meta.json"))
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
		// Status-row aliases
		{input: "DAILY_FULL", want: "DAILY_FULL"},
		{input: "LEVEL1_FULL", want: "DAILY_FULL"},
		{input: "DAILY_DELTA", want: "DAILY_DELTA"},
		{input: "LEVEL1_DELTA", want: "DAILY_DELTA"},
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

func TestNormalizeProcessingFailureJobType(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		// Failure-row aliases
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
			got := NormalizeProcessingFailureJobType(tt.input)
			if got != tt.want {
				t.Fatalf("NormalizeProcessingFailureJobType(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestNormalizeProcessingJobTypePrivateDelegates(t *testing.T) {
	// The private function must map the same known aliases as the exported status
	// normalizer and pass unknown / Level-2 types through unchanged.
	cases := []struct {
		input string
		want  string
	}{
		{"DAILY_FULL", "DAILY_FULL"},
		{"LEVEL1_FULL", "DAILY_FULL"},
		{"DAILY_DELTA", "DAILY_DELTA"},
		{"LEVEL1_DELTA", "DAILY_DELTA"},
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

func TestNormalizeProcessingFailureJobTypePrivateDelegates(t *testing.T) {
	// The private function must map the same known aliases as the exported
	// failure normalizer and pass unknown / Level-2 types through unchanged.
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
		got := normalizeProcessingFailureJobType(c.input)
		if got != c.want {
			t.Errorf("normalizeProcessingFailureJobType(%q) = %q, want %q", c.input, got, c.want)
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
	// Failure job type must keep the Level-1 category.
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

type processRecordsRepoStub struct {
	repository.LEIRepository
	updateCalls           int
	updateSnapshots       []domain.SourceFile
	batchUpsertCallCount  int
	batchResolveCallCount int
}

func (s *processRecordsRepoStub) BatchUpsertLEIRecords(records []*domain.LEIRecord) (int, int, error) {
	s.batchUpsertCallCount++
	return len(records), 0, nil
}

func (s *processRecordsRepoStub) BatchResolveOpenProcessingFailures(jobType string, naturalKeys []string, resolvedSourceFileID *uuid.UUID, resolvedNote string) error {
	s.batchResolveCallCount++
	return nil
}

func (s *processRecordsRepoStub) UpdateSourceFile(file *domain.SourceFile) error {
	s.updateCalls++
	copy := *file
	if file.LastProcessedLEI != nil {
		last := *file.LastProcessedLEI
		copy.LastProcessedLEI = &last
	}
	s.updateSnapshots = append(s.updateSnapshots, copy)
	return nil
}

func (s *processRecordsRepoStub) CreateProcessingFailure(failure *domain.LEILevel2ProcessingFailure) error {
	return nil
}

func (s *processRecordsRepoStub) UpdateProcessingProgressMessageByJobType(_ string, _ string) error {
	return nil
}

func testLEICodeForIndex(index int) string {
	return fmt.Sprintf("%020d", index)
}

func buildRecordsArrayJSON(recordCount int) string {
	var builder strings.Builder
	builder.WriteString("[")
	for i := 0; i < recordCount; i++ {
		if i > 0 {
			builder.WriteString(",")
		}
		builder.WriteString(`{"LEI":{"$":"`)
		builder.WriteString(testLEICodeForIndex(i))
		builder.WriteString(`"},"Entity":{"LegalName":{"$":"Entity`)
		builder.WriteString(strconv.Itoa(i))
		builder.WriteString(`"}}}`)
	}
	builder.WriteString("]")
	return builder.String()
}

func TestProcessRecordsArray_CheckpointUpdatesAtConfiguredInterval(t *testing.T) {
	const recordCount = 10001
	repoStub := &processRecordsRepoStub{}
	svc := &leiService{repo: repoStub}

	decoder := json.NewDecoder(strings.NewReader(buildRecordsArrayJSON(recordCount)))
	sourceFile := &domain.SourceFile{TotalRecords: recordCount}

	if err := svc.processRecordsArray(decoder, sourceFile, ""); err != nil {
		t.Fatalf("processRecordsArray returned error: %v", err)
	}

	if repoStub.updateCalls != 3 {
		t.Fatalf("expected 3 UpdateSourceFile calls (5000, 10000, final), got %d", repoStub.updateCalls)
	}

	if repoStub.batchUpsertCallCount != 11 {
		t.Fatalf("expected 11 batch upsert calls for 10001 records at batchSize=1000, got %d", repoStub.batchUpsertCallCount)
	}

	finalSnapshot := repoStub.updateSnapshots[len(repoStub.updateSnapshots)-1]
	if finalSnapshot.LastProcessedLEI == nil {
		t.Fatalf("expected final LastProcessedLEI to be persisted")
	}

	wantLastLEI := testLEICodeForIndex(recordCount - 1)
	if *finalSnapshot.LastProcessedLEI != wantLastLEI {
		t.Fatalf("expected final LastProcessedLEI %q, got %q", wantLastLEI, *finalSnapshot.LastProcessedLEI)
	}
}

func TestProcessRecordsArray_FinalUpdatePersistsLastProcessedLEIForSmallFiles(t *testing.T) {
	const recordCount = 3
	repoStub := &processRecordsRepoStub{}
	svc := &leiService{repo: repoStub}

	decoder := json.NewDecoder(strings.NewReader(buildRecordsArrayJSON(recordCount)))
	sourceFile := &domain.SourceFile{TotalRecords: recordCount}

	if err := svc.processRecordsArray(decoder, sourceFile, ""); err != nil {
		t.Fatalf("processRecordsArray returned error: %v", err)
	}

	if repoStub.updateCalls != 1 {
		t.Fatalf("expected exactly 1 final UpdateSourceFile call for small file, got %d", repoStub.updateCalls)
	}

	finalSnapshot := repoStub.updateSnapshots[0]
	if finalSnapshot.LastProcessedLEI == nil {
		t.Fatalf("expected LastProcessedLEI in final update")
	}

	wantLastLEI := testLEICodeForIndex(recordCount - 1)
	if *finalSnapshot.LastProcessedLEI != wantLastLEI {
		t.Fatalf("expected LastProcessedLEI %q, got %q", wantLastLEI, *finalSnapshot.LastProcessedLEI)
	}
}

type leiCountRepoStub struct {
	repository.LEIRepository
	counts    []int64
	callCount int
}

func (s *leiCountRepoStub) CountLEIRecords() (int64, error) {
	s.callCount++
	if len(s.counts) == 0 {
		return 0, nil
	}

	idx := s.callCount - 1
	if idx >= len(s.counts) {
		idx = len(s.counts) - 1
	}

	return s.counts[idx], nil
}

func TestCountLEIRecords_UsesCachedValueUntilExplicitRefresh(t *testing.T) {
	repoStub := &leiCountRepoStub{counts: []int64{123, 999}}
	svc := &leiService{repo: repoStub}

	first, err := svc.CountLEIRecords()
	if err != nil {
		t.Fatalf("first CountLEIRecords returned error: %v", err)
	}

	second, err := svc.CountLEIRecords()
	if err != nil {
		t.Fatalf("second CountLEIRecords returned error: %v", err)
	}

	if first != 123 {
		t.Fatalf("expected first count to be 123, got %d", first)
	}
	if second != 123 {
		t.Fatalf("expected second count to use cached value 123, got %d", second)
	}
	if repoStub.callCount != 1 {
		t.Fatalf("expected repository count to be called once, got %d", repoStub.callCount)
	}
}

func TestRefreshLEICountCacheForJob_Level1JobUpdatesCachedValue(t *testing.T) {
	repoStub := &leiCountRepoStub{counts: []int64{123, 456}}
	svc := &leiService{repo: repoStub}

	first, err := svc.CountLEIRecords()
	if err != nil {
		t.Fatalf("first CountLEIRecords returned error: %v", err)
	}

	svc.refreshLEICountCacheForJob("LEVEL1_FULL")

	second, err := svc.CountLEIRecords()
	if err != nil {
		t.Fatalf("second CountLEIRecords returned error: %v", err)
	}

	if first != 123 {
		t.Fatalf("expected first count to be 123, got %d", first)
	}
	if second != 456 {
		t.Fatalf("expected refreshed count to be 456 after Level 1 refresh, got %d", second)
	}
	if repoStub.callCount != 2 {
		t.Fatalf("expected repository count to be called twice, got %d", repoStub.callCount)
	}
}

func TestRefreshLEICountCacheForJob_NonLevel1JobDoesNotUpdateCachedValue(t *testing.T) {
	repoStub := &leiCountRepoStub{counts: []int64{123, 456}}
	svc := &leiService{repo: repoStub}

	first, err := svc.CountLEIRecords()
	if err != nil {
		t.Fatalf("first CountLEIRecords returned error: %v", err)
	}

	svc.refreshLEICountCacheForJob("LEVEL2_RR")

	second, err := svc.CountLEIRecords()
	if err != nil {
		t.Fatalf("second CountLEIRecords returned error: %v", err)
	}

	if first != 123 {
		t.Fatalf("expected first count to be 123, got %d", first)
	}
	if second != 123 {
		t.Fatalf("expected cached count to remain 123 for non-Level 1 jobs, got %d", second)
	}
	if repoStub.callCount != 1 {
		t.Fatalf("expected repository count to be called once, got %d", repoStub.callCount)
	}
}
