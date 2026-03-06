package service

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/repository"
)

// UserPreferenceService manages per-user UI preferences.
type UserPreferenceService interface {
	// GetByPage returns all stored preferences for a user on the given page.
	GetByPage(userID, pageKey string) ([]*domain.UserPreference, error)
	// GetAll returns all stored preferences for a user across all pages.
	GetAll(userID string) ([]*domain.UserPreference, error)
	// Set creates or updates a single preference value.
	Set(userID, pageKey, preferenceKey, value string) error
	// Delete removes a specific preference.
	Delete(userID, pageKey, preferenceKey string) error
}

type userPreferenceService struct {
	repo repository.UserPreferenceRepository
}

// NewUserPreferenceService creates a new UserPreferenceService.
func NewUserPreferenceService(repo repository.UserPreferenceRepository) UserPreferenceService {
	return &userPreferenceService{repo: repo}
}

func (s *userPreferenceService) GetByPage(userID, pageKey string) ([]*domain.UserPreference, error) {
	return s.repo.GetByPage(userID, pageKey)
}

func (s *userPreferenceService) GetAll(userID string) ([]*domain.UserPreference, error) {
	return s.repo.GetAll(userID)
}

func (s *userPreferenceService) Set(userID, pageKey, preferenceKey, value string) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user ID: %w", err)
	}
	pref := &domain.UserPreference{
		UserID:          uid,
		PageKey:         pageKey,
		PreferenceKey:   preferenceKey,
		PreferenceValue: value,
	}
	return s.repo.Upsert(pref)
}

func (s *userPreferenceService) Delete(userID, pageKey, preferenceKey string) error {
	return s.repo.Delete(userID, pageKey, preferenceKey)
}
