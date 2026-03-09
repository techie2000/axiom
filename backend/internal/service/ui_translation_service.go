package service

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/repository"
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

func (s *uiTranslationService) List(languageCode, status, search string, limit, offset int) ([]*domain.UITranslation, int64, error) {
	return s.repo.List(languageCode, status, search, limit, offset)
}

func (s *uiTranslationService) GetByID(id string) (*domain.UITranslation, error) {
	return s.repo.FindByID(id)
}

func (s *uiTranslationService) Submit(translationKey, languageCode, value, notes, submittedByUserID string) (*domain.UITranslation, error) {
	t := &domain.UITranslation{
		TranslationKey:   translationKey,
		LanguageCode:     languageCode,
		TranslationValue: value,
		Status:           domain.TranslationStatusPending,
		Notes:            notes,
	}
	if submittedByUserID != "" {
		uid, err := uuid.Parse(submittedByUserID)
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
	return s.repo.UpdateStatus(id, domain.TranslationStatusApproved, reviewerUserID)
}

func (s *uiTranslationService) Reject(id, reviewerUserID string) error {
	return s.repo.UpdateStatus(id, domain.TranslationStatusRejected, reviewerUserID)
}

func (s *uiTranslationService) Delete(id string) error {
	return s.repo.Delete(id)
}
