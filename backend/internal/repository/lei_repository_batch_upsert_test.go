package repository

import (
	"encoding/json"
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

	if !strings.Contains(stmt, "successor_lei = lu.successor_lei") {
		t.Fatalf("expected reconciliation SQL to update successor_lei, got: %s", stmt)
	}

	if !strings.Contains(stmt, "managing_lou = lu.managing_lou") {
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
	if !strings.Contains(stmt, "JOIN before_values AS bv") {
		t.Fatalf("expected reconciliation SQL to join before_values within UPDATE for explicit dependency, got: %s", stmt)
	}
}

func TestBuildLinkReferenceAuditPayload_SingleFieldChange(t *testing.T) {
	oldSuccessor := ""
	newSuccessor := "5493001KJTIIGC6D1234"
	oldManaging := "5493001KJTIIGC6D9999"
	newManaging := "5493001KJTIIGC6D9999"

	changedFields, snapshot, err := buildLinkReferenceAuditPayload(
		"AXIO0000000001234567",
		&oldSuccessor,
		&oldManaging,
		&newSuccessor,
		&newManaging,
	)
	if err != nil {
		t.Fatalf("expected payload builder to succeed, got error: %v", err)
	}

	var changedFieldsMap map[string]map[string]interface{}
	if err := json.Unmarshal([]byte(changedFields), &changedFieldsMap); err != nil {
		t.Fatalf("expected changed_fields JSON to unmarshal, got: %v", err)
	}
	if len(changedFieldsMap) != 1 {
		t.Fatalf("expected one changed field, got: %d", len(changedFieldsMap))
	}
	if changedFieldsMap["successor_lei"]["old_value"] != "" || changedFieldsMap["successor_lei"]["new_value"] != newSuccessor {
		t.Fatalf("expected successor_lei old/new to match, got: %#v", changedFieldsMap["successor_lei"])
	}

	var snapshotMap map[string]string
	if err := json.Unmarshal([]byte(snapshot), &snapshotMap); err != nil {
		t.Fatalf("expected snapshot JSON to unmarshal, got: %v", err)
	}
	if snapshotMap["lei"] != "AXIO0000000001234567" {
		t.Fatalf("expected snapshot lei to match, got: %s", snapshotMap["lei"])
	}
}

func TestBuildLinkReferenceAuditPayload_BothFieldsChange(t *testing.T) {
	oldSuccessor := "5493001KJTIIGC6D1111"
	newSuccessor := "5493001KJTIIGC6D2222"
	oldManaging := "5493001KJTIIGC6D3333"
	newManaging := "5493001KJTIIGC6D4444"

	changedFields, _, err := buildLinkReferenceAuditPayload(
		"AXIO0000000007654321",
		&oldSuccessor,
		&oldManaging,
		&newSuccessor,
		&newManaging,
	)
	if err != nil {
		t.Fatalf("expected payload builder to succeed, got error: %v", err)
	}

	var changedFieldsMap map[string]map[string]interface{}
	if err := json.Unmarshal([]byte(changedFields), &changedFieldsMap); err != nil {
		t.Fatalf("expected changed_fields JSON to unmarshal, got: %v", err)
	}
	if len(changedFieldsMap) != 2 {
		t.Fatalf("expected two changed fields, got: %d", len(changedFieldsMap))
	}
}

func TestBuildLinkReferenceAuditPayload_NilBlankNormalization(t *testing.T) {
	oldSuccessor := "   "
	newSuccessor := ""
	oldManaging := "\t"
	newManaging := "  "

	changedFields, snapshot, err := buildLinkReferenceAuditPayload(
		"AXIO0000000009999999",
		&oldSuccessor,
		&oldManaging,
		&newSuccessor,
		&newManaging,
	)
	if err != nil {
		t.Fatalf("expected payload builder to succeed, got error: %v", err)
	}

	var changedFieldsMap map[string]map[string]interface{}
	if err := json.Unmarshal([]byte(changedFields), &changedFieldsMap); err != nil {
		t.Fatalf("expected changed_fields JSON to unmarshal, got: %v", err)
	}
	if len(changedFieldsMap) != 0 {
		t.Fatalf("expected no changes after blank normalization, got: %#v", changedFieldsMap)
	}

	var snapshotMap map[string]string
	if err := json.Unmarshal([]byte(snapshot), &snapshotMap); err != nil {
		t.Fatalf("expected snapshot JSON to unmarshal, got: %v", err)
	}
	if snapshotMap["successor_lei"] != "" || snapshotMap["managing_lou"] != "" {
		t.Fatalf("expected normalized blank snapshot values, got: %#v", snapshotMap)
	}
}
