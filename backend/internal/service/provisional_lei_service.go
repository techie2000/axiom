package service

import (
	"crypto/rand"
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
}

type provisionalLEIService struct {
	repo    repository.ProvisionalLEIRepository
	leiRepo repository.LEIRepository
}

// NewProvisionalLEIService creates a ProvisionalLEIService.
func NewProvisionalLEIService(repo repository.ProvisionalLEIRepository, leiRepo repository.LEIRepository) ProvisionalLEIService {
	return &provisionalLEIService{repo: repo, leiRepo: leiRepo}
}

func (s *provisionalLEIService) Create(req CreateProvisionalLEIRequest, adminUserID string) (*domain.LEIRecord, error) {
	code, err := generateProvisionalLEI()
	if err != nil {
		return nil, fmt.Errorf("generate provisional LEI code: %w", err)
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

	log.Info().
		Str("lei", code).
		Str("legal_name", req.LegalName).
		Str("created_by", adminUserID).
		Msg("provisional LEI created")

	return record, nil
}

func (s *provisionalLEIService) Update(lei string, req UpdateProvisionalLEIRequest, adminUserID string) (*domain.LEIRecord, error) {
	record, err := s.repo.FindByLEI(lei)
	if err != nil {
		return nil, fmt.Errorf("fetch provisional LEI %s: %w", lei, err)
	}
	if record == nil {
		return nil, fmt.Errorf("provisional LEI %s not found", lei)
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

	log.Info().Str("lei", lei).Str("updated_by", adminUserID).Msg("provisional LEI updated")
	return record, nil
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
	return records, total, nil
}

// generateProvisionalLEI produces a valid ISO 17442 LEI code with the AXIO prefix.
//
// Format: AXIO <14 random uppercase alphanumeric chars> <2 ISO-7064 MOD-97-10 check digits>
// The AXIO prefix is not a registered GLEIF LOU; these codes are Axiom-internal only.
func generateProvisionalLEI() (string, error) {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	const bodyLen = 14

	body := make([]byte, bodyLen)
	for i := range body {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		if err != nil {
			return "", fmt.Errorf("generate random LEI character: %w", err)
		}
		body[i] = alphabet[n.Int64()]
	}

	prefix := "AXIO"
	raw18 := prefix + string(body) // 18 alphanumeric chars before check digits

	check := iso17442CheckDigits(raw18)
	result := raw18 + fmt.Sprintf("%02d", check)
	
	// Validate the final LEI matches the required pattern
	if len(result) != 20 {
		return "", fmt.Errorf("generated LEI has invalid length: %d (expected 20)", len(result))
	}
	for i, ch := range result {
		if i < 18 {
			// First 18 chars must be alphanumeric
			if !((ch >= '0' && ch <= '9') || (ch >= 'A' && ch <= 'Z')) {
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
			sb.WriteString(fmt.Sprintf("%d", int(ch-'A')+10))
		} else if ch >= '0' && ch <= '9' {
			sb.WriteByte(byte(ch))
		}
	}
	sb.WriteString("00")

	numStr := sb.String()
	mod := computeMod97(numStr)
	result := (98 - mod) % 97
	
	// Ensure result is non-zero (ISO spec requires check digits to be 01-97, never 00)
	if result == 0 {
		result = 97
	}
	
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
