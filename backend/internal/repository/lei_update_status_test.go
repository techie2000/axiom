package repository

import (
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
)

// ---------------------------------------------------------------------------
// UpdateProcessingStatus – DryRun SQL shape tests
//
// These tests use the DryRun GORM infrastructure (newBatchLeiRepo) defined
// in lei_batch_resolve_test.go to assert that the generated UPDATE statement
// always includes both current_source_file_id (even when nil, so the DB
// receives an explicit NULL) and progress_message.
// ---------------------------------------------------------------------------

func TestUpdateProcessingStatus_NilCurrentSourceFileIDWritesNULL(t *testing.T) {
	r, cap := newBatchLeiRepo(t)

	status := &domain.FileProcessingStatus{
		ID:                  uuid.New(),
		JobType:             "DAILY_FULL",
		Status:              "RUNNING",
		CurrentSourceFileID: nil, // must be present in SET clause so DB receives NULL
	}

	_ = r.UpdateProcessingStatus(status)

	sql := cap.last()
	if sql == "" {
		t.Fatal("expected GORM to produce a SQL statement, but captured SQL is empty")
	}
	if !strings.Contains(sql, "current_source_file_id") {
		t.Errorf("expected UPDATE to include current_source_file_id (for explicit NULL write), SQL: %s", sql)
	}
	if !strings.Contains(sql, "WHERE") {
		t.Errorf("expected UPDATE to have a WHERE clause, SQL: %s", sql)
	}
}

func TestUpdateProcessingStatus_ProgressMessageIncludedInSET(t *testing.T) {
	r, cap := newBatchLeiRepo(t)

	status := &domain.FileProcessingStatus{
		ID:              uuid.New(),
		JobType:         "DAILY_FULL",
		Status:          "RUNNING",
		ProgressMessage: "Downloading lei_full_20240101.zip",
	}

	_ = r.UpdateProcessingStatus(status)

	sql := cap.last()
	if sql == "" {
		t.Fatal("expected GORM to produce a SQL statement, but captured SQL is empty")
	}
	if !strings.Contains(sql, "progress_message") {
		t.Errorf("expected UPDATE to include progress_message in SET clause, SQL: %s", sql)
	}
}

func TestUpdateProcessingStatus_EmptyProgressMessageIncludedInSET(t *testing.T) {
	r, cap := newBatchLeiRepo(t)

	status := &domain.FileProcessingStatus{
		ID:              uuid.New(),
		JobType:         "DAILY_FULL",
		Status:          "COMPLETED",
		ProgressMessage: "",
	}

	_ = r.UpdateProcessingStatus(status)

	sql := cap.last()
	if sql == "" {
		t.Fatal("expected GORM to produce a SQL statement, but captured SQL is empty")
	}
	if !strings.Contains(sql, "progress_message") {
		t.Errorf("expected UPDATE to include progress_message even when empty, SQL: %s", sql)
	}
}

func TestUpdateProcessingStatus_UpdatedAtUsesDBExpression(t *testing.T) {
	r, cap := newBatchLeiRepo(t)

	status := &domain.FileProcessingStatus{
		ID:      uuid.New(),
		JobType: "DAILY_DELTA",
		Status:  "IDLE",
	}

	_ = r.UpdateProcessingStatus(status)

	sql := cap.last()
	if sql == "" {
		t.Fatal("expected GORM to produce a SQL statement, but captured SQL is empty")
	}
	if !strings.Contains(sql, "updated_at") {
		t.Errorf("expected UPDATE to set updated_at, SQL: %s", sql)
	}
	// The DryRun dialector renders NOW() as-is, confirming gorm.Expr is used rather
	// than a bound application-side timestamp value (which would appear as ?).
	if !strings.Contains(sql, "NOW()") {
		t.Errorf("expected updated_at to use NOW() DB expression (not a bound ? value), SQL: %s", sql)
	}
}

func TestUpdateProcessingStatus_NilStatusReturnsError(t *testing.T) {
	r := &leiRepository{}

	err := r.UpdateProcessingStatus(nil)
	if err == nil {
		t.Fatal("expected error for nil status, got nil")
	}
}

func TestUpdateProcessingStatus_WheresOnID(t *testing.T) {
	r, cap := newBatchLeiRepo(t)

	id := uuid.New()
	status := &domain.FileProcessingStatus{
		ID:      id,
		JobType: "DAILY_FULL",
		Status:  "IDLE",
	}

	_ = r.UpdateProcessingStatus(status)

	sql := cap.last()
	if !strings.Contains(sql, "WHERE") {
		t.Errorf("expected UPDATE to have a WHERE clause scoped to the row ID, SQL: %s", sql)
	}
	if !strings.Contains(sql, "id") {
		t.Errorf("expected WHERE clause to reference id column, SQL: %s", sql)
	}
}
