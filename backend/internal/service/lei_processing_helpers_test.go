package service

import (
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
)

// failureRepoStub captures the last CreateProcessingFailure call and optionally returns an error.
type failureRepoStub struct {
	captured *domain.LEILevel2ProcessingFailure
	returnErr error
}

func (s *failureRepoStub) CreateProcessingFailure(f *domain.LEILevel2ProcessingFailure) error {
	s.captured = f
	return s.returnErr
}

func TestPersistProcessingFailure_AllFieldsPopulated(t *testing.T) {
	repo := &failureRepoStub{}
	id := uuid.New()

	persistProcessingFailure(
		repo,
		"DAILY_FULL",
		&id,
		"UPSERT",
		"5493001KJTIIGC8Y1R12",
		map[string]string{"lei": "5493001KJTIIGC8Y1R12"},
		errors.New("db error"),
	)

	f := repo.captured
	if f == nil {
		t.Fatal("expected CreateProcessingFailure to be called, but it was not")
	}
	if f.JobType != "DAILY_FULL" {
		t.Errorf("JobType: want %q, got %q", "DAILY_FULL", f.JobType)
	}
	if f.SourceFileID != &id {
		t.Errorf("SourceFileID: want %v, got %v", &id, f.SourceFileID)
	}
	if f.FailureStage != "UPSERT" {
		t.Errorf("FailureStage: want %q, got %q", "UPSERT", f.FailureStage)
	}
	if f.NaturalKey != "5493001KJTIIGC8Y1R12" {
		t.Errorf("NaturalKey: want %q, got %q", "5493001KJTIIGC8Y1R12", f.NaturalKey)
	}
	if f.ErrorMessage != "db error" {
		t.Errorf("ErrorMessage: want %q, got %q", "db error", f.ErrorMessage)
	}
	if f.Resolved {
		t.Error("Resolved: want false, got true")
	}
	if len(f.RawRecord) == 0 {
		t.Error("RawRecord: want non-empty JSON payload, got empty")
	}
}

func TestPersistProcessingFailure_NilCauseDefaultsMessage(t *testing.T) {
	repo := &failureRepoStub{}

	persistProcessingFailure(repo, "DAILY_FULL", nil, "MAP", "ABC", nil, nil)

	if repo.captured == nil {
		t.Fatal("expected CreateProcessingFailure to be called")
	}
	if repo.captured.ErrorMessage != "unknown processing failure" {
		t.Errorf("ErrorMessage: want %q, got %q", "unknown processing failure", repo.captured.ErrorMessage)
	}
}

func TestPersistProcessingFailure_NilRawRecordProducesEmptyPayload(t *testing.T) {
	repo := &failureRepoStub{}

	persistProcessingFailure(repo, "DAILY_FULL", nil, "DOWNLOAD", "ABC", nil, errors.New("network timeout"))

	if repo.captured == nil {
		t.Fatal("expected CreateProcessingFailure to be called")
	}
	if repo.captured.RawRecord != "" {
		t.Errorf("RawRecord: want empty JSONBString, got %q", repo.captured.RawRecord)
	}
}

func TestPersistProcessingFailure_RawRecordMarshaled(t *testing.T) {
	repo := &failureRepoStub{}
	type payload struct {
		LEI string `json:"lei"`
	}

	persistProcessingFailure(repo, "LEVEL2_RR", nil, "PARSE", "key", &payload{LEI: "XYZ"}, nil)

	if repo.captured == nil {
		t.Fatal("expected CreateProcessingFailure to be called")
	}
	// The JSON encoding of {LEI: "XYZ"} must appear in the raw payload.
	want := `"lei":"XYZ"`
	got := string(repo.captured.RawRecord)
	if len(got) == 0 {
		t.Fatalf("RawRecord: want JSON payload containing %q, got empty", want)
	}
	if !strings.Contains(got, want) {
		t.Errorf("RawRecord: want payload containing %q, got %q", want, got)
	}
}

func TestPersistProcessingFailure_RepoErrorDoesNotPanic(t *testing.T) {
	repo := &failureRepoStub{returnErr: errors.New("connection refused")}

	// Must not panic — failure to persist is logged and swallowed.
	persistProcessingFailure(repo, "DAILY_FULL", nil, "UPSERT", "KEY", nil, errors.New("original error"))

	if repo.captured == nil {
		t.Fatal("expected CreateProcessingFailure to be called even when it returns an error")
	}
}

func TestPersistProcessingFailure_NilSourceFileID(t *testing.T) {
	repo := &failureRepoStub{}

	persistProcessingFailure(repo, "DAILY_FULL", nil, "MAP", "KEY", nil, nil)

	if repo.captured == nil {
		t.Fatal("expected CreateProcessingFailure to be called")
	}
	if repo.captured.SourceFileID != nil {
		t.Errorf("SourceFileID: want nil, got %v", repo.captured.SourceFileID)
	}
}
