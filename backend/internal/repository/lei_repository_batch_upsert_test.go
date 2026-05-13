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

	if !strings.Contains(stmt, "NULLIF(BTRIM(successor_lei::text), '')") {
		t.Fatalf("expected reconciliation SQL to normalize blank successor_lei values, got: %s", stmt)
	}

	if !strings.Contains(stmt, "NULLIF(BTRIM(managing_lou::text), '')") {
		t.Fatalf("expected reconciliation SQL to normalize blank managing_lou values, got: %s", stmt)
	}

	if !strings.Contains(stmt, "NULLIF(BTRIM(COALESCE(current.successor_lei, '')), '')") {
		t.Fatalf("expected reconciliation SQL to compare normalized successor_lei values, got: %s", stmt)
	}

	if !strings.Contains(stmt, "NULLIF(BTRIM(COALESCE(current.managing_lou, '')), '')") {
		t.Fatalf("expected reconciliation SQL to compare normalized managing_lou values, got: %s", stmt)
	}

	// Verify the SQL returns old field values for proper audit trail generation.
	if !strings.Contains(stmt, "old_successor_lei") {
		t.Fatalf("expected reconciliation SQL to return old_successor_lei for audit, got: %s", stmt)
	}
	if !strings.Contains(stmt, "old_managing_lou") {
		t.Fatalf("expected reconciliation SQL to return old_managing_lou for audit, got: %s", stmt)
	}
	if !strings.Contains(stmt, "new_successor_lei") {
		t.Fatalf("expected reconciliation SQL to return new_successor_lei for audit, got: %s", stmt)
	}
	if !strings.Contains(stmt, "new_managing_lou") {
		t.Fatalf("expected reconciliation SQL to return new_managing_lou for audit, got: %s", stmt)
	}
	if !strings.Contains(stmt, "before_values") {
		t.Fatalf("expected reconciliation SQL to include before_values CTE for pre-update snapshot, got: %s", stmt)
	}
}
