package handler

import (
	"errors"
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

type schedulerServiceStub struct {
	service.SchedulerService
	called chan string
}

func (s *schedulerServiceStub) notify(name string) {
	if s.called != nil {
		s.called <- name
	}
}

func (s *schedulerServiceStub) RunDailyFullSync() error {
	s.notify("RunDailyFullSync")
	return nil
}

func (s *schedulerServiceStub) RunDailyDeltaSync() error {
	s.notify("RunDailyDeltaSync")
	return nil
}

func (s *schedulerServiceStub) RunDailyMasterDataSync() error {
	s.notify("RunDailyMasterDataSync")
	return nil
}

func (s *schedulerServiceStub) RunLevel2Sync() error {
	s.notify("RunLevel2Sync")
	return nil
}

func (s *schedulerServiceStub) RunLevel2RRSync() error {
	s.notify("RunLevel2RRSync")
	return nil
}

func (s *schedulerServiceStub) RunLevel2REPEXSync() error {
	s.notify("RunLevel2REPEXSync")
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
		h := NewLEIHandler(&leiServiceStub{
			statuses: map[string]*domain.FileProcessingStatus{
				"MASTER_DATA_SYNC": {JobType: "MASTER_DATA_SYNC", Status: "RUNNING"},
				"DAILY_FULL":       {JobType: "DAILY_FULL", Status: "IDLE"},
			},
		}, &schedulerServiceStub{})

		resp := executePOST("/sync/full", h.TriggerFullSync)
		if resp.Code != http.StatusConflict {
			t.Fatalf("expected status %d, got %d", http.StatusConflict, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "MASTER_DATA_SYNC") {
			t.Fatalf("expected MASTER_DATA_SYNC conflict message, got %s", resp.Body.String())
		}
	})

	t.Run("conflict when full sync already running", func(t *testing.T) {
		h := NewLEIHandler(&leiServiceStub{
			statuses: map[string]*domain.FileProcessingStatus{
				"MASTER_DATA_SYNC": {JobType: "MASTER_DATA_SYNC", Status: "IDLE"},
				"DAILY_FULL":       {JobType: "DAILY_FULL", Status: "RUNNING"},
			},
		}, &schedulerServiceStub{})

		resp := executePOST("/sync/full", h.TriggerFullSync)
		if resp.Code != http.StatusConflict {
			t.Fatalf("expected status %d, got %d", http.StatusConflict, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "DAILY_FULL") {
			t.Fatalf("expected DAILY_FULL conflict message, got %s", resp.Body.String())
		}
	})
}

func TestTriggerDeltaSync_ConflictPaths(t *testing.T) {
	t.Run("conflict when delta is already running", func(t *testing.T) {
		h := NewLEIHandler(&leiServiceStub{
			statuses: map[string]*domain.FileProcessingStatus{
				"DAILY_DELTA": {JobType: "DAILY_DELTA", Status: "RUNNING"},
				"DAILY_FULL":  {JobType: "DAILY_FULL", Status: "IDLE"},
			},
		}, &schedulerServiceStub{})

		resp := executePOST("/sync/delta", h.TriggerDeltaSync)
		if resp.Code != http.StatusConflict {
			t.Fatalf("expected status %d, got %d", http.StatusConflict, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "DAILY_DELTA") {
			t.Fatalf("expected DAILY_DELTA conflict message, got %s", resp.Body.String())
		}
	})

	t.Run("conflict when full sync is running", func(t *testing.T) {
		h := NewLEIHandler(&leiServiceStub{
			statuses: map[string]*domain.FileProcessingStatus{
				"DAILY_DELTA": {JobType: "DAILY_DELTA", Status: "IDLE"},
				"DAILY_FULL":  {JobType: "DAILY_FULL", Status: "RUNNING"},
			},
		}, &schedulerServiceStub{})

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
		fullStatus    string
		rrStatus      string
		repexStatus   string
		expectedMatch string
	}{
		{
			name:          "conflict when full sync is running",
			fullStatus:    "RUNNING",
			rrStatus:      "IDLE",
			repexStatus:   "IDLE",
			expectedMatch: "DAILY_FULL",
		},
		{
			name:          "conflict when rr is running",
			fullStatus:    "IDLE",
			rrStatus:      "RUNNING",
			repexStatus:   "IDLE",
			expectedMatch: "LEVEL2_RR",
		},
		{
			name:          "conflict when repex is running",
			fullStatus:    "IDLE",
			rrStatus:      "IDLE",
			repexStatus:   "RUNNING",
			expectedMatch: "LEVEL2_REPEX",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			h := NewLEIHandler(&leiServiceStub{
				statuses: map[string]*domain.FileProcessingStatus{
					"DAILY_FULL":   {JobType: "DAILY_FULL", Status: tc.fullStatus},
					"LEVEL2_RR":    {JobType: "LEVEL2_RR", Status: tc.rrStatus},
					"LEVEL2_REPEX": {JobType: "LEVEL2_REPEX", Status: tc.repexStatus},
				},
			}, &schedulerServiceStub{})

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
		h := NewLEIHandler(&leiServiceStub{
			statuses: map[string]*domain.FileProcessingStatus{
				"DAILY_FULL": {JobType: "DAILY_FULL", Status: "RUNNING"},
				"LEVEL2_RR":  {JobType: "LEVEL2_RR", Status: "IDLE"},
			},
		}, &schedulerServiceStub{})

		resp := executePOST("/sync/level2/rr", h.TriggerLevel2RRSync)
		if resp.Code != http.StatusConflict {
			t.Fatalf("expected status %d, got %d", http.StatusConflict, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "DAILY_FULL") {
			t.Fatalf("expected DAILY_FULL conflict message, got %s", resp.Body.String())
		}
	})

	t.Run("repex endpoint conflict when rr running", func(t *testing.T) {
		h := NewLEIHandler(&leiServiceStub{
			statuses: map[string]*domain.FileProcessingStatus{
				"DAILY_FULL":   {JobType: "DAILY_FULL", Status: "IDLE"},
				"LEVEL2_RR":    {JobType: "LEVEL2_RR", Status: "RUNNING"},
				"LEVEL2_REPEX": {JobType: "LEVEL2_REPEX", Status: "IDLE"},
			},
		}, &schedulerServiceStub{})

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
		statuses          map[string]*domain.FileProcessingStatus
		expectedMessage   string
		expectedScheduler string
	}{
		{
			name:              "master data accepted",
			path:              "/sync/masterdata",
			handlerFactory:    func(h *LEIHandler) gin.HandlerFunc { return h.TriggerMasterDataSync },
			statuses:          map[string]*domain.FileProcessingStatus{"MASTER_DATA_SYNC": {JobType: "MASTER_DATA_SYNC", Status: "IDLE"}},
			expectedMessage:   "Master data sync triggered",
			expectedScheduler: "RunDailyMasterDataSync",
		},
		{
			name:              "full accepted",
			path:              "/sync/full",
			handlerFactory:    func(h *LEIHandler) gin.HandlerFunc { return h.TriggerFullSync },
			statuses:          map[string]*domain.FileProcessingStatus{"MASTER_DATA_SYNC": {JobType: "MASTER_DATA_SYNC", Status: "IDLE"}, "DAILY_FULL": {JobType: "DAILY_FULL", Status: "IDLE"}},
			expectedMessage:   "Full sync triggered",
			expectedScheduler: "RunDailyFullSync",
		},
		{
			name:              "delta accepted",
			path:              "/sync/delta",
			handlerFactory:    func(h *LEIHandler) gin.HandlerFunc { return h.TriggerDeltaSync },
			statuses:          map[string]*domain.FileProcessingStatus{"DAILY_DELTA": {JobType: "DAILY_DELTA", Status: "IDLE"}, "DAILY_FULL": {JobType: "DAILY_FULL", Status: "IDLE"}},
			expectedMessage:   "Delta sync triggered",
			expectedScheduler: "RunDailyDeltaSync",
		},
		{
			name:              "level2 accepted",
			path:              "/sync/level2",
			handlerFactory:    func(h *LEIHandler) gin.HandlerFunc { return h.TriggerLevel2Sync },
			statuses:          map[string]*domain.FileProcessingStatus{"DAILY_FULL": {JobType: "DAILY_FULL", Status: "IDLE"}, "LEVEL2_RR": {JobType: "LEVEL2_RR", Status: "IDLE"}, "LEVEL2_REPEX": {JobType: "LEVEL2_REPEX", Status: "IDLE"}},
			expectedMessage:   "Level 2 sync triggered",
			expectedScheduler: "RunLevel2Sync",
		},
		{
			name:              "level2 rr accepted",
			path:              "/sync/level2/rr",
			handlerFactory:    func(h *LEIHandler) gin.HandlerFunc { return h.TriggerLevel2RRSync },
			statuses:          map[string]*domain.FileProcessingStatus{"DAILY_FULL": {JobType: "DAILY_FULL", Status: "IDLE"}, "LEVEL2_RR": {JobType: "LEVEL2_RR", Status: "IDLE"}},
			expectedMessage:   "LEVEL2_RR sync triggered",
			expectedScheduler: "RunLevel2RRSync",
		},
		{
			name:              "level2 repex accepted",
			path:              "/sync/level2/repex",
			handlerFactory:    func(h *LEIHandler) gin.HandlerFunc { return h.TriggerLevel2REPEXSync },
			statuses:          map[string]*domain.FileProcessingStatus{"DAILY_FULL": {JobType: "DAILY_FULL", Status: "IDLE"}, "LEVEL2_RR": {JobType: "LEVEL2_RR", Status: "IDLE"}, "LEVEL2_REPEX": {JobType: "LEVEL2_REPEX", Status: "IDLE"}},
			expectedMessage:   "LEVEL2_REPEX sync triggered",
			expectedScheduler: "RunLevel2REPEXSync",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			schedulerStub := &schedulerServiceStub{called: make(chan string, 1)}
			h := NewLEIHandler(&leiServiceStub{statuses: tc.statuses}, schedulerStub)

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
	t.Run("full returns 500 when master data status lookup fails", func(t *testing.T) {
		h := NewLEIHandler(&leiServiceStub{
			errs: map[string]error{
				"MASTER_DATA_SYNC": errors.New("db unavailable"),
			},
		}, &schedulerServiceStub{})

		resp := executePOST("/sync/full", h.TriggerFullSync)
		if resp.Code != http.StatusInternalServerError {
			t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "master data sync status") {
			t.Fatalf("expected master data validation error, got %s", resp.Body.String())
		}
	})

	t.Run("delta returns 500 when delta status lookup fails", func(t *testing.T) {
		h := NewLEIHandler(&leiServiceStub{
			errs: map[string]error{
				"DAILY_DELTA": errors.New("db unavailable"),
			},
		}, &schedulerServiceStub{})

		resp := executePOST("/sync/delta", h.TriggerDeltaSync)
		if resp.Code != http.StatusInternalServerError {
			t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "delta sync status") {
			t.Fatalf("expected delta validation error, got %s", resp.Body.String())
		}
	})

	t.Run("level2 returns 500 when full status lookup fails", func(t *testing.T) {
		h := NewLEIHandler(&leiServiceStub{
			errs: map[string]error{
				"DAILY_FULL": errors.New("db unavailable"),
			},
		}, &schedulerServiceStub{})

		resp := executePOST("/sync/level2", h.TriggerLevel2Sync)
		if resp.Code != http.StatusInternalServerError {
			t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "full sync status") {
			t.Fatalf("expected full sync validation error, got %s", resp.Body.String())
		}
	})

	t.Run("level2 rr returns 500 when full status lookup fails", func(t *testing.T) {
		h := NewLEIHandler(&leiServiceStub{
			errs: map[string]error{
				"DAILY_FULL": errors.New("db unavailable"),
			},
		}, &schedulerServiceStub{})

		resp := executePOST("/sync/level2/rr", h.TriggerLevel2RRSync)
		if resp.Code != http.StatusInternalServerError {
			t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "full sync status") {
			t.Fatalf("expected full sync validation error, got %s", resp.Body.String())
		}
	})

	t.Run("level2 repex returns 500 when full status lookup fails", func(t *testing.T) {
		h := NewLEIHandler(&leiServiceStub{
			errs: map[string]error{
				"DAILY_FULL": errors.New("db unavailable"),
			},
		}, &schedulerServiceStub{})

		resp := executePOST("/sync/level2/repex", h.TriggerLevel2REPEXSync)
		if resp.Code != http.StatusInternalServerError {
			t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "full sync status") {
			t.Fatalf("expected full sync validation error, got %s", resp.Body.String())
		}
	})
}
