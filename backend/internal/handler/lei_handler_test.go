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
	statuses       map[string]*domain.FileProcessingStatus
	errs           map[string]error
	predecessors   []*domain.LEIRecord
	predecessorErr error
	legalNames     map[string]string
	legalNamesErr  error
	receivedCodes  []string
}

func (s *leiServiceStub) GetLegalNamesByLEICodes(codes []string) (map[string]string, error) {
	s.receivedCodes = append([]string{}, codes...)
	if s.legalNamesErr != nil {
		return nil, s.legalNamesErr
	}
	if s.legalNames == nil {
		return map[string]string{}, nil
	}
	return s.legalNames, nil
}

func (s *leiServiceStub) GetPredecessorLEIs(_ string) ([]*domain.LEIRecord, error) {
	if s.predecessorErr != nil {
		return nil, s.predecessorErr
	}
	return s.predecessors, nil
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

type leiLevel2ServiceStub struct {
	service.LEILevel2Service
	failures []*domain.LEILevel2ProcessingFailure
	total    int64
	err      error
}

func (s *leiLevel2ServiceStub) GetProcessingFailures(jobType string, openOnly bool, limit, offset int) ([]*domain.LEILevel2ProcessingFailure, int64, error) {
	if s.err != nil {
		return nil, 0, s.err
	}
	return s.failures, s.total, nil
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

func executeGET(routePath string, requestPath string, handler gin.HandlerFunc) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET(routePath, handler)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, requestPath, nil)
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

func TestGetImportProcessingFailures(t *testing.T) {
	t.Run("returns bad request for invalid job type", func(t *testing.T) {
		h := NewLEIHandlerWithLevel2(&leiServiceStub{}, &leiLevel2ServiceStub{}, &schedulerServiceStub{})
		resp := executeGET("/level2/failures", "/level2/failures?jobType=INVALID", h.GetImportProcessingFailures)
		if resp.Code != http.StatusBadRequest {
			t.Fatalf("expected status %d, got %d", http.StatusBadRequest, resp.Code)
		}
	})

	t.Run("returns failures payload", func(t *testing.T) {
		stub := &leiLevel2ServiceStub{
			failures: []*domain.LEILevel2ProcessingFailure{
				{
					JobType:      "LEVEL2_RR",
					FailureStage: "UPSERT",
					NaturalKey:   "AAA|BBB|IS_DIRECTLY_CONSOLIDATED_BY",
					ErrorMessage: "duplicate key",
					Resolved:     false,
					CreatedAt:    time.Now(),
				},
			},
			total: 1,
		}
		h := NewLEIHandlerWithLevel2(&leiServiceStub{}, stub, &schedulerServiceStub{})
		resp := executeGET("/level2/failures", "/level2/failures?jobType=LEVEL2_RR&openOnly=true&limit=10&offset=0", h.GetImportProcessingFailures)
		if resp.Code != http.StatusOK {
			t.Fatalf("expected status %d, got %d", http.StatusOK, resp.Code)
		}
		body := resp.Body.String()
		if !strings.Contains(body, "LEVEL2_RR") || !strings.Contains(body, "\"total\":1") {
			t.Fatalf("unexpected response body: %s", body)
		}
	})
}

func TestGetLevel2ProcessingFailures_DeprecationHeaders(t *testing.T) {
	t.Parallel()

	stub := &leiLevel2ServiceStub{err: errors.New("db unavailable")}
	h := NewLEIHandlerWithLevel2(&leiServiceStub{}, stub, &schedulerServiceStub{})

	resp := executeGET("/level2/failures", "/level2/failures", h.GetLevel2ProcessingFailures)
	if resp.Code != http.StatusInternalServerError {
		t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, resp.Code)
	}
	if got := resp.Header().Get("Deprecation"); got != "true" {
		t.Fatalf("expected Deprecation header true, got %q", got)
	}
	if got := resp.Header().Get("Sunset"); got != "Tue, 30 Jun 2026 23:59:59 GMT" {
		t.Fatalf("unexpected Sunset header: %q", got)
	}
	if got := resp.Header().Get("Link"); !strings.Contains(got, "/api/v1/lei/import-failures") {
		t.Fatalf("expected Link header to point to new endpoint, got %q", got)
	}
	if got := resp.Header().Get("Warning"); !strings.Contains(got, "Deprecated API") {
		t.Fatalf("expected Warning header to mention deprecation, got %q", got)
	}
}

func TestGetPredecessorLEIs(t *testing.T) {
	t.Run("returns predecessor records", func(t *testing.T) {
		h := NewLEIHandler(&leiServiceStub{
			predecessors: []*domain.LEIRecord{
				{LEI: "AAA11111111111111111", LegalName: "Predecessor One", SuccessorLEI: "BBB22222222222222222"},
			},
		}, &schedulerServiceStub{})

		resp := executeGET("/lei/:lei/predecessors", "/lei/BBB22222222222222222/predecessors", h.GetPredecessorLEIs)
		if resp.Code != http.StatusOK {
			t.Fatalf("expected status %d, got %d", http.StatusOK, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "Predecessor One") {
			t.Fatalf("expected predecessor payload, got %s", resp.Body.String())
		}
	})

	t.Run("returns internal server error on service failure", func(t *testing.T) {
		h := NewLEIHandler(&leiServiceStub{predecessorErr: errors.New("db failure")}, &schedulerServiceStub{})

		resp := executeGET("/lei/:lei/predecessors", "/lei/BBB22222222222222222/predecessors", h.GetPredecessorLEIs)
		if resp.Code != http.StatusInternalServerError {
			t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, resp.Code)
		}
	})
}

func TestGetLegalNamesByLEICodes(t *testing.T) {
	t.Run("returns bad request when codes query is missing", func(t *testing.T) {
		h := NewLEIHandler(&leiServiceStub{}, &schedulerServiceStub{})

		resp := executeGET("/lei/names", "/lei/names", h.GetLegalNamesByLEICodes)
		if resp.Code != http.StatusBadRequest {
			t.Fatalf("expected status %d, got %d", http.StatusBadRequest, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "codes query parameter is required") {
			t.Fatalf("expected validation error, got %s", resp.Body.String())
		}
	})

	t.Run("returns bad request when codes query is empty after trimming", func(t *testing.T) {
		h := NewLEIHandler(&leiServiceStub{}, &schedulerServiceStub{})

		resp := executeGET("/lei/names", "/lei/names?codes=,%20,%20", h.GetLegalNamesByLEICodes)
		if resp.Code != http.StatusBadRequest {
			t.Fatalf("expected status %d, got %d", http.StatusBadRequest, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "codes query parameter is required") {
			t.Fatalf("expected validation error, got %s", resp.Body.String())
		}
	})

	t.Run("returns legal names for valid codes", func(t *testing.T) {
		stub := &leiServiceStub{
			legalNames: map[string]string{
				"AAA11111111111111111": "Entity A",
				"BBB22222222222222222": "Entity B",
			},
		}
		h := NewLEIHandler(stub, &schedulerServiceStub{})

		resp := executeGET(
			"/lei/names",
			"/lei/names?codes=AAA11111111111111111,%20BBB22222222222222222",
			h.GetLegalNamesByLEICodes,
		)
		if resp.Code != http.StatusOK {
			t.Fatalf("expected status %d, got %d", http.StatusOK, resp.Code)
		}

		if len(stub.receivedCodes) != 2 {
			t.Fatalf("expected 2 codes, got %d (%v)", len(stub.receivedCodes), stub.receivedCodes)
		}
		if stub.receivedCodes[0] != "AAA11111111111111111" || stub.receivedCodes[1] != "BBB22222222222222222" {
			t.Fatalf("expected trimmed codes, got %v", stub.receivedCodes)
		}
	})

	t.Run("returns internal server error on service failure", func(t *testing.T) {
		h := NewLEIHandler(&leiServiceStub{legalNamesErr: errors.New("db failure")}, &schedulerServiceStub{})

		resp := executeGET("/lei/names", "/lei/names?codes=AAA11111111111111111", h.GetLegalNamesByLEICodes)
		if resp.Code != http.StatusInternalServerError {
			t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, resp.Code)
		}
		if !strings.Contains(resp.Body.String(), "Failed to retrieve LEI names") {
			t.Fatalf("expected service error response, got %s", resp.Body.String())
		}
	})
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
			expectedMessage:   "Level 1 LEI Records sync triggered (DAILY_FULL)",
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
			expectedMessage:   "Level 2 Relationship Records sync triggered (LEVEL2_RR)",
			expectedScheduler: "TriggerLevel2RRSync",
		},
		{
			name:              "level2 repex accepted",
			path:              "/sync/level2/repex",
			handlerFactory:    func(h *LEIHandler) gin.HandlerFunc { return h.TriggerLevel2REPEXSync },
			expectedMessage:   "Level 2 Reporting Exceptions sync triggered (LEVEL2_REPEX)",
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
		if !strings.Contains(resp.Body.String(), "Failed to trigger Level 1 LEI Records sync (DAILY_FULL)") {
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
		if !strings.Contains(resp.Body.String(), "Failed to trigger Level 2 Relationship Records sync (LEVEL2_RR)") {
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
		if !strings.Contains(resp.Body.String(), "Failed to trigger Level 2 Reporting Exceptions sync (LEVEL2_REPEX)") {
			t.Fatalf("expected generic error message, got %s", resp.Body.String())
		}
	})
}
