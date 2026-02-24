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
	"github.com/techie2000/axiom/internal/service"
)

// schedulerServiceStub implements service.SchedulerService for handler tests.
// Trigger* methods either return a pre-configured error (to exercise conflict / 500 paths)
// or notify the called channel so success tests can confirm the correct method was invoked.
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

func (s *schedulerServiceStub) TriggerMasterDataSync() error {
	if err := s.triggerErr("TriggerMasterDataSync"); err != nil {
		return err
	}
	s.notify("TriggerMasterDataSync")
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

// conflictErr returns an error that wraps service.ErrJobRunning and contains msg.
func conflictErr(msg string) error {
	return fmt.Errorf("%s: %w", msg, service.ErrJobRunning)
}

func TestTriggerFullSync_ConflictPaths(t *testing.T) {
	t.Run("conflict when master data is running", func(t *testing.T) {
		h := NewLEIHandler(nil, &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerFullSync": conflictErr("cannot trigger DAILY_FULL while MASTER_DATA_SYNC is running"),
			},
		})

		resp := executePOST("/sync/full", h.TriggerFullSync)
		if resp.Code != http.StatusConflict {
			t.Fatalf("expected status %d, got %d", http.StatusConflict, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "MASTER_DATA_SYNC") {
			t.Fatalf("expected MASTER_DATA_SYNC conflict message, got %s", resp.Body.String())
		}
	})

	t.Run("conflict when full sync already running", func(t *testing.T) {
		h := NewLEIHandler(nil, &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerFullSync": conflictErr("DAILY_FULL is already running"),
			},
		})

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
		h := NewLEIHandler(nil, &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerDeltaSync": conflictErr("DAILY_DELTA is already running"),
			},
		})

		resp := executePOST("/sync/delta", h.TriggerDeltaSync)
		if resp.Code != http.StatusConflict {
			t.Fatalf("expected status %d, got %d", http.StatusConflict, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "DAILY_DELTA") {
			t.Fatalf("expected DAILY_DELTA conflict message, got %s", resp.Body.String())
		}
	})

	t.Run("conflict when full sync is running", func(t *testing.T) {
		h := NewLEIHandler(nil, &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerDeltaSync": conflictErr("cannot trigger DAILY_DELTA while DAILY_FULL is running"),
			},
		})

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
			triggerErr:    conflictErr("cannot trigger Level 2 while DAILY_FULL is running"),
			expectedMatch: "DAILY_FULL",
		},
		{
			name:          "conflict when rr is running",
			triggerErr:    conflictErr("cannot trigger Level 2 while LEVEL2_RR is running"),
			expectedMatch: "LEVEL2_RR",
		},
		{
			name:          "conflict when repex is running",
			triggerErr:    conflictErr("cannot trigger Level 2 while LEVEL2_REPEX is running"),
			expectedMatch: "LEVEL2_REPEX",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			h := NewLEIHandler(nil, &schedulerServiceStub{
				triggerErrs: map[string]error{"TriggerLevel2Sync": tc.triggerErr},
			})

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
		h := NewLEIHandler(nil, &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerLevel2RRSync": conflictErr("cannot trigger LEVEL2_RR while DAILY_FULL is running"),
			},
		})

		resp := executePOST("/sync/level2/rr", h.TriggerLevel2RRSync)
		if resp.Code != http.StatusConflict {
			t.Fatalf("expected status %d, got %d", http.StatusConflict, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "DAILY_FULL") {
			t.Fatalf("expected DAILY_FULL conflict message, got %s", resp.Body.String())
		}
	})

	t.Run("repex endpoint conflict when rr running", func(t *testing.T) {
		h := NewLEIHandler(nil, &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerLevel2REPEXSync": conflictErr("cannot trigger LEVEL2_REPEX while LEVEL2_RR is running"),
			},
		})

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
			h := NewLEIHandler(nil, schedulerStub)

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
		h := NewLEIHandler(nil, &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerFullSync": errors.New("failed to validate master data sync status: db unavailable"),
			},
		})

		resp := executePOST("/sync/full", h.TriggerFullSync)
		if resp.Code != http.StatusInternalServerError {
			t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "master data sync status") {
			t.Fatalf("expected master data validation error, got %s", resp.Body.String())
		}
	})

	t.Run("delta returns 500 when delta status lookup fails", func(t *testing.T) {
		h := NewLEIHandler(nil, &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerDeltaSync": errors.New("failed to validate delta sync status: db unavailable"),
			},
		})

		resp := executePOST("/sync/delta", h.TriggerDeltaSync)
		if resp.Code != http.StatusInternalServerError {
			t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "delta sync status") {
			t.Fatalf("expected delta validation error, got %s", resp.Body.String())
		}
	})

	t.Run("level2 returns 500 when full status lookup fails", func(t *testing.T) {
		h := NewLEIHandler(nil, &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerLevel2Sync": errors.New("failed to validate full sync status: db unavailable"),
			},
		})

		resp := executePOST("/sync/level2", h.TriggerLevel2Sync)
		if resp.Code != http.StatusInternalServerError {
			t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "full sync status") {
			t.Fatalf("expected full sync validation error, got %s", resp.Body.String())
		}
	})

	t.Run("level2 rr returns 500 when full status lookup fails", func(t *testing.T) {
		h := NewLEIHandler(nil, &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerLevel2RRSync": errors.New("failed to validate full sync status: db unavailable"),
			},
		})

		resp := executePOST("/sync/level2/rr", h.TriggerLevel2RRSync)
		if resp.Code != http.StatusInternalServerError {
			t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "full sync status") {
			t.Fatalf("expected full sync validation error, got %s", resp.Body.String())
		}
	})

	t.Run("level2 repex returns 500 when full status lookup fails", func(t *testing.T) {
		h := NewLEIHandler(nil, &schedulerServiceStub{
			triggerErrs: map[string]error{
				"TriggerLevel2REPEXSync": errors.New("failed to validate full sync status: db unavailable"),
			},
		})

		resp := executePOST("/sync/level2/repex", h.TriggerLevel2REPEXSync)
		if resp.Code != http.StatusInternalServerError {
			t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "full sync status") {
			t.Fatalf("expected full sync validation error, got %s", resp.Body.String())
		}
	})
}
