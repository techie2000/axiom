package service

import (
	"errors"
	"os"
	"path/filepath"
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
		JobType: "DAILY_FULL",
		Status:  "COMPLETED",
	}
	stub := &progressMsgRepoStub{statusToReturn: completedStatus}
	svc := newProgressMsgService(stub)

	svc.setProgressMessage("DAILY_FULL", "Downloading file")

	if stub.updateCallCount != 1 {
		t.Fatalf("expected 1 update call, got %d", stub.updateCallCount)
	}
	// leiService.UpdateProcessingStatus clears ProgressMessage when Status != "RUNNING".
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

func TestUpdateProcessingStatus_NonGLEIFJobClearsMessageWhenCompleted(t *testing.T) {
	stub := &progressMsgRepoStub{}
	svc := newProgressMsgService(stub)

	status := &domain.FileProcessingStatus{
		ID:              uuid.New(),
		JobType:         "DAILY_FULL",
		Status:          "COMPLETED",
		ProgressMessage: "some progress text",
	}

	if err := svc.UpdateProcessingStatus(status); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if stub.capturedMessage != "" {
		t.Errorf("DAILY_FULL COMPLETED: want empty progress message, got %q", stub.capturedMessage)
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
