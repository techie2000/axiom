package service

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
)

// ---------------------------------------------------------------------------
// resumeInterruptedFullSyncOnStartup – missing-file path
//
// Tests the critical resilience path that runs when the interrupted FULL
// source file is no longer present on disk at startup.
// ---------------------------------------------------------------------------

// resumeTestLEIStub implements LEIService with only the methods invoked
// by resumeInterruptedFullSyncOnStartup and the early path of RunDailyFullSync.
// Calling any unimplemented method will panic with a nil pointer dereference,
// making unexpected call paths immediately visible in test output.
type resumeTestLEIStub struct {
	LEIService // embed interface; unimplemented methods panic on call

	mu sync.Mutex

	pendingFilesResult    []*domain.SourceFile
	sourceFileExistsValue bool

	// Captured calls (guarded by mu).
	updateSourceFileCalls []*domain.SourceFile
	updateStatusCalls     []*domain.FileProcessingStatus

	// getStatusCallCount tracks GetProcessingStatus("DAILY_FULL") call count atomically.
	// On the FIRST call it returns an IDLE status (synchronous resume path).
	// On the SECOND call it returns RUNNING so RunDailyFullSync exits immediately
	// (confirming the goroutine was launched without doing real download work).
	getStatusCallCount int32
	goroutineLaunched  chan struct{} // closed on 2nd GetProcessingStatus("DAILY_FULL") call
}

func (s *resumeTestLEIStub) FindPendingSourceFiles() ([]*domain.SourceFile, error) {
	return s.pendingFilesResult, nil
}

func (s *resumeTestLEIStub) SourceFileExists(_ uuid.UUID) (bool, error) {
	return s.sourceFileExistsValue, nil
}

func (s *resumeTestLEIStub) UpdateSourceFile(file *domain.SourceFile) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cp := *file
	s.updateSourceFileCalls = append(s.updateSourceFileCalls, &cp)
	return nil
}

func (s *resumeTestLEIStub) GetProcessingStatus(jobType string) (*domain.FileProcessingStatus, error) {
	if jobType == "DAILY_FULL" {
		n := atomic.AddInt32(&s.getStatusCallCount, 1)
		if n >= 2 {
			// Signal that the goroutine has started and return RUNNING so
			// RunDailyFullSync exits immediately without doing real work.
			select {
			case <-s.goroutineLaunched:
				// already closed
			default:
				close(s.goroutineLaunched)
			}
			return &domain.FileProcessingStatus{JobType: "DAILY_FULL", Status: "RUNNING"}, nil
		}
	}
	return &domain.FileProcessingStatus{JobType: jobType, Status: "IDLE"}, nil
}

func (s *resumeTestLEIStub) UpdateProcessingStatus(status *domain.FileProcessingStatus) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if status != nil {
		cp := *status
		s.updateStatusCalls = append(s.updateStatusCalls, &cp)
	}
	return nil
}

// newSchedulerWithResumeStub builds a minimal schedulerService backed by the stub.
func newSchedulerWithResumeStub(stub *resumeTestLEIStub) *schedulerService {
	return &schedulerService{
		leiService:  stub,
		fullSyncDay: time.Sunday,
	}
}

// buildInterruptedFullFile returns a SourceFile that looks interrupted (IN_PROGRESS).
func buildInterruptedFullFile() *domain.SourceFile {
	id := uuid.New()
	lastLEI := "5493001KJTIIGC8Y1R12"
	return &domain.SourceFile{
		ID:               id,
		FileName:         "lei_full_20240101.zip",
		FileType:         "FULL",
		ProcessingStatus: "IN_PROGRESS",
		ProcessedRecords: 50000,
		LastProcessedLEI: &lastLEI,
	}
}

func TestResumeInterruptedFullSyncOnStartup_MissingFileMarksSourceFileAsFailed(t *testing.T) {
	stub := &resumeTestLEIStub{
		sourceFileExistsValue: false, // file missing on disk
		pendingFilesResult:    []*domain.SourceFile{buildInterruptedFullFile()},
		goroutineLaunched:     make(chan struct{}),
	}
	svc := newSchedulerWithResumeStub(stub)

	resumed, err := svc.resumeInterruptedFullSyncOnStartup()

	if err != nil {
		t.Fatalf("expected no error from missing-file path, got %v", err)
	}
	if !resumed {
		t.Fatal("expected resumed=true when missing file triggers fresh sync")
	}

	stub.mu.Lock()
	defer stub.mu.Unlock()

	if len(stub.updateSourceFileCalls) != 1 {
		t.Fatalf("expected 1 UpdateSourceFile call, got %d", len(stub.updateSourceFileCalls))
	}
	sf := stub.updateSourceFileCalls[0]
	if sf.ProcessingStatus != "FAILED" {
		t.Errorf("UpdateSourceFile: want ProcessingStatus=FAILED, got %q", sf.ProcessingStatus)
	}
	if sf.FailureCategory != "FILE_MISSING" {
		t.Errorf("UpdateSourceFile: want FailureCategory=FILE_MISSING, got %q", sf.FailureCategory)
	}
	if sf.ProcessingError == "" {
		t.Error("UpdateSourceFile: want non-empty ProcessingError, got empty")
	}
}

func TestResumeInterruptedFullSyncOnStartup_MissingFileClearsCurrentSourceFileID(t *testing.T) {
	stub := &resumeTestLEIStub{
		sourceFileExistsValue: false,
		pendingFilesResult:    []*domain.SourceFile{buildInterruptedFullFile()},
		goroutineLaunched:     make(chan struct{}),
	}
	svc := newSchedulerWithResumeStub(stub)

	_, _ = svc.resumeInterruptedFullSyncOnStartup()

	stub.mu.Lock()
	defer stub.mu.Unlock()

	// Find the UpdateProcessingStatus call that resets to IDLE.
	var idleCall *domain.FileProcessingStatus
	for _, call := range stub.updateStatusCalls {
		if call.Status == "IDLE" {
			idleCall = call
			break
		}
	}
	if idleCall == nil {
		t.Fatalf("expected UpdateProcessingStatus call with Status=IDLE, none found; calls: %v", stub.updateStatusCalls)
	}
	if idleCall.CurrentSourceFileID != nil {
		t.Errorf("UpdateProcessingStatus(IDLE): want CurrentSourceFileID=nil, got %v", idleCall.CurrentSourceFileID)
	}
}

func TestResumeInterruptedFullSyncOnStartup_MissingFileSetsNextRunAt(t *testing.T) {
	stub := &resumeTestLEIStub{
		sourceFileExistsValue: false,
		pendingFilesResult:    []*domain.SourceFile{buildInterruptedFullFile()},
		goroutineLaunched:     make(chan struct{}),
	}
	svc := newSchedulerWithResumeStub(stub)

	before := time.Now()
	_, _ = svc.resumeInterruptedFullSyncOnStartup()
	after := time.Now().Add(25 * time.Hour)

	stub.mu.Lock()
	defer stub.mu.Unlock()

	var idleCall *domain.FileProcessingStatus
	for _, call := range stub.updateStatusCalls {
		if call.Status == "IDLE" {
			idleCall = call
			break
		}
	}
	if idleCall == nil {
		t.Fatalf("expected UpdateProcessingStatus(IDLE), got none")
	}
	if idleCall.NextRunAt == nil {
		t.Fatal("UpdateProcessingStatus(IDLE): want non-nil NextRunAt, got nil")
	}
	if idleCall.NextRunAt.Before(before) || idleCall.NextRunAt.After(after) {
		t.Errorf("NextRunAt %v not in expected future range [%v, %v]",
			idleCall.NextRunAt, before, after)
	}
}

func TestResumeInterruptedFullSyncOnStartup_MissingFileLaunchesFreshSync(t *testing.T) {
	stub := &resumeTestLEIStub{
		sourceFileExistsValue: false,
		pendingFilesResult:    []*domain.SourceFile{buildInterruptedFullFile()},
		goroutineLaunched:     make(chan struct{}),
	}
	svc := newSchedulerWithResumeStub(stub)

	_, _ = svc.resumeInterruptedFullSyncOnStartup()

	// Wait for the goroutine to call GetProcessingStatus("DAILY_FULL") (its first action),
	// confirming RunDailyFullSync was invoked.
	select {
	case <-stub.goroutineLaunched:
		// goroutine confirmed launched
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for fresh full sync goroutine to launch")
	}
}

func TestResumeInterruptedFullSyncOnStartup_NoPendingFilesReturnsFalse(t *testing.T) {
	stub := &resumeTestLEIStub{
		pendingFilesResult: []*domain.SourceFile{},
		goroutineLaunched:  make(chan struct{}),
	}
	svc := newSchedulerWithResumeStub(stub)

	resumed, err := svc.resumeInterruptedFullSyncOnStartup()

	if err != nil {
		t.Fatalf("expected no error for no pending files, got %v", err)
	}
	if resumed {
		t.Error("expected resumed=false when no pending files, got true")
	}
}

func TestResumeInterruptedFullSyncOnStartup_DeltaFilesIgnored(t *testing.T) {
	deltaLastLEI := "5493001KJTIIGC8Y1R12"
	deltaFile := &domain.SourceFile{
		ID:               uuid.New(),
		FileName:         "lei_delta_20240101.zip",
		FileType:         "DELTA", // not FULL
		ProcessingStatus: "IN_PROGRESS",
		LastProcessedLEI: &deltaLastLEI,
	}
	stub := &resumeTestLEIStub{
		pendingFilesResult: []*domain.SourceFile{deltaFile},
		goroutineLaunched:  make(chan struct{}),
	}
	svc := newSchedulerWithResumeStub(stub)

	resumed, err := svc.resumeInterruptedFullSyncOnStartup()

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resumed {
		t.Error("expected resumed=false for DELTA-only pending files")
	}
}
