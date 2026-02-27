package service

import (
"errors"
"testing"

"github.com/google/uuid"
"github.com/techie2000/axiom/internal/repository"
)

// ---------------------------------------------------------------------------
// Stub for BatchResolveOpenProcessingFailures (Level 2 service layer)
//
// Uses a separate struct from the base-branch level2RepoStub to avoid any
// naming conflicts when both test files are compiled together after merge.
// ---------------------------------------------------------------------------

// level2BatchRepoStub embeds LEILevel2Repository and overrides
// BatchResolveOpenProcessingFailures for assertion-based testing.
type level2BatchRepoStub struct {
repository.LEILevel2Repository
calledJobType  string
calledKeys     []string
calledSourceID *uuid.UUID
calledNote     string
returnErr      error
callCount      int
}

func (r *level2BatchRepoStub) BatchResolveOpenProcessingFailures(jobType string, naturalKeys []string, resolvedSourceFileID *uuid.UUID, resolvedNote string) error {
r.callCount++
r.calledJobType = jobType
r.calledKeys = naturalKeys
r.calledSourceID = resolvedSourceFileID
r.calledNote = resolvedNote
return r.returnErr
}

func newLevel2BatchSvc(stub *level2BatchRepoStub) *leiLevel2Service {
return &leiLevel2Service{repo: stub}
}

// ---------------------------------------------------------------------------
// TestBatchResolveOpenProcessingFailures (Level 2 service layer)
// ---------------------------------------------------------------------------

func TestBatchResolveLevel2Service_EmptyKeysNoOp(t *testing.T) {
stub := &level2BatchRepoStub{}
svc := newLevel2BatchSvc(stub)

svc.batchResolveOpenProcessingFailures("LEVEL2_RR", []string{}, nil)

if stub.callCount != 0 {
t.Errorf("expected 0 repo calls for empty keys, got %d", stub.callCount)
}
}

func TestBatchResolveLevel2Service_ValidKeysCallsRepo(t *testing.T) {
stub := &level2BatchRepoStub{}
svc := newLevel2BatchSvc(stub)

sfID := uuid.New()
svc.batchResolveOpenProcessingFailures("LEVEL2_RR", []string{"K1", "K2"}, &sfID)

if stub.callCount != 1 {
t.Fatalf("expected 1 repo call, got %d", stub.callCount)
}
if stub.calledJobType != "LEVEL2_RR" {
t.Errorf("calledJobType = %q, want %q", stub.calledJobType, "LEVEL2_RR")
}
if len(stub.calledKeys) != 2 {
t.Errorf("expected 2 keys forwarded, got %d", len(stub.calledKeys))
}
}

func TestBatchResolveLevel2Service_JobTypeForwardedCorrectly(t *testing.T) {
stub := &level2BatchRepoStub{}
svc := newLevel2BatchSvc(stub)

svc.batchResolveOpenProcessingFailures("LEVEL2_REPEX", []string{"X|Y"}, nil)

if stub.calledJobType != "LEVEL2_REPEX" {
t.Errorf("expected job type LEVEL2_REPEX, got %q", stub.calledJobType)
}
}

func TestBatchResolveLevel2Service_RepoErrorDoesNotPanic(t *testing.T) {
stub := &level2BatchRepoStub{returnErr: errors.New("db error")}
svc := newLevel2BatchSvc(stub)

// Must not panic; errors are logged but not propagated.
svc.batchResolveOpenProcessingFailures("LEVEL2_RR", []string{"K1"}, nil)

if stub.callCount != 1 {
t.Errorf("expected 1 repo call even on error, got %d", stub.callCount)
}
}
