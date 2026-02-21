package repository

import "testing"

func TestApplyEntityPreloadsIncludesExpectedRelations(t *testing.T) {
	t.Helper()

	expected := map[string]struct{}{
		"Addresses":                 {},
		"Addresses.Address":         {},
		"Addresses.Address.Country": {},
	}

	if len(entityRelationPreloads) != len(expected) {
		t.Fatalf("expected %d preloads, got %d", len(expected), len(entityRelationPreloads))
	}

	for _, preload := range entityRelationPreloads {
		if _, ok := expected[preload]; !ok {
			t.Fatalf("unexpected preload relation: %s", preload)
		}
	}
}

func TestApplyEntityPreloadsExcludesUnsupportedSingularAddress(t *testing.T) {
	t.Helper()

	for _, preload := range entityRelationPreloads {
		if preload == "Address" || preload == "Address.Country" {
			t.Fatalf("unsupported singular preload relation found: %s", preload)
		}
	}
}
