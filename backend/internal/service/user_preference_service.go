package service

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/repository"
)

// UserPreferenceService manages per-user UI preferences.
type UserPreferenceService interface {
	// GetByPage returns all stored preferences for a user on the given page.
	GetByPage(userID, pageKey string) ([]*domain.UserPreference, error)
	// GetAll returns all stored preferences for a user across all pages.
	GetAll(userID string) ([]*domain.UserPreference, error)
	// Set creates or updates a single preference value and writes an audit row.
	// ipAddress is the client IP captured from the HTTP request (may be empty).
	Set(userID, pageKey, preferenceKey, value, ipAddress string) error
	// Delete removes a specific preference.
	Delete(userID, pageKey, preferenceKey string) error
}

type userPreferenceService struct {
	repo      repository.UserPreferenceRepository
	auditRepo repository.PreferenceAuditRepository
}

// NewUserPreferenceService creates a new UserPreferenceService.
func NewUserPreferenceService(repo repository.UserPreferenceRepository, auditRepo repository.PreferenceAuditRepository) UserPreferenceService {
	return &userPreferenceService{repo: repo, auditRepo: auditRepo}
}

func (s *userPreferenceService) GetByPage(userID, pageKey string) ([]*domain.UserPreference, error) {
	return s.repo.GetByPage(userID, pageKey)
}

func (s *userPreferenceService) GetAll(userID string) ([]*domain.UserPreference, error) {
	return s.repo.GetAll(userID)
}

func (s *userPreferenceService) Set(userID, pageKey, preferenceKey, value, ipAddress string) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user ID: %w", err)
	}

	// Capture the existing value for the audit trail before upserting.
	existing, err := s.repo.GetOne(userID, pageKey, preferenceKey)
	if err != nil {
		return fmt.Errorf("failed to read existing preference: %w", err)
	}

	pref := &domain.UserPreference{
		UserID:          uid,
		PageKey:         pageKey,
		PreferenceKey:   preferenceKey,
		PreferenceValue: value,
	}
	if err := s.repo.Upsert(pref); err != nil {
		return err
	}

	// Write audit row (best-effort – do not fail the request on audit error).
	audit := &domain.PreferenceAudit{
		UserID:        uid,
		PageKey:       pageKey,
		PreferenceKey: preferenceKey,
		NewValue:      value,
	}
	if existing != nil {
		old := existing.PreferenceValue
		audit.OldValue = &old
	}
	if ipAddress != "" {
		audit.IPAddress = &ipAddress
	}
	// Swallow audit errors to avoid degrading the user-facing preference save,
	// but log at warn level so audit trail gaps are visible in observability tools.
	if err := s.auditRepo.Record(audit); err != nil {
		log.Warn().Err(err).
			Str("user_id", userID).
			Str("page_key", pageKey).
			Str("preference_key", preferenceKey).
			Msg("failed to record preference audit row")
	}

	return nil
}

func (s *userPreferenceService) Delete(userID, pageKey, preferenceKey string) error {
	return s.repo.Delete(userID, pageKey, preferenceKey)
}
