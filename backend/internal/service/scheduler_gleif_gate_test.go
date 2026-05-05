package service

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/techie2000/axiom/internal/domain"
)

type schedulerGLEIFGateLEIStub struct {
	LEIService

	downloadFullCalled  bool
	downloadDeltaCalled bool
	statusUpdates       []*domain.FileProcessingStatus
	statusesByJob       map[string]*domain.FileProcessingStatus
}

func (s *schedulerGLEIFGateLEIStub) GetProcessingStatus(jobType string) (*domain.FileProcessingStatus, error) {
	if s.statusesByJob == nil {
		s.statusesByJob = map[string]*domain.FileProcessingStatus{}
	}
	if st, ok := s.statusesByJob[jobType]; ok {
		cp := *st
		return &cp, nil
	}
	st := &domain.FileProcessingStatus{JobType: jobType, Status: "IDLE"}
	s.statusesByJob[jobType] = st
	cp := *st
	return &cp, nil
}

func (s *schedulerGLEIFGateLEIStub) DownloadFullFile() (*domain.SourceFile, error) {
	s.downloadFullCalled = true
	return nil, errors.New("download should not be called when GLEIF pre-sync fails")
}

func (s *schedulerGLEIFGateLEIStub) DownloadDeltaFile() (*domain.SourceFile, error) {
	s.downloadDeltaCalled = true
	return nil, errors.New("download should not be called when GLEIF pre-sync fails")
}

func (s *schedulerGLEIFGateLEIStub) UpdateProcessingStatus(status *domain.FileProcessingStatus) error {
	if status == nil {
		return nil
	}
	if s.statusesByJob == nil {
		s.statusesByJob = map[string]*domain.FileProcessingStatus{}
	}
	cp := *status
	s.statusUpdates = append(s.statusUpdates, &cp)
	s.statusesByJob[status.JobType] = &cp
	return nil
}

type schedulerGLEIFGateServiceStub struct {
	GLEIFReferenceService

	syncErr   error
	syncCalls int
	stats     GLEIFSyncStats
}

func (s *schedulerGLEIFGateServiceStub) SyncAll() error {
	s.syncCalls++
	return s.syncErr
}

func (s *schedulerGLEIFGateServiceStub) LastSyncStats() GLEIFSyncStats {
	return s.stats
}

func TestDoFullSyncWork_GLEIFPreSyncFailureStopsIngest(t *testing.T) {
	leiStub := &schedulerGLEIFGateLEIStub{}
	gleifStub := &schedulerGLEIFGateServiceStub{syncErr: errors.New("gleif unavailable")}
	svc := &schedulerService{
		leiService:            leiStub,
		gleifReferenceService: gleifStub,
	}

	status := &domain.FileProcessingStatus{Status: "RUNNING", ProgressMessage: "Preparing full sync"}
	err := svc.doFullSyncWork(status, time.Now())
	if err == nil {
		t.Fatal("expected error when GLEIF pre-sync fails")
	}
	if !strings.Contains(err.Error(), "GLEIF reference sync failed before full_sync") {
		t.Fatalf("unexpected error: %v", err)
	}
	if gleifStub.syncCalls != 1 {
		t.Fatalf("expected SyncAll to be called once, got %d", gleifStub.syncCalls)
	}
	if leiStub.downloadFullCalled {
		t.Fatal("expected full download to be skipped when GLEIF pre-sync fails")
	}
	if status.Status != "FAILED" {
		t.Fatalf("expected status FAILED, got %q", status.Status)
	}
	if status.ProgressMessage != "" {
		t.Fatalf("expected ProgressMessage to be cleared, got %q", status.ProgressMessage)
	}
	if len(leiStub.statusUpdates) == 0 {
		t.Fatal("expected status update on pre-sync failure")
	}
}

func TestDoDeltaSyncWork_GLEIFPreSyncFailureStopsIngest(t *testing.T) {
	leiStub := &schedulerGLEIFGateLEIStub{}
	gleifStub := &schedulerGLEIFGateServiceStub{syncErr: errors.New("gleif unavailable")}
	svc := &schedulerService{
		leiService:            leiStub,
		gleifReferenceService: gleifStub,
		deltaSyncInterval:     time.Hour,
	}

	status := &domain.FileProcessingStatus{Status: "RUNNING", ProgressMessage: "Preparing delta sync"}
	err := svc.doDeltaSyncWork(status, time.Now())
	if err == nil {
		t.Fatal("expected error when GLEIF pre-sync fails")
	}
	if !strings.Contains(err.Error(), "GLEIF reference sync failed before delta_sync") {
		t.Fatalf("unexpected error: %v", err)
	}
	if gleifStub.syncCalls != 1 {
		t.Fatalf("expected SyncAll to be called once, got %d", gleifStub.syncCalls)
	}
	if leiStub.downloadDeltaCalled {
		t.Fatal("expected delta download to be skipped when GLEIF pre-sync fails")
	}
	if status.Status != "FAILED" {
		t.Fatalf("expected status FAILED, got %q", status.Status)
	}
	if status.ProgressMessage != "" {
		t.Fatalf("expected ProgressMessage to be cleared, got %q", status.ProgressMessage)
	}
	if len(leiStub.statusUpdates) == 0 {
		t.Fatal("expected status update on pre-sync failure")
	}
}

func TestRunGLEIFReferenceSync_SuccessSetsIdleWithNextRun(t *testing.T) {
	leiStub := &schedulerGLEIFGateLEIStub{}
	gleifStub := &schedulerGLEIFGateServiceStub{}
	svc := &schedulerService{
		leiService:            leiStub,
		gleifReferenceService: gleifStub,
		fullSyncHour:          12,
		fullSyncMinute:        0,
	}

	if err := svc.RunGLEIFReferenceSync(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gleifStub.syncCalls != 1 {
		t.Fatalf("expected SyncAll to be called once, got %d", gleifStub.syncCalls)
	}
	status, err := leiStub.GetProcessingStatus("GLEIF_REFERENCE_SYNC")
	if err != nil {
		t.Fatalf("unexpected status lookup error: %v", err)
	}
	if status.Status != "IDLE" {
		t.Fatalf("expected GLEIF_REFERENCE_SYNC final status IDLE, got %q", status.Status)
	}
	if status.LastSuccessAt == nil {
		t.Fatal("expected LastSuccessAt to be set after successful sync")
	}
	if status.NextRunAt == nil {
		t.Fatal("expected NextRunAt to be set after successful sync")
	}
}
