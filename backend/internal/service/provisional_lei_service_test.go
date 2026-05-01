package service

import (
	"encoding/json"
	"fmt"
	"regexp"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/repository"
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
		if _, scanErr := fmt.Sscanf(checkStr, "%d", &check); scanErr != nil {
			t.Fatalf("failed to parse check digits %q: %v", checkStr, scanErr)
		}
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

type provisionalRepoStub struct {
	repository.ProvisionalLEIRepository
	record       *domain.LEIRecord
	createCount  int
	updatedCount int
	succeedCount int
}

func (s *provisionalRepoStub) Create(record *domain.LEIRecord) error {
	s.createCount++
	copy := *record
	s.record = &copy
	return nil
}

func (s *provisionalRepoStub) FindByLEI(lei string) (*domain.LEIRecord, error) {
	if s.record == nil {
		return nil, nil
	}
	copy := *s.record
	return &copy, nil
}

func (s *provisionalRepoStub) Update(record *domain.LEIRecord) error {
	s.updatedCount++
	copy := *record
	s.record = &copy
	return nil
}

func (s *provisionalRepoStub) Succeed(provisionalLEI, officialLEI, changedBy string) error {
	if s.record == nil {
		return fmt.Errorf("provisional LEI %s not found", provisionalLEI)
	}
	if s.record.LEI != provisionalLEI {
		return fmt.Errorf("provisional LEI %s not found", provisionalLEI)
	}
	s.succeedCount++
	s.record.SuccessorLEI = officialLEI
	s.record.EntityStatus = "MERGED"
	s.record.UpdatedBy = changedBy
	return nil
}

type leiRepoAuditStub struct {
	repository.LEIRepository
	audits         []*domain.LEIRecordAudit
	officialRecord *domain.LEIRecord
}

func (s *leiRepoAuditStub) CreateAuditRecord(audit *domain.LEIRecordAudit) error {
	copy := *audit
	s.audits = append(s.audits, &copy)
	return nil
}

func (s *leiRepoAuditStub) FindLEIByLEI(lei string) (*domain.LEIRecord, error) {
	if s.officialRecord == nil || s.officialRecord.LEI != lei {
		return nil, nil
	}
	copy := *s.officialRecord
	return &copy, nil
}

type provisionalLevel2RepoStub struct {
	repository.LEILevel2Repository
}

func (s *provisionalLevel2RepoStub) FindRelationshipsByStartLEI(lei string) ([]*domain.LEIRelationshipRecord, error) {
	return nil, nil
}

func (s *provisionalLevel2RepoStub) FindRelationshipsByEndLEI(lei string) ([]*domain.LEIRelationshipRecord, error) {
	return nil, nil
}

func TestProvisionalUpdate_WritesLEIRecordAudit(t *testing.T) {
	recordID := uuid.New()
	provisionalRepo := &provisionalRepoStub{record: &domain.LEIRecord{
		ID:                  recordID,
		LEI:                 "AXIO1234567890123479",
		LegalName:           "Old Name Ltd",
		LegalAddressCountry: "GB",
		LegalAddressCity:    "London",
		LegalJurisdiction:   "GB",
		EntityStatus:        "ACTIVE",
		ProvisioningSource:  "manual",
		IsProvisional:       true,
	}}
	leiRepo := &leiRepoAuditStub{}
	level2Repo := &provisionalLevel2RepoStub{}

	svc := NewProvisionalLEIService(provisionalRepo, leiRepo, level2Repo)

	updated, err := svc.Update("AXIO1234567890123479", UpdateProvisionalLEIRequest{
		LegalName: "New Name Ltd",
	}, "admin-user")
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if updated == nil {
		t.Fatal("expected updated record, got nil")
	}
	if updated.LegalName != "New Name Ltd" {
		t.Fatalf("expected legal name to be updated, got %q", updated.LegalName)
	}

	if provisionalRepo.updatedCount != 1 {
		t.Fatalf("expected provisional repo update to be called once, got %d", provisionalRepo.updatedCount)
	}
	if len(leiRepo.audits) != 1 {
		t.Fatalf("expected one audit record, got %d", len(leiRepo.audits))
	}

	audit := leiRepo.audits[0]
	if audit.Action != "UPDATE" {
		t.Fatalf("expected audit action UPDATE, got %q", audit.Action)
	}
	if audit.LEIRecordID != recordID {
		t.Fatalf("expected LEIRecordID %s, got %s", recordID, audit.LEIRecordID)
	}
	if audit.LEI != "AXIO1234567890123479" {
		t.Fatalf("expected audit LEI AXIO1234567890123479, got %q", audit.LEI)
	}
	if audit.ChangedBy != "admin-user" {
		t.Fatalf("expected ChangedBy admin-user, got %q", audit.ChangedBy)
	}

	changed := map[string]map[string]string{}
	if err := json.Unmarshal([]byte(audit.ChangedFields), &changed); err != nil {
		t.Fatalf("failed to parse changed_fields JSON: %v", err)
	}
	nameChange, ok := changed["legal_name"]
	if !ok {
		t.Fatalf("expected legal_name change in changed_fields, got %v", changed)
	}
	if nameChange["old"] != "Old Name Ltd" || nameChange["new"] != "New Name Ltd" {
		t.Fatalf("unexpected legal_name change payload: %+v", nameChange)
	}
}

func TestProvisionalCreate_WritesLEIRecordAudit(t *testing.T) {
	provisionalRepo := &provisionalRepoStub{}
	leiRepo := &leiRepoAuditStub{}
	level2Repo := &provisionalLevel2RepoStub{}

	svc := NewProvisionalLEIService(provisionalRepo, leiRepo, level2Repo)

	created, err := svc.Create(CreateProvisionalLEIRequest{LegalName: "Create Name Ltd"}, "admin-user")
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if created == nil {
		t.Fatal("expected created record, got nil")
	}
	if provisionalRepo.createCount != 1 {
		t.Fatalf("expected provisional repo create to be called once, got %d", provisionalRepo.createCount)
	}
	if len(leiRepo.audits) != 1 {
		t.Fatalf("expected one audit record, got %d", len(leiRepo.audits))
	}

	audit := leiRepo.audits[0]
	if audit.Action != "CREATE" {
		t.Fatalf("expected audit action CREATE, got %q", audit.Action)
	}
	if audit.LEIRecordID != created.ID {
		t.Fatalf("expected LEIRecordID %s, got %s", created.ID, audit.LEIRecordID)
	}
	if audit.LEI != created.LEI {
		t.Fatalf("expected audit LEI %q, got %q", created.LEI, audit.LEI)
	}
	if audit.ChangedBy != "admin-user" {
		t.Fatalf("expected ChangedBy admin-user, got %q", audit.ChangedBy)
	}
}

func TestProvisionalSucceed_WritesLEIRecordAudit(t *testing.T) {
	recordID := uuid.New()
	provisionalRepo := &provisionalRepoStub{record: &domain.LEIRecord{
		ID:            recordID,
		LEI:           "AXIO1234567890123479",
		LegalName:     "Succeed Name Ltd",
		EntityStatus:  "ACTIVE",
		IsProvisional: true,
	}}
	leiRepo := &leiRepoAuditStub{officialRecord: &domain.LEIRecord{LEI: "529900T8BM49AURSDO55"}}
	level2Repo := &provisionalLevel2RepoStub{}

	svc := NewProvisionalLEIService(provisionalRepo, leiRepo, level2Repo)

	err := svc.Succeed("AXIO1234567890123479", "529900T8BM49AURSDO55", "admin-user")
	if err != nil {
		t.Fatalf("Succeed returned error: %v", err)
	}
	if provisionalRepo.succeedCount != 1 {
		t.Fatalf("expected provisional repo succeed to be called once, got %d", provisionalRepo.succeedCount)
	}
	if len(leiRepo.audits) != 1 {
		t.Fatalf("expected one audit record, got %d", len(leiRepo.audits))
	}

	audit := leiRepo.audits[0]
	if audit.Action != "UPDATE" {
		t.Fatalf("expected audit action UPDATE, got %q", audit.Action)
	}

	changed := map[string]map[string]string{}
	if err := json.Unmarshal([]byte(audit.ChangedFields), &changed); err != nil {
		t.Fatalf("failed to parse changed_fields JSON: %v", err)
	}
	statusChange, ok := changed["entity_status"]
	if !ok {
		t.Fatalf("expected entity_status change in changed_fields, got %v", changed)
	}
	if statusChange["old"] != "ACTIVE" || statusChange["new"] != "MERGED" {
		t.Fatalf("unexpected entity_status change payload: %+v", statusChange)
	}
	successorChange, ok := changed["successor_lei"]
	if !ok {
		t.Fatalf("expected successor_lei change in changed_fields, got %v", changed)
	}
	if successorChange["old"] != "" || successorChange["new"] != "529900T8BM49AURSDO55" {
		t.Fatalf("unexpected successor_lei change payload: %+v", successorChange)
	}
}
