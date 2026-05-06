package repository

import (
	"strings"
	"testing"
)

func TestBatchUpsertLEIRecords_DefersSelfReferentialColumns(t *testing.T) {
	stmt := buildLEIRecordBatchUpsertSQL("(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")

	if strings.Contains(stmt, "successor_lei") {
		t.Fatalf("expected primary upsert SQL to defer successor_lei, got: %s", stmt)
	}

	if strings.Contains(stmt, "managing_lou") {
		t.Fatalf("expected primary upsert SQL to defer managing_lou, got: %s", stmt)
	}
}

func TestBatchUpdateLEILinkReferences_SQLShape(t *testing.T) {
	stmt := buildLEILinkReferenceUpdateSQL("(?, ?, ?)")

	if !strings.Contains(stmt, "successor_lei = link_updates.successor_lei") {
		t.Fatalf("expected reconciliation SQL to update successor_lei, got: %s", stmt)
	}

	if !strings.Contains(stmt, "managing_lou = link_updates.managing_lou") {
		t.Fatalf("expected reconciliation SQL to update managing_lou, got: %s", stmt)
	}
}