package handler

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/service"
)

type leiServiceStub struct {
	service.LEIService
	statuses map[string]*domain.FileProcessingStatus
	errs     map[string]error
}

func (s *leiServiceStub) GetProcessingStatus(jobType string) (*domain.FileProcessingStatus, error) {
	if s.errs != nil {
		if err, ok := s.errs[jobType]; ok {
			return nil, err
		}
	}
	if s.statuses != nil {
		if status, ok := s.statuses[jobType]; ok {
			copyStatus := *status
			return &copyStatus, nil
		}
	}
	return nil, errors.New("status not found")
}

// schedulerServiceStub satisfies the SchedulerService interface for handler tests.
// triggerErrs configures which Trigger* calls should return errors.
// called receives the name of each Trigger* method that succeeds.
type schedulerServiceStub struct {
	service.SchedulerService
	called      chan string
	triggerErrs map[string]error
}

func (s *schedulerServiceStub) notify(name string) {
	if s.called != nil {
		s.called <- name
	}
}

func (s *schedulerServiceStub) triggerErr(name string) error {
	if s.triggerErrs != nil {
		if err, ok := s.triggerErrs[name]; ok {
			return err
		}
	}
	return nil
}

func (s *schedulerServiceStub) TriggerFullSync() error {
	if err := s.triggerErr("TriggerFullSync"); err != nil {
		return err
	}
	s.notify("TriggerFullSync")
	return nil
}

func (s *schedulerServiceStub) TriggerDeltaSync() error {
	if err := s.triggerErr("TriggerDeltaSync"); err != nil {
		return err
	}
	s.notify("TriggerDeltaSync")
	return nil
}

func (s *schedulerServiceStub) TriggerMasterDataSync() error {
	if err := s.triggerErr("TriggerMasterDataSync"); err != nil {
		return err
	}
	s.notify("TriggerMasterDataSync")
	return nil
}

func (s *schedulerServiceStub) TriggerLevel2Sync() error {
	if err := s.triggerErr("TriggerLevel2Sync"); err != nil {
		return err
	}
	s.notify("TriggerLevel2Sync")
	return nil
}

func (s *schedulerServiceStub) TriggerLevel2RRSync() error {
	if err := s.triggerErr("TriggerLevel2RRSync"); err != nil {
		return err
	}
	s.notify("TriggerLevel2RRSync")
	return nil
}

func (s *schedulerServiceStub) TriggerLevel2REPEXSync() error {
	if err := s.triggerErr("TriggerLevel2REPEXSync"); err != nil {
		return err
	}
	s.notify("TriggerLevel2REPEXSync")
	return nil
}

func executePOST(path string, handler gin.HandlerFunc) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST(path, handler)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, path, nil)
	r.ServeHTTP(w, req)
	return w
}

func TestTriggerFullSync_ConflictPaths(t *testing.T) {
	t.Run("conflict when master data is running", func(t *testing.T) {
		stub := &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerFullSync": fmt.Errorf("cannot start Full Sync while MASTER_DATA_SYNC is running: %w", service.ErrJobRunning),
			},
		}
		h := NewLEIHandler(&leiServiceStub{}, stub)

		resp := executePOST("/sync/full", h.TriggerFullSync)
		if resp.Code != http.StatusConflict {
			t.Fatalf("expected status %d, got %d", http.StatusConflict, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "MASTER_DATA_SYNC") {
			t.Fatalf("expected MASTER_DATA_SYNC conflict message, got %s", resp.Body.String())
		}
	})

	t.Run("conflict when full sync already running", func(t *testing.T) {
		stub := &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerFullSync": fmt.Errorf("DAILY_FULL is already running: %w", service.ErrJobRunning),
			},
		}
		h := NewLEIHandler(&leiServiceStub{}, stub)

		resp := executePOST("/sync/full", h.TriggerFullSync)
		if resp.Code != http.StatusConflict {
			t.Fatalf("expected status %d, got %d", http.StatusConflict, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "DAILY_FULL") {
			t.Fatalf("expected DAILY_FULL conflict message, got %s", resp.Body.String())
		}
	})
}

func TestTriggerMasterDataSync_ConflictPaths(t *testing.T) {
	t.Run("conflict when master data is already running", func(t *testing.T) {
		h := NewLEIHandler(&leiServiceStub{
			statuses: map[string]*domain.FileProcessingStatus{
				"MASTER_DATA_SYNC": {JobType: "MASTER_DATA_SYNC", Status: "RUNNING"},
			},
		}, &schedulerServiceStub{})

		resp := executePOST("/sync/masterdata", h.TriggerMasterDataSync)
		if resp.Code != http.StatusConflict {
			t.Fatalf("expected status %d, got %d", http.StatusConflict, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "MASTER_DATA_SYNC") {
			t.Fatalf("expected MASTER_DATA_SYNC conflict message, got %s", resp.Body.String())
		}
	})
}

func TestTriggerDeltaSync_ConflictPaths(t *testing.T) {
	t.Run("conflict when delta is already running", func(t *testing.T) {
		stub := &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerDeltaSync": fmt.Errorf("DAILY_DELTA is already running: %w", service.ErrJobRunning),
			},
		}
		h := NewLEIHandler(&leiServiceStub{}, stub)

		resp := executePOST("/sync/delta", h.TriggerDeltaSync)
		if resp.Code != http.StatusConflict {
			t.Fatalf("expected status %d, got %d", http.StatusConflict, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "DAILY_DELTA") {
			t.Fatalf("expected DAILY_DELTA conflict message, got %s", resp.Body.String())
		}
	})

	t.Run("conflict when full sync is running", func(t *testing.T) {
		stub := &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerDeltaSync": fmt.Errorf("cannot start DAILY_DELTA while DAILY_FULL is running: %w", service.ErrJobRunning),
			},
		}
		h := NewLEIHandler(&leiServiceStub{}, stub)

		resp := executePOST("/sync/delta", h.TriggerDeltaSync)
		if resp.Code != http.StatusConflict {
			t.Fatalf("expected status %d, got %d", http.StatusConflict, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "DAILY_FULL") {
			t.Fatalf("expected DAILY_FULL conflict message, got %s", resp.Body.String())
		}
	})
}

func TestTriggerLevel2Sync_ConflictPaths(t *testing.T) {
	testCases := []struct {
		name          string
		triggerErr    error
		expectedMatch string
	}{
		{
			name:          "conflict when full sync is running",
			triggerErr:    fmt.Errorf("cannot start Level 2 while DAILY_FULL is running: %w", service.ErrJobRunning),
			expectedMatch: "DAILY_FULL",
		},
		{
			name:          "conflict when rr is running",
			triggerErr:    fmt.Errorf("cannot start Level 2 while LEVEL2_RR is running: %w", service.ErrJobRunning),
			expectedMatch: "LEVEL2_RR",
		},
		{
			name:          "conflict when repex is running",
			triggerErr:    fmt.Errorf("cannot start Level 2 while LEVEL2_REPEX is running: %w", service.ErrJobRunning),
			expectedMatch: "LEVEL2_REPEX",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			stub := &schedulerServiceStub{
				triggerErrs: map[string]error{"TriggerLevel2Sync": tc.triggerErr},
			}
			h := NewLEIHandler(&leiServiceStub{}, stub)

			resp := executePOST("/sync/level2", h.TriggerLevel2Sync)
			if resp.Code != http.StatusConflict {
				t.Fatalf("expected status %d, got %d", http.StatusConflict, resp.Code)
			}
			if !strings.Contains(resp.Body.String(), tc.expectedMatch) {
				t.Fatalf("expected response to contain %q, got %s", tc.expectedMatch, resp.Body.String())
			}
		})
	}
}

func TestTriggerLevel2SubJobs_ConflictPaths(t *testing.T) {
	t.Run("rr endpoint conflict when full running", func(t *testing.T) {
		stub := &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerLevel2RRSync": fmt.Errorf("cannot start LEVEL2_RR while DAILY_FULL is running: %w", service.ErrJobRunning),
			},
		}
		h := NewLEIHandler(&leiServiceStub{}, stub)

		resp := executePOST("/sync/level2/rr", h.TriggerLevel2RRSync)
		if resp.Code != http.StatusConflict {
			t.Fatalf("expected status %d, got %d", http.StatusConflict, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "DAILY_FULL") {
			t.Fatalf("expected DAILY_FULL conflict message, got %s", resp.Body.String())
		}
	})

	t.Run("repex endpoint conflict when rr running", func(t *testing.T) {
		stub := &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerLevel2REPEXSync": fmt.Errorf("cannot start LEVEL2_REPEX while LEVEL2_RR is running: %w", service.ErrJobRunning),
			},
		}
		h := NewLEIHandler(&leiServiceStub{}, stub)

		resp := executePOST("/sync/level2/repex", h.TriggerLevel2REPEXSync)
		if resp.Code != http.StatusConflict {
			t.Fatalf("expected status %d, got %d", http.StatusConflict, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "LEVEL2_RR") {
			t.Fatalf("expected LEVEL2_RR conflict message, got %s", resp.Body.String())
		}
	})
}

func TestTriggerManualSync_SuccessPaths(t *testing.T) {
	testCases := []struct {
		name              string
		path              string
		handlerFactory    func(*LEIHandler) gin.HandlerFunc
		expectedMessage   string
		expectedScheduler string
	}{
		{
			name:              "master data accepted",
			path:              "/sync/masterdata",
			handlerFactory:    func(h *LEIHandler) gin.HandlerFunc { return h.TriggerMasterDataSync },
			expectedMessage:   "Master data sync triggered",
			expectedScheduler: "TriggerMasterDataSync",
		},
		{
			name:              "full accepted",
			path:              "/sync/full",
			handlerFactory:    func(h *LEIHandler) gin.HandlerFunc { return h.TriggerFullSync },
			expectedMessage:   "Full sync triggered",
			expectedScheduler: "TriggerFullSync",
		},
		{
			name:              "delta accepted",
			path:              "/sync/delta",
			handlerFactory:    func(h *LEIHandler) gin.HandlerFunc { return h.TriggerDeltaSync },
			expectedMessage:   "Delta sync triggered",
			expectedScheduler: "TriggerDeltaSync",
		},
		{
			name:              "level2 accepted",
			path:              "/sync/level2",
			handlerFactory:    func(h *LEIHandler) gin.HandlerFunc { return h.TriggerLevel2Sync },
			expectedMessage:   "Level 2 sync triggered",
			expectedScheduler: "TriggerLevel2Sync",
		},
		{
			name:              "level2 rr accepted",
			path:              "/sync/level2/rr",
			handlerFactory:    func(h *LEIHandler) gin.HandlerFunc { return h.TriggerLevel2RRSync },
			expectedMessage:   "LEVEL2_RR sync triggered",
			expectedScheduler: "TriggerLevel2RRSync",
		},
		{
			name:              "level2 repex accepted",
			path:              "/sync/level2/repex",
			handlerFactory:    func(h *LEIHandler) gin.HandlerFunc { return h.TriggerLevel2REPEXSync },
			expectedMessage:   "LEVEL2_REPEX sync triggered",
			expectedScheduler: "TriggerLevel2REPEXSync",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			schedulerStub := &schedulerServiceStub{called: make(chan string, 1)}
			h := NewLEIHandler(&leiServiceStub{}, schedulerStub)

			resp := executePOST(tc.path, tc.handlerFactory(h))
			if resp.Code != http.StatusAccepted {
				t.Fatalf("expected status %d, got %d", http.StatusAccepted, resp.Code)
			}
			if !strings.Contains(resp.Body.String(), tc.expectedMessage) {
				t.Fatalf("expected response to contain %q, got %s", tc.expectedMessage, resp.Body.String())
			}

			select {
			case called := <-schedulerStub.called:
				if called != tc.expectedScheduler {
					t.Fatalf("expected scheduler call %q, got %q", tc.expectedScheduler, called)
				}
			case <-time.After(250 * time.Millisecond):
				t.Fatalf("expected scheduler call %q but it was not invoked", tc.expectedScheduler)
			}
		})
	}
}

func TestTriggerManualSync_ErrorPaths(t *testing.T) {
	t.Run("full returns 500 on non-conflict service error", func(t *testing.T) {
		stub := &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerFullSync": errors.New("db unavailable"),
			},
		}
		h := NewLEIHandler(&leiServiceStub{}, stub)

		resp := executePOST("/sync/full", h.TriggerFullSync)
		if resp.Code != http.StatusInternalServerError {
			t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "Failed to trigger full sync") {
			t.Fatalf("expected generic error message, got %s", resp.Body.String())
		}
	})

	t.Run("delta returns 500 on non-conflict service error", func(t *testing.T) {
		stub := &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerDeltaSync": errors.New("db unavailable"),
			},
		}
		h := NewLEIHandler(&leiServiceStub{}, stub)

		resp := executePOST("/sync/delta", h.TriggerDeltaSync)
		if resp.Code != http.StatusInternalServerError {
			t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "Failed to trigger delta sync") {
			t.Fatalf("expected generic error message, got %s", resp.Body.String())
		}
	})

	t.Run("level2 returns 500 on non-conflict service error", func(t *testing.T) {
		stub := &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerLevel2Sync": errors.New("db unavailable"),
			},
		}
		h := NewLEIHandler(&leiServiceStub{}, stub)

		resp := executePOST("/sync/level2", h.TriggerLevel2Sync)
		if resp.Code != http.StatusInternalServerError {
			t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "Failed to trigger Level 2 sync") {
			t.Fatalf("expected generic error message, got %s", resp.Body.String())
		}
	})

	t.Run("level2 rr returns 500 on non-conflict service error", func(t *testing.T) {
		stub := &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerLevel2RRSync": errors.New("db unavailable"),
			},
		}
		h := NewLEIHandler(&leiServiceStub{}, stub)

		resp := executePOST("/sync/level2/rr", h.TriggerLevel2RRSync)
		if resp.Code != http.StatusInternalServerError {
			t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "Failed to trigger LEVEL2_RR sync") {
			t.Fatalf("expected generic error message, got %s", resp.Body.String())
		}
	})

	t.Run("level2 repex returns 500 on non-conflict service error", func(t *testing.T) {
		stub := &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerLevel2REPEXSync": errors.New("db unavailable"),
			},
		}
		h := NewLEIHandler(&leiServiceStub{}, stub)

		resp := executePOST("/sync/level2/repex", h.TriggerLevel2REPEXSync)
		if resp.Code != http.StatusInternalServerError {
			t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "Failed to trigger LEVEL2_REPEX sync") {
			t.Fatalf("expected generic error message, got %s", resp.Body.String())
		}
	})
}
