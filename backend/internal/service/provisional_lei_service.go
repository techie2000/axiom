package service

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/repository"
)

// ProvisionalLEIService manages Axiom-issued provisional LEI records.
// See ADR-0018 for the full design rationale.
type ProvisionalLEIService interface {
	// Create generates a new provisional LEI record with an AXIO-prefixed code.
	Create(req CreateProvisionalLEIRequest, adminUserID string) (*domain.LEIRecord, error)
	// Update modifies the mutable fields of an existing provisional LEI record.
	Update(lei string, req UpdateProvisionalLEIRequest, adminUserID string) (*domain.LEIRecord, error)
	// Succeed marks a provisional LEI as succeeded by an official GLEIF LEI.
	// Sets successor_lei = officialLEI and entity_status = "MERGED".
	Succeed(provisionalLEI, officialLEI, adminUserID string) error
	// Get returns a single provisional LEI record by code.
	Get(lei string) (*domain.LEIRecord, error)
	// List returns all provisional LEI records with pagination.
	List(limit, offset int) ([]*domain.LEIRecord, int64, error)
}

// CreateProvisionalLEIRequest holds the fields required to create a provisional LEI.
type CreateProvisionalLEIRequest struct {
	LegalName           string `json:"legal_name" binding:"required"`
	LegalAddressCountry string `json:"legal_address_country"`
	LegalAddressCity    string `json:"legal_address_city"`
	LegalJurisdiction   string `json:"legal_jurisdiction"`
	ProvisioningSource  string `json:"provisioning_source"` // e.g. "onboarding", "counterparty"
	ParentLEI           string `json:"parent_lei"`
	ChildLEI            string `json:"child_lei"`
	Notes               string `json:"notes"`
}

// UpdateProvisionalLEIRequest holds the fields that may be changed after creation.
type UpdateProvisionalLEIRequest struct {
	LegalName           string `json:"legal_name"`
	LegalAddressCountry string `json:"legal_address_country"`
	LegalAddressCity    string `json:"legal_address_city"`
	LegalJurisdiction   string `json:"legal_jurisdiction"`
	EntityStatus        string `json:"entity_status"`
	ProvisioningSource  string `json:"provisioning_source"`
	ParentLEI           string `json:"parent_lei"`
	ChildLEI            string `json:"child_lei"`
}

type provisionalLEIService struct {
	repo       repository.ProvisionalLEIRepository
	leiRepo    repository.LEIRepository
	level2Repo repository.LEILevel2Repository
}

// NewProvisionalLEIService creates a ProvisionalLEIService.
func NewProvisionalLEIService(
	repo repository.ProvisionalLEIRepository,
	leiRepo repository.LEIRepository,
	level2Repo repository.LEILevel2Repository,
) ProvisionalLEIService {
	return &provisionalLEIService{repo: repo, leiRepo: leiRepo, level2Repo: level2Repo}
}

func (s *provisionalLEIService) Create(req CreateProvisionalLEIRequest, adminUserID string) (*domain.LEIRecord, error) {
	code, err := generateProvisionalLEI()
	if err != nil {
		return nil, fmt.Errorf("generate provisional LEI code: %w", err)
	}

	parentLEI, childLEI, err := normalizeRelationshipInputs(req.ParentLEI, req.ChildLEI, code)
	if err != nil {
		return nil, err
	}

	if err := s.validateRelatedLEI(parentLEI); err != nil {
		return nil, err
	}
	if err := s.validateRelatedLEI(childLEI); err != nil {
		return nil, err
	}

	log.Debug().
		Str("generated_lei", code).
		Int("lei_length", len(code)).
		Msg("LEI code generated")

	record := &domain.LEIRecord{
		ID:                      uuid.New(),
		LEI:                     code,
		LegalName:               req.LegalName,
		LegalAddressCountry:     req.LegalAddressCountry,
		LegalAddressCity:        req.LegalAddressCity,
		LegalJurisdiction:       req.LegalJurisdiction,
		EntityStatus:            "ACTIVE",
		RegistrationStatus:      "ISSUED",
		IsProvisional:           true,
		ProvisioningSource:      req.ProvisioningSource,
		CreatedBy:               adminUserID,
		UpdatedBy:               adminUserID,
		InitialRegistrationDate: time.Now().UTC(),
		LastUpdateDate:          time.Now().UTC(),
		NextRenewalDate:         time.Now().UTC().AddDate(1, 0, 0),
		CreatedAt:               time.Now().UTC(),
		UpdatedAt:               time.Now().UTC(),
	}

	if err := s.repo.Create(record); err != nil {
		return nil, fmt.Errorf("persist provisional LEI record: %w", err)
	}

	if err := s.upsertParentChildRelationships(code, parentLEI, childLEI); err != nil {
		return nil, err
	}

	if err := s.hydrateRelationship(record); err != nil {
		log.Warn().Err(err).Str("lei", code).Msg("failed to hydrate relationship after create")
	}

	if err := s.createProvisionalAudit("CREATE", nil, record, adminUserID); err != nil {
		return nil, fmt.Errorf("create provisional LEI audit for %s: %w", code, err)
	}

	log.Info().
		Str("lei", code).
		Str("legal_name", req.LegalName).
		Str("created_by", adminUserID).
		Msg("provisional LEI created")

	return record, nil
}

func (s *provisionalLEIService) Update(lei string, req UpdateProvisionalLEIRequest, adminUserID string) (*domain.LEIRecord, error) {
	normalizedLEI := strings.ToUpper(strings.TrimSpace(lei))
	record, err := s.repo.FindByLEI(lei)
	if err != nil {
		return nil, fmt.Errorf("fetch provisional LEI %s: %w", lei, err)
	}
	if record == nil {
		return nil, fmt.Errorf("provisional LEI %s not found", lei)
	}
	before := *record

	// Hydrate before with old relationships for audit comparison
	if hydrateErr := s.hydrateRelationship(&before); hydrateErr != nil {
		log.Warn().Err(hydrateErr).Str("lei", lei).Msg("failed to hydrate before relationships for audit")
	}

	parentLEI, childLEI, err := normalizeRelationshipInputs(req.ParentLEI, req.ChildLEI, normalizedLEI)
	if err != nil {
		return nil, err
	}

	if err := s.validateRelatedLEI(parentLEI); err != nil {
		return nil, err
	}
	if err := s.validateRelatedLEI(childLEI); err != nil {
		return nil, err
	}

	if req.LegalName != "" {
		record.LegalName = req.LegalName
	}
	if req.LegalAddressCountry != "" {
		record.LegalAddressCountry = req.LegalAddressCountry
	}
	if req.LegalAddressCity != "" {
		record.LegalAddressCity = req.LegalAddressCity
	}
	if req.LegalJurisdiction != "" {
		record.LegalJurisdiction = req.LegalJurisdiction
	}
	if req.EntityStatus != "" {
		record.EntityStatus = req.EntityStatus
	}
	if req.ProvisioningSource != "" {
		record.ProvisioningSource = req.ProvisioningSource
	}
	record.UpdatedBy = adminUserID
	record.LastUpdateDate = time.Now().UTC()

	if err := s.repo.Update(record); err != nil {
		return nil, fmt.Errorf("update provisional LEI %s: %w", lei, err)
	}

	if err := s.upsertParentChildRelationships(normalizedLEI, parentLEI, childLEI); err != nil {
		return nil, err
	}

	if err := s.hydrateRelationship(record); err != nil {
		log.Warn().Err(err).Str("lei", lei).Msg("failed to hydrate relationship after update")
	}

	if err := s.createProvisionalAudit("UPDATE", &before, record, adminUserID); err != nil {
		return nil, fmt.Errorf("create provisional LEI audit for %s: %w", lei, err)
	}

	log.Info().Str("lei", lei).Str("updated_by", adminUserID).Msg("provisional LEI updated")
	return record, nil
}

func (s *provisionalLEIService) createProvisionalAudit(action string, before, after *domain.LEIRecord, adminUserID string) error {
	if after == nil {
		return nil
	}

	changedFieldsJSON := domain.JSONBString("{}")
	if before != nil {
		changedFields := map[string]map[string]string{}
		appendChange := func(field, oldValue, newValue string) {
			if oldValue == newValue {
				return
			}
			changedFields[field] = map[string]string{
				"old": oldValue,
				"new": newValue,
			}
		}

		appendChange("legal_name", before.LegalName, after.LegalName)
		appendChange("legal_address_country", before.LegalAddressCountry, after.LegalAddressCountry)
		appendChange("legal_address_city", before.LegalAddressCity, after.LegalAddressCity)
		appendChange("legal_jurisdiction", before.LegalJurisdiction, after.LegalJurisdiction)
		appendChange("entity_status", before.EntityStatus, after.EntityStatus)
		appendChange("provisioning_source", before.ProvisioningSource, after.ProvisioningSource)
		appendChange("successor_lei", before.SuccessorLEI, after.SuccessorLEI)

		// Track parent_lei and child_lei changes using hydrated record fields
		appendChange("parent_lei", before.ParentLEI, after.ParentLEI)
		appendChange("child_lei", before.ChildLEI, after.ChildLEI)

		if len(changedFields) > 0 {
			payload, err := json.Marshal(changedFields)
			if err != nil {
				return fmt.Errorf("marshal changed fields: %w", err)
			}
			changedFieldsJSON = domain.JSONBString(payload)
		}
	}

	recordSnapshot, err := json.Marshal(after)
	if err != nil {
		return fmt.Errorf("marshal record snapshot: %w", err)
	}

	audit := &domain.LEIRecordAudit{
		LEIRecordID:    after.ID,
		LEI:            after.LEI,
		Action:         action,
		RecordSnapshot: domain.JSONBString(recordSnapshot),
		ChangedFields:  changedFieldsJSON,
		SourceFileID:   after.SourceFileID,
		ChangedBy:      adminUserID,
	}

	return s.leiRepo.CreateAuditRecord(audit)
}

func (s *provisionalLEIService) Succeed(provisionalLEI, officialLEI, adminUserID string) error {
	// Confirm the provisional record exists.
	provisional, err := s.repo.FindByLEI(provisionalLEI)
	if err != nil {
		return fmt.Errorf("fetch provisional LEI %s: %w", provisionalLEI, err)
	}
	if provisional == nil {
		return fmt.Errorf("provisional LEI %s not found", provisionalLEI)
	}

	// Confirm the official LEI record exists in the database.
	official, err := s.leiRepo.FindLEIByLEI(officialLEI)
	if err != nil {
		return fmt.Errorf("fetch official LEI %s: %w", officialLEI, err)
	}
	if official == nil {
		return fmt.Errorf("official LEI %s not found in the database; import it before creating a succession link", officialLEI)
	}

	if err := s.repo.Succeed(provisionalLEI, officialLEI, adminUserID); err != nil {
		return fmt.Errorf("persist succession for %s → %s: %w", provisionalLEI, officialLEI, err)
	}

	updatedProvisional, err := s.repo.FindByLEI(provisionalLEI)
	if err != nil {
		return fmt.Errorf("fetch updated provisional LEI %s after succession: %w", provisionalLEI, err)
	}
	if updatedProvisional == nil {
		return fmt.Errorf("provisional LEI %s not found after succession", provisionalLEI)
	}

	if err := s.createProvisionalAudit("UPDATE", provisional, updatedProvisional, adminUserID); err != nil {
		return fmt.Errorf("create provisional LEI audit for %s succession: %w", provisionalLEI, err)
	}

	log.Info().
		Str("provisional_lei", provisionalLEI).
		Str("official_lei", officialLEI).
		Str("admin", adminUserID).
		Msg("provisional LEI succeeded by official LEI")

	return nil
}

func (s *provisionalLEIService) Get(lei string) (*domain.LEIRecord, error) {
	record, err := s.repo.FindByLEI(lei)
	if err != nil {
		return nil, fmt.Errorf("get provisional LEI %s: %w", lei, err)
	}
	if record != nil {
		if hydrateErr := s.hydrateRelationship(record); hydrateErr != nil {
			log.Warn().Err(hydrateErr).Str("lei", lei).Msg("failed to hydrate relationship for Get")
		}
	}
	return record, nil
}

func (s *provisionalLEIService) List(limit, offset int) ([]*domain.LEIRecord, int64, error) {
	records, err := s.repo.ListProvisional(limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list provisional LEIs: %w", err)
	}
	total, err := s.repo.CountProvisional()
	if err != nil {
		return nil, 0, fmt.Errorf("count provisional LEIs: %w", err)
	}
	if hydrateErr := s.hydrateRelationshipsBatch(records); hydrateErr != nil {
		log.Warn().Err(hydrateErr).Msg("failed to hydrate relationships for List")
	}
	return records, total, nil
}

// generateProvisionalLEI produces a valid ISO 17442 LEI code with the AXIO prefix.
//
// Format: AXIO <14 random uppercase alphanumeric chars> <2 ISO-7064 MOD-97-10 check digits>
// The AXIO prefix is not a registered GLEIF LOU; these codes are Axiom-internal only.
func generateProvisionalLEI() (string, error) {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	const bodyLen = 14

	prefix := "AXIO"

	// ISO 17442 reserves check digit 01 (and 00). Loop until the random body
	// produces a check digit in the valid range [02, 98]. The probability of
	// needing a retry is 1/97, so this terminates almost always on the first try.
	var (
		body  []byte
		raw18 string
		check int
	)
	for {
		body = make([]byte, bodyLen)
		for i := range body {
			n, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
			if err != nil {
				return "", fmt.Errorf("generate random LEI character: %w", err)
			}
			body[i] = alphabet[n.Int64()]
		}
		raw18 = prefix + string(body)
		check = iso17442CheckDigits(raw18)
		if check >= 2 {
			break
		}
	}
	result := raw18 + fmt.Sprintf("%02d", check)

	// Validate the final LEI matches the required pattern
	if len(result) != 20 {
		return "", fmt.Errorf("generated LEI has invalid length: %d (expected 20)", len(result))
	}
	for i, ch := range result {
		if i < 18 {
			// First 18 chars must be alphanumeric
			if (ch < '0' || ch > '9') && (ch < 'A' || ch > 'Z') {
				return "", fmt.Errorf("generated LEI has invalid character at position %d: %c (must be 0-9 or A-Z)", i, ch)
			}
		} else {
			// Last 2 chars must be digits
			if ch < '0' || ch > '9' {
				return "", fmt.Errorf("generated LEI has invalid check digit at position %d: %c (must be 0-9)", i, ch)
			}
		}
	}

	log.Info().
		Str("prefix", prefix).
		Str("body", string(body)).
		Str("raw18", raw18).
		Int("check_digit_value", check).
		Str("final_lei", result).
		Msg("LEI code generated successfully")

	return result, nil
}

// iso17442CheckDigits computes the 2-digit ISO 17442 / ISO 7064 MOD-97-10 check digits
// for the first 18 characters of a LEI code.
//
// Algorithm:
//  1. Replace each letter with its numeric value: A=10, B=11, …, Z=35.
//  2. Append "00".
//  3. Compute the resulting large integer modulo 97.
//  4. Return (98 - mod97) modulo 97 to ensure result is between 1-97.
func iso17442CheckDigits(raw18 string) int {
	var sb strings.Builder
	for _, ch := range strings.ToUpper(raw18) {
		if ch >= 'A' && ch <= 'Z' {
			_, _ = fmt.Fprintf(&sb, "%d", int(ch-'A')+10)
		} else if ch >= '0' && ch <= '9' {
			sb.WriteByte(byte(ch))
		}
	}
	sb.WriteString("00")

	numStr := sb.String()
	mod := computeMod97(numStr)
	// (98 - mod) % 97 gives values in [0, 97].
	// mod=1  → result=0  (reserved, invalid)
	// mod=0  → result=1  (reserved, invalid per ISO 17442)
	// All other mod values → result in [2, 97] (valid)
	// Callers that require [2, 98] must regenerate when result < 2.
	result := (98 - mod) % 97

	log.Info().
		Str("raw18", raw18).
		Int("mod97", mod).
		Int("check_digit_result", result).
		Str("check_digit_formatted", fmt.Sprintf("%02d", result)).
		Msg("Check digit calculated")

	return result
}

// computeMod97 computes the value of a large decimal string modulo 97, processing
// the string in chunks to avoid overflow.
func computeMod97(numStr string) int {
	if len(numStr) == 0 {
		return 0
	}
	remainder := 0
	for _, ch := range numStr {
		if ch < '0' || ch > '9' {
			// Skip non-digit characters
			continue
		}
		digit := int(ch - '0')
		remainder = (remainder*10 + digit) % 97
	}
	return remainder
}

func normalizeRelationshipInputs(parentLEI, childLEI, provisionalLEI string) (string, string, error) {
	normalizedProvisional := strings.ToUpper(strings.TrimSpace(provisionalLEI))
	normalizedParent := strings.ToUpper(strings.TrimSpace(parentLEI))
	normalizedChild := strings.ToUpper(strings.TrimSpace(childLEI))

	if normalizedParent != "" {
		if err := validateLEIFormat(normalizedParent); err != nil {
			return "", "", fmt.Errorf("invalid parent LEI: %w", err)
		}
	}

	if normalizedChild != "" {
		if err := validateLEIFormat(normalizedChild); err != nil {
			return "", "", fmt.Errorf("invalid child LEI: %w", err)
		}
	}

	if normalizedParent != "" && normalizedParent == normalizedProvisional {
		return "", "", fmt.Errorf("parent LEI cannot be the same as the provisional LEI")
	}

	if normalizedChild != "" && normalizedChild == normalizedProvisional {
		return "", "", fmt.Errorf("child LEI cannot be the same as the provisional LEI")
	}

	if normalizedParent != "" && normalizedChild != "" && normalizedParent == normalizedChild {
		return "", "", fmt.Errorf("parent LEI and child LEI must be different")
	}

	return normalizedParent, normalizedChild, nil
}

func validateLEIFormat(lei string) error {
	if len(lei) != 20 {
		return fmt.Errorf("LEI must be exactly 20 characters")
	}
	for i, ch := range lei {
		if i < 18 {
			if (ch < '0' || ch > '9') && (ch < 'A' || ch > 'Z') {
				return fmt.Errorf("LEI contains invalid character at position %d", i)
			}
			continue
		}
		if ch < '0' || ch > '9' {
			return fmt.Errorf("LEI check digits are invalid")
		}
	}
	return nil
}

func (s *provisionalLEIService) validateRelatedLEI(lei string) error {
	if lei == "" {
		return nil
	}
	// Provisional LEIs (AXIO prefix) live in the provisional repo, not the GLEIF repo.
	if strings.HasPrefix(lei, "AXIO") {
		record, err := s.repo.FindByLEI(lei)
		if err != nil {
			return fmt.Errorf("fetch related provisional LEI %s: %w", lei, err)
		}
		if record == nil {
			return fmt.Errorf("related provisional LEI %s not found", lei)
		}
		return nil
	}
	record, err := s.leiRepo.FindLEIByLEI(lei)
	if err != nil {
		return fmt.Errorf("fetch related LEI %s: %w", lei, err)
	}
	if record == nil {
		return fmt.Errorf("related LEI %s not found", lei)
	}
	return nil
}

// hydrateRelationship populates ParentLEI and ChildLEI on a single provisional LEI record
// by querying the level 2 relationship table.
func (s *provisionalLEIService) hydrateRelationship(record *domain.LEIRecord) error {
	startRels, err := s.level2Repo.FindRelationshipsByStartLEI(record.LEI)
	if err != nil {
		return fmt.Errorf("hydrate parent for %s: %w", record.LEI, err)
	}
	for _, rel := range startRels {
		if rel.RelationshipType == "IS_DIRECTLY_CONSOLIDATED_BY" {
			record.ParentLEI = rel.EndNodeLEI
			break
		}
	}

	endRels, err := s.level2Repo.FindRelationshipsByEndLEI(record.LEI)
	if err != nil {
		return fmt.Errorf("hydrate child for %s: %w", record.LEI, err)
	}
	for _, rel := range endRels {
		if rel.RelationshipType == "IS_DIRECTLY_CONSOLIDATED_BY" {
			record.ChildLEI = rel.StartNodeLEI
			break
		}
	}
	return nil
}

// hydrateRelationshipsBatch efficiently populates ParentLEI and ChildLEI for a slice of
// provisional LEI records using two bulk queries instead of 2N individual queries.
func (s *provisionalLEIService) hydrateRelationshipsBatch(records []*domain.LEIRecord) error {
	if len(records) == 0 {
		return nil
	}

	leis := make([]string, len(records))
	for i, r := range records {
		leis[i] = r.LEI
	}

	startRels, err := s.level2Repo.FindRelationshipsByStartLEIsBatch(leis)
	if err != nil {
		return fmt.Errorf("batch hydrate parents: %w", err)
	}
	parentByLEI := make(map[string]string, len(startRels))
	for _, rel := range startRels {
		if rel.RelationshipType == "IS_DIRECTLY_CONSOLIDATED_BY" {
			parentByLEI[rel.StartNodeLEI] = rel.EndNodeLEI
		}
	}

	endRels, err := s.level2Repo.FindRelationshipsByEndLEIsBatch(leis)
	if err != nil {
		return fmt.Errorf("batch hydrate children: %w", err)
	}
	childByLEI := make(map[string]string, len(endRels))
	for _, rel := range endRels {
		if rel.RelationshipType == "IS_DIRECTLY_CONSOLIDATED_BY" {
			childByLEI[rel.EndNodeLEI] = rel.StartNodeLEI
		}
	}

	for _, r := range records {
		r.ParentLEI = parentByLEI[r.LEI]
		r.ChildLEI = childByLEI[r.LEI]
	}
	return nil
}

func (s *provisionalLEIService) upsertParentChildRelationships(provisionalLEI, parentLEI, childLEI string) error {
	// Delete all existing parent relationships for this provisional LEI before inserting the new
	// one. The upsert conflicts on (start, end, type), so changing the parent to a different LEI
	// would create a second active row rather than replacing the first. Deleting first ensures
	// only one IS_DIRECTLY_CONSOLIDATED_BY row ever exists per direction.
	if err := s.level2Repo.DeleteRelationshipsByStartLEIAndType(provisionalLEI, "IS_DIRECTLY_CONSOLIDATED_BY"); err != nil {
		return fmt.Errorf("delete old parent relationships for %s: %w", provisionalLEI, err)
	}
	if err := s.level2Repo.DeleteRelationshipsByEndLEIAndType(provisionalLEI, "IS_DIRECTLY_CONSOLIDATED_BY"); err != nil {
		return fmt.Errorf("delete old child relationships for %s: %w", provisionalLEI, err)
	}

	if parentLEI != "" {
		if err := s.level2Repo.UpsertRelationshipRecord(&domain.LEIRelationshipRecord{
			StartNodeLEI:            provisionalLEI,
			EndNodeLEI:              parentLEI,
			RelationshipType:        "IS_DIRECTLY_CONSOLIDATED_BY",
			RelationshipStatus:      "ACTIVE",
			RelationshipPeriods:     domain.JSONBString("[]"),
			RelationshipQualifiers:  domain.JSONBString("[]"),
			RelationshipQuantifiers: domain.JSONBString("[]"),
			RegistrationStatus:      "PUBLISHED",
		}); err != nil {
			return fmt.Errorf("upsert parent relationship for %s: %w", provisionalLEI, err)
		}
	}

	if childLEI != "" {
		if err := s.level2Repo.UpsertRelationshipRecord(&domain.LEIRelationshipRecord{
			StartNodeLEI:            childLEI,
			EndNodeLEI:              provisionalLEI,
			RelationshipType:        "IS_DIRECTLY_CONSOLIDATED_BY",
			RelationshipStatus:      "ACTIVE",
			RelationshipPeriods:     domain.JSONBString("[]"),
			RelationshipQualifiers:  domain.JSONBString("[]"),
			RelationshipQuantifiers: domain.JSONBString("[]"),
			RegistrationStatus:      "PUBLISHED",
		}); err != nil {
			return fmt.Errorf("upsert child relationship for %s: %w", provisionalLEI, err)
		}
	}

	return nil
}
