package service

import (
	"fmt"
	"regexp"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
)

// ---------------------------------------------------------------------------
// generateProvisionalLEI tests
// ---------------------------------------------------------------------------

func TestGenerateProvisionalLEI_Format(t *testing.T) {
	lei, err := generateProvisionalLEI()
	if err != nil {
		t.Fatalf("generateProvisionalLEI returned error: %v", err)
	}
	if len(lei) != 20 {
		t.Errorf("expected LEI length 20, got %d: %q", len(lei), lei)
	}
	if lei[:4] != "AXIO" {
		t.Errorf("expected AXIO prefix, got %q", lei[:4])
	}
	matched, _ := regexp.MatchString(`^[A-Z0-9]{20}$`, lei)
	if !matched {
		t.Errorf("LEI %q contains invalid characters", lei)
	}
}

func TestGenerateProvisionalLEI_Uniqueness(t *testing.T) {
	seen := make(map[string]struct{}, 100)
	for i := 0; i < 100; i++ {
		lei, err := generateProvisionalLEI()
		if err != nil {
			t.Fatalf("generateProvisionalLEI[%d] error: %v", i, err)
		}
		if _, dup := seen[lei]; dup {
			t.Errorf("duplicate LEI generated: %q", lei)
		}
		seen[lei] = struct{}{}
	}
}

func TestGenerateProvisionalLEI_CheckDigits(t *testing.T) {
	for i := 0; i < 20; i++ {
		lei, err := generateProvisionalLEI()
		if err != nil {
			t.Fatalf("generateProvisionalLEI error: %v", err)
		}
		// Verify the check digits are in range [02, 98].
		// Per ISO 17442, valid check digit values are 02–97 (01 and 00 are reserved).
		// We relax to allow 02–98 which is what MOD 97 can produce.
		checkStr := lei[18:]
		var check int
		fmt.Sscanf(checkStr, "%d", &check)
		if check < 2 || check > 98 {
			t.Errorf("check digits %q (%d) out of valid range [2,98] for LEI %q", checkStr, check, lei)
		}
	}
}

// ---------------------------------------------------------------------------
// iso17442CheckDigits tests
// ---------------------------------------------------------------------------

func TestIso17442CheckDigits_KnownValue(t *testing.T) {
	// Build a synthetic 18-char string, compute check digits, then verify
	// that treating the full 20-char code modulo 97 == 1 (ISO 17442 invariant).
	raw18 := "AXIO12345678901234"
	check := iso17442CheckDigits(raw18)
	if check < 2 || check > 97 {
		t.Errorf("check digits %d out of valid range [2,97]", check)
	}

	// Verify the full code passes the ISO 17442 invariant: MOD 97 of the
	// numeric representation of the full 20-char code == 1.
	full20 := fmt.Sprintf("%s%02d", raw18, check)
	var sb string
	for _, ch := range full20 {
		if ch >= 'A' && ch <= 'Z' {
			sb += fmt.Sprintf("%d", int(ch-'A')+10)
		} else {
			sb += string(ch)
		}
	}
	mod := computeMod97(sb)
	if mod != 1 {
		t.Errorf("ISO 17442 invariant violated: MOD 97 of full code = %d (want 1)", mod)
	}
}

// ---------------------------------------------------------------------------
// isValidEntityRole tests
// ---------------------------------------------------------------------------

func TestIsValidEntityRole_ValidRoles(t *testing.T) {
	valid := []domain.EntityRole{
		domain.EntityRoleViewer,
		domain.EntityRoleTrader,
		domain.EntityRoleEntityAdmin,
	}
	for _, role := range valid {
		if !isValidEntityRole(role) {
			t.Errorf("expected role %q to be valid", role)
		}
	}
}

func TestIsValidEntityRole_InvalidRole(t *testing.T) {
	invalid := []domain.EntityRole{"superuser", "", "ADMIN", "read"}
	for _, role := range invalid {
		if isValidEntityRole(role) {
			t.Errorf("expected role %q to be invalid", role)
		}
	}
}

// ---------------------------------------------------------------------------
// UserEntityLink.IsActive tests (domain model helper)
// ---------------------------------------------------------------------------

func TestUserEntityLink_IsActive_Active(t *testing.T) {
	link := &domain.UserEntityLink{
		ID:         uuid.New(),
		UserID:     uuid.New(),
		LEI:        "AXIO00000000000001AB",
		EntityRole: domain.EntityRoleViewer,
	}
	if !link.IsActive() {
		t.Error("expected active link to be active")
	}
}

func TestUserEntityLink_IsActive_Revoked(t *testing.T) {
	now := time.Now()
	link := &domain.UserEntityLink{
		ID:        uuid.New(),
		RevokedAt: &now,
	}
	if link.IsActive() {
		t.Error("expected revoked link to not be active")
	}
}

func TestUserEntityLink_IsActive_Expired(t *testing.T) {
	past := time.Now().Add(-time.Hour)
	link := &domain.UserEntityLink{
		ID:        uuid.New(),
		ExpiresAt: &past,
	}
	if link.IsActive() {
		t.Error("expected expired link to not be active")
	}
}

func TestUserEntityLink_IsActive_NotYetExpired(t *testing.T) {
	future := time.Now().Add(time.Hour)
	link := &domain.UserEntityLink{
		ID:        uuid.New(),
		ExpiresAt: &future,
	}
	if !link.IsActive() {
		t.Error("expected link with future expiry to be active")
	}
}

func TestNormalizeRelationshipInputs_Valid(t *testing.T) {
	parent, child, err := normalizeRelationshipInputs(
		"  529900T8BM49AURSDO55  ",
		"213800D1EI4B9WTWWD28",
		"AXIO1234567890123479",
	)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if parent != "529900T8BM49AURSDO55" {
		t.Fatalf("unexpected parent LEI: %s", parent)
	}
	if child != "213800D1EI4B9WTWWD28" {
		t.Fatalf("unexpected child LEI: %s", child)
	}
}

func TestNormalizeRelationshipInputs_RejectsSelfAsParent(t *testing.T) {
	_, _, err := normalizeRelationshipInputs("AXIO1234567890123479", "", "AXIO1234567890123479")
	if err == nil {
		t.Fatal("expected self-parent error")
	}
}

func TestNormalizeRelationshipInputs_RejectsMatchingParentAndChild(t *testing.T) {
	_, _, err := normalizeRelationshipInputs(
		"529900T8BM49AURSDO55",
		"529900T8BM49AURSDO55",
		"AXIO1234567890123479",
	)
	if err == nil {
		t.Fatal("expected matching parent/child error")
	}
}

func TestValidateLEIFormat_InvalidLength(t *testing.T) {
	err := validateLEIFormat("SHORT")
	if err == nil {
		t.Fatal("expected length validation error")
	}
}
