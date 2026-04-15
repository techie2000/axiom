package service

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/repository"
)

// ---------------------------------------------------------------------------
// statusJobTypeFromFileType
// ---------------------------------------------------------------------------

func TestStatusJobTypeFromFileType_FullMapsToDAILY_FULL(t *testing.T) {
	got := statusJobTypeFromFileType("FULL")
	if got != "DAILY_FULL" {
		t.Errorf("FULL: want DAILY_FULL, got %q", got)
	}
}

func TestStatusJobTypeFromFileType_LowercaseFullMapsToDAILY_FULL(t *testing.T) {
	got := statusJobTypeFromFileType("full")
	if got != "DAILY_FULL" {
		t.Errorf("full: want DAILY_FULL, got %q", got)
	}
}

func TestStatusJobTypeFromFileType_DeltaMapsToDAILY_DELTA(t *testing.T) {
	got := statusJobTypeFromFileType("DELTA")
	if got != "DAILY_DELTA" {
		t.Errorf("DELTA: want DAILY_DELTA, got %q", got)
	}
}

func TestStatusJobTypeFromFileType_LowercaseDeltaMapsToDAILY_DELTA(t *testing.T) {
	got := statusJobTypeFromFileType("delta")
	if got != "DAILY_DELTA" {
		t.Errorf("delta: want DAILY_DELTA, got %q", got)
	}
}

func TestStatusJobTypeFromFileType_UnknownReturnsEmpty(t *testing.T) {
	cases := []string{"", "LEVEL2", "UNKNOWN", "rr", "repex"}
	for _, c := range cases {
		got := statusJobTypeFromFileType(c)
		if got != "" {
			t.Errorf("fileType %q: want empty string, got %q", c, got)
		}
	}
}

func TestStatusJobTypeFromFileType_WhitespaceTrimmed(t *testing.T) {
	got := statusJobTypeFromFileType("  FULL  ")
	if got != "DAILY_FULL" {
		t.Errorf("padded FULL: want DAILY_FULL, got %q", got)
	}
}

// ---------------------------------------------------------------------------
// setProgressMessage – stub repo + service
// ---------------------------------------------------------------------------

// progressMsgRepoStub implements only the repo methods needed for setProgressMessage tests.
type progressMsgRepoStub struct {
	repository.LEIRepository

	statusToReturn  *domain.FileProcessingStatus
	findErr         error
	updateErr       error
	findCallCount   int
	updateCallCount int
	capturedMessage string
}

func (s *progressMsgRepoStub) FindProcessingStatus(_ string) (*domain.FileProcessingStatus, error) {
	s.findCallCount++
	return s.statusToReturn, s.findErr
}

func (s *progressMsgRepoStub) UpdateProcessingStatus(status *domain.FileProcessingStatus) error {
	s.updateCallCount++
	if status != nil {
		s.capturedMessage = status.ProgressMessage
	}
	return s.updateErr
}

func (s *progressMsgRepoStub) UpdateProcessingProgressMessageByJobType(_ string, progressMessage string) error {
	s.updateCallCount++
	s.capturedMessage = progressMessage
	return s.updateErr
}

func newProgressMsgService(stub *progressMsgRepoStub) *leiService {
	return &leiService{repo: stub}
}

func TestSetProgressMessage_BlankJobTypeIsNoOp(t *testing.T) {
	stub := &progressMsgRepoStub{}
	svc := newProgressMsgService(stub)

	svc.setProgressMessage("", "Downloading file")

	if stub.findCallCount != 0 {
		t.Errorf("blank jobType: expected no FindProcessingStatus call, got %d", stub.findCallCount)
	}
	if stub.updateCallCount != 0 {
		t.Errorf("blank jobType: expected no UpdateProcessingStatus call, got %d", stub.updateCallCount)
	}
}

func TestSetProgressMessage_WhitespaceOnlyJobTypeIsNoOp(t *testing.T) {
	stub := &progressMsgRepoStub{}
	svc := newProgressMsgService(stub)

	svc.setProgressMessage("   ", "Downloading file")

	if stub.findCallCount != 0 {
		t.Errorf("whitespace jobType: expected no FindProcessingStatus call, got %d", stub.findCallCount)
	}
	if stub.updateCallCount != 0 {
		t.Errorf("whitespace jobType: expected no UpdateProcessingStatus call, got %d", stub.updateCallCount)
	}
}

func TestSetProgressMessage_FindStatusErrorIsNoOp(t *testing.T) {
	stub := &progressMsgRepoStub{findErr: errors.New("db error")}
	svc := newProgressMsgService(stub)

	// Must not panic — error is logged and swallowed.
	svc.setProgressMessage("DAILY_FULL", "Downloading file")

	if stub.updateCallCount != 0 {
		t.Errorf("find error: expected no update call, got %d", stub.updateCallCount)
	}
}

func TestSetProgressMessage_RunningStatusPreservesMessage(t *testing.T) {
	runningStatus := &domain.FileProcessingStatus{
		ID:      uuid.New(),
		JobType: "DAILY_FULL",
		Status:  "RUNNING",
	}
	stub := &progressMsgRepoStub{statusToReturn: runningStatus}
	svc := newProgressMsgService(stub)

	svc.setProgressMessage("DAILY_FULL", "Downloading lei_full_20240101.zip")

	if stub.updateCallCount != 1 {
		t.Fatalf("RUNNING status: expected 1 update call, got %d", stub.updateCallCount)
	}
	// Message is preserved: UpdateProcessingStatus only clears ProgressMessage when Status != RUNNING.
	if stub.capturedMessage != "Downloading lei_full_20240101.zip" {
		t.Errorf("RUNNING status: want captured message %q, got %q",
			"Downloading lei_full_20240101.zip", stub.capturedMessage)
	}
}

func TestSetProgressMessage_MessageIsTrimmed(t *testing.T) {
	runningStatus := &domain.FileProcessingStatus{
		ID:      uuid.New(),
		JobType: "DAILY_FULL",
		Status:  "RUNNING",
	}
	stub := &progressMsgRepoStub{statusToReturn: runningStatus}
	svc := newProgressMsgService(stub)

	svc.setProgressMessage("DAILY_FULL", "  Extracting file  ")

	if stub.updateCallCount != 1 {
		t.Fatalf("expected 1 update call, got %d", stub.updateCallCount)
	}
	if stub.capturedMessage != "Extracting file" {
		t.Errorf("want trimmed message %q, got %q", "Extracting file", stub.capturedMessage)
	}
}

func TestSetProgressMessage_NonRunningStatusClearsMessage(t *testing.T) {
	completedStatus := &domain.FileProcessingStatus{
		ID:      uuid.New(),
		JobType: "MASTER_DATA_SYNC",
		Status:  "COMPLETED",
	}
	stub := &progressMsgRepoStub{statusToReturn: completedStatus}
	svc := newProgressMsgService(stub)

	svc.setProgressMessage("MASTER_DATA_SYNC", "Downloading file")

	if stub.updateCallCount != 1 {
		t.Fatalf("expected 1 update call, got %d", stub.updateCallCount)
	}
	// MASTER_DATA_SYNC does not preserve post-completion progress payloads.
	if stub.capturedMessage != "" {
		t.Errorf("non-RUNNING status: want empty message (cleared by UpdateProcessingStatus), got %q", stub.capturedMessage)
	}
}

func TestUpdateProcessingStatus_GLEIFReferenceSyncPreservesMessageWhenCompleted(t *testing.T) {
	stub := &progressMsgRepoStub{}
	svc := newProgressMsgService(stub)

	status := &domain.FileProcessingStatus{
		ID:              uuid.New(),
		JobType:         "GLEIF_REFERENCE_SYNC",
		Status:          "COMPLETED",
		ProgressMessage: `{"total_records":7121,"files_saved":2}`,
	}

	if err := svc.UpdateProcessingStatus(status); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if stub.capturedMessage != `{"total_records":7121,"files_saved":2}` {
		t.Errorf("GLEIF_REFERENCE_SYNC COMPLETED: want stats JSON preserved, got %q", stub.capturedMessage)
	}
}

// TestUpdateProcessingStatus_GLEIFReferenceSyncPreservesMessageWhenIdle covers the actual
// post-run terminal state written by RunGLEIFReferenceSync (IDLE, not COMPLETED).
func TestUpdateProcessingStatus_GLEIFReferenceSyncPreservesMessageWhenIdle(t *testing.T) {
	stub := &progressMsgRepoStub{}
	svc := newProgressMsgService(stub)

	status := &domain.FileProcessingStatus{
		ID:              uuid.New(),
		JobType:         "GLEIF_REFERENCE_SYNC",
		Status:          "IDLE",
		ProgressMessage: `{"total_records":7121,"files_saved":2}`,
	}

	if err := svc.UpdateProcessingStatus(status); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if stub.capturedMessage != `{"total_records":7121,"files_saved":2}` {
		t.Errorf("GLEIF_REFERENCE_SYNC IDLE: want stats JSON preserved, got %q", stub.capturedMessage)
	}
}

func TestUpdateProcessingStatus_Level1JobPreservesMessageWhenCompleted(t *testing.T) {
	stub := &progressMsgRepoStub{}
	svc := newProgressMsgService(stub)

	status := &domain.FileProcessingStatus{
		ID:              uuid.New(),
		JobType:         "DAILY_FULL",
		Status:          "COMPLETED",
		ProgressMessage: `{"kind":"level1-progress","evaluated":1000,"upserted":42,"unchanged":958,"failed":0,"total":1000}`,
	}

	if err := svc.UpdateProcessingStatus(status); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if stub.capturedMessage == "" {
		t.Fatal("DAILY_FULL COMPLETED: expected progress message to be preserved")
	}
}

func TestBuildLevel1ProgressMessage(t *testing.T) {
	raw := buildLevel1ProgressMessage(470651, 470651, 116, 4)
	if raw == "" {
		t.Fatal("expected non-empty progress message")
	}

	var payload level1ProgressMessage
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		t.Fatalf("expected valid JSON payload, got error: %v", err)
	}

	if payload.Kind != "level1-progress" {
		t.Fatalf("expected kind level1-progress, got %q", payload.Kind)
	}
	if payload.Evaluated != 470651 {
		t.Fatalf("expected evaluated 470651, got %d", payload.Evaluated)
	}
	if payload.Upserted != 116 {
		t.Fatalf("expected upserted 116, got %d", payload.Upserted)
	}
	if payload.Failed != 4 {
		t.Fatalf("expected failed 4, got %d", payload.Failed)
	}
	if payload.Unchanged != 470531 {
		t.Fatalf("expected unchanged 470531, got %d", payload.Unchanged)
	}
}

func TestUpdateProcessingStatus_Level2RRPreservesMessageWhenCompleted(t *testing.T) {
	stub := &progressMsgRepoStub{}
	svc := newProgressMsgService(stub)

	status := &domain.FileProcessingStatus{
		ID:              uuid.New(),
		JobType:         "LEVEL2_RR",
		Status:          "COMPLETED",
		ProgressMessage: `{"kind":"level2-progress","evaluated":1000,"upserted":42,"unchanged":958,"failed":0,"total":1000}`,
	}

	if err := svc.UpdateProcessingStatus(status); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if stub.capturedMessage == "" {
		t.Fatal("LEVEL2_RR COMPLETED: expected progress message to be preserved")
	}
}

func TestUpdateProcessingStatus_Level2REPEXPreservesMessageWhenCompleted(t *testing.T) {
	stub := &progressMsgRepoStub{}
	svc := newProgressMsgService(stub)

	status := &domain.FileProcessingStatus{
		ID:              uuid.New(),
		JobType:         "LEVEL2_REPEX",
		Status:          "COMPLETED",
		ProgressMessage: `{"kind":"level2-progress","evaluated":2500,"upserted":77,"unchanged":2423,"failed":0,"total":2500}`,
	}

	if err := svc.UpdateProcessingStatus(status); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if stub.capturedMessage == "" {
		t.Fatal("LEVEL2_REPEX COMPLETED: expected progress message to be preserved")
	}
}

func TestFormatExtractionProgressMessage_IncludesPercentSpeedAndETA(t *testing.T) {
	msg := formatExtractionProgressMessage(
		"lei-FULL-20260413-085949.json.zip",
		48.1507,
		5947.78125,
		12352.4264,
		74.3462,
		86.1461,
	)

	if !strings.Contains(msg, "Extracting lei-FULL-20260413-085949.json.zip") {
		t.Fatalf("expected filename in message, got %q", msg)
	}
	if !strings.Contains(msg, "48.2%") {
		t.Fatalf("expected rounded percent in message, got %q", msg)
	}
	if !strings.Contains(msg, "74.3 MB/s") {
		t.Fatalf("expected rounded speed in message, got %q", msg)
	}
	if !strings.Contains(msg, "ETA 1m26s") {
		t.Fatalf("expected ETA in message, got %q", msg)
	}
}

func TestFormatExtractionProgressMessage_HandlesUnknownSpeedAndETA(t *testing.T) {
	msg := formatExtractionProgressMessage("", 12.34, 12.0, 24.0, 0, 0)

	if !strings.Contains(msg, "Extracting file") {
		t.Fatalf("expected fallback file label, got %q", msg)
	}
	if !strings.Contains(msg, "ETA n/a") {
		t.Fatalf("expected n/a ETA, got %q", msg)
	}
	if !strings.Contains(msg, ", n/a, ETA") {
		t.Fatalf("expected n/a speed, got %q", msg)
	}
}

// ---------------------------------------------------------------------------
// SourceFileExists
// ---------------------------------------------------------------------------

// sourceFileExistsRepoStub implements the repo methods needed for SourceFileExists.
type sourceFileExistsRepoStub struct {
	repository.LEIRepository

	fileToReturn *domain.SourceFile
	findErr      error
}

func (s *sourceFileExistsRepoStub) FindSourceFileByID(_ string) (*domain.SourceFile, error) {
	return s.fileToReturn, s.findErr
}

func TestSourceFileExists_DiskFilePresentReturnsTrue(t *testing.T) {
	dir := t.TempDir()
	fileName := "lei_full_20240101.zip"

	// Create the actual file on disk.
	if err := os.WriteFile(filepath.Join(dir, fileName), []byte("data"), 0o600); err != nil {
		t.Fatalf("failed to create test file: %v", err)
	}

	stub := &sourceFileExistsRepoStub{
		fileToReturn: &domain.SourceFile{
			ID:       uuid.New(),
			FileName: fileName,
		},
	}
	svc := &leiService{repo: stub, dataDir: dir}

	got, err := svc.SourceFileExists(stub.fileToReturn.ID)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !got {
		t.Error("expected true (file present on disk), got false")
	}
}

func TestSourceFileExists_DiskFileMissingReturnsFalse(t *testing.T) {
	dir := t.TempDir()
	fileName := "lei_full_missing.zip"
	// Do NOT create the file on disk.

	stub := &sourceFileExistsRepoStub{
		fileToReturn: &domain.SourceFile{
			ID:       uuid.New(),
			FileName: fileName,
		},
	}
	svc := &leiService{repo: stub, dataDir: dir}

	got, err := svc.SourceFileExists(stub.fileToReturn.ID)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if got {
		t.Error("expected false (file missing on disk), got true")
	}
}

func TestSourceFileExists_RepoLookupErrorPropagates(t *testing.T) {
	stub := &sourceFileExistsRepoStub{
		findErr: errors.New("connection refused"),
	}
	svc := &leiService{repo: stub, dataDir: t.TempDir()}

	got, err := svc.SourceFileExists(uuid.New())
	if err == nil {
		t.Fatal("expected error to propagate from repo, got nil")
	}
	if got {
		t.Error("expected false when repo returns error, got true")
	}
}
