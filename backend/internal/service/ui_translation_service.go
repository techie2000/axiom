package service

import (
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/repository"
)

var (
	errTranslationIDRequired   = errors.New("translation ID is required")
	errReviewerUserIDRequired  = errors.New("reviewer user ID is required")
	errTranslationKeyRequired  = errors.New("translation key is required")
	errLanguageCodeRequired    = errors.New("language code is required")
	errTranslationValueRequired = errors.New("translation value is required")
)

// UITranslationService manages community-contributed UI translation strings.
type UITranslationService interface {
	// List returns translations with optional filtering and pagination.
	List(languageCode, status, search string, limit, offset int) ([]*domain.UITranslation, int64, error)
	// GetByID returns a single translation by primary key.
	GetByID(id string) (*domain.UITranslation, error)
	// Submit creates or updates a translation and sets its status to pending.
	Submit(translationKey, languageCode, value, notes, submittedByUserID string) (*domain.UITranslation, error)
	// Approve marks a translation as approved and records the reviewer.
	Approve(id, reviewerUserID string) error
	// Reject marks a translation as rejected and records the reviewer.
	Reject(id, reviewerUserID string) error
	// Delete removes a translation by primary key.
	Delete(id string) error
}

type uiTranslationService struct {
	repo repository.UITranslationRepository
}

// NewUITranslationService creates a new UITranslationService.
func NewUITranslationService(repo repository.UITranslationRepository) UITranslationService {
	return &uiTranslationService{repo: repo}
}

func normalizeLanguageCode(languageCode string) string {
	normalized := strings.TrimSpace(strings.ToLower(languageCode))
	if normalized == "" {
		return ""
	}
	parts := strings.SplitN(normalized, "-", 2)
	return parts[0]
}

func validateTranslationID(id string) (string, error) {
	trimmedID := strings.TrimSpace(id)
	if trimmedID == "" {
		return "", errTranslationIDRequired
	}
	if _, err := uuid.Parse(trimmedID); err != nil {
		return "", fmt.Errorf("invalid translation ID: %w", err)
	}
	return trimmedID, nil
}

func validateReviewerUserID(reviewerUserID string) (string, error) {
	trimmedReviewerID := strings.TrimSpace(reviewerUserID)
	if trimmedReviewerID == "" {
		return "", errReviewerUserIDRequired
	}
	if _, err := uuid.Parse(trimmedReviewerID); err != nil {
		return "", fmt.Errorf("invalid reviewer user ID: %w", err)
	}
	return trimmedReviewerID, nil
}

func (s *uiTranslationService) List(languageCode, status, search string, limit, offset int) ([]*domain.UITranslation, int64, error) {
	return s.repo.List(
		normalizeLanguageCode(languageCode),
		strings.TrimSpace(strings.ToLower(status)),
		strings.TrimSpace(search),
		limit,
		offset,
	)
}

func (s *uiTranslationService) GetByID(id string) (*domain.UITranslation, error) {
	validatedID, err := validateTranslationID(id)
	if err != nil {
		return nil, err
	}
	return s.repo.FindByID(validatedID)
}

func (s *uiTranslationService) Submit(translationKey, languageCode, value, notes, submittedByUserID string) (*domain.UITranslation, error) {
	trimmedKey := strings.TrimSpace(translationKey)
	if trimmedKey == "" {
		return nil, errTranslationKeyRequired
	}

	normalizedLanguageCode := normalizeLanguageCode(languageCode)
	if normalizedLanguageCode == "" {
		return nil, errLanguageCodeRequired
	}

	trimmedValue := strings.TrimSpace(value)
	if trimmedValue == "" {
		return nil, errTranslationValueRequired
	}

	t := &domain.UITranslation{
		TranslationKey:   trimmedKey,
		LanguageCode:     normalizedLanguageCode,
		TranslationValue: trimmedValue,
		Status:           domain.TranslationStatusPending,
		Notes:            strings.TrimSpace(notes),
	}
	if submittedByUserID != "" {
		uid, err := uuid.Parse(strings.TrimSpace(submittedByUserID))
		if err != nil {
			return nil, fmt.Errorf("invalid user ID: %w", err)
		}
		t.SubmittedBy = &uid
	}
	if err := s.repo.Upsert(t); err != nil {
		return nil, err
	}
	return t, nil
}

func (s *uiTranslationService) Approve(id, reviewerUserID string) error {
	validatedID, err := validateTranslationID(id)
	if err != nil {
		return err
	}
	validatedReviewerID, err := validateReviewerUserID(reviewerUserID)
	if err != nil {
		return err
	}
	return s.repo.UpdateStatus(validatedID, domain.TranslationStatusApproved, validatedReviewerID)
}

func (s *uiTranslationService) Reject(id, reviewerUserID string) error {
	validatedID, err := validateTranslationID(id)
	if err != nil {
		return err
	}
	validatedReviewerID, err := validateReviewerUserID(reviewerUserID)
	if err != nil {
		return err
	}
	return s.repo.UpdateStatus(validatedID, domain.TranslationStatusRejected, validatedReviewerID)
}

func (s *uiTranslationService) Delete(id string) error {
	validatedID, err := validateTranslationID(id)
	if err != nil {
		return err
	}
	return s.repo.Delete(validatedID)
}
