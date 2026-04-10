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
	cp := *status
	s.statusUpdates = append(s.statusUpdates, &cp)
	return nil
}

type schedulerGLEIFGateServiceStub struct {
	GLEIFReferenceService

	syncErr   error
	syncCalls int
}

func (s *schedulerGLEIFGateServiceStub) SyncAll() error {
	s.syncCalls++
	return s.syncErr
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
