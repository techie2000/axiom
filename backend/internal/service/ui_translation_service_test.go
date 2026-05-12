package service

import (
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/repository"
)

type uiTranslationRepoStub struct {
	listLanguage string
	listStatus   string
	listSearch   string
	listLimit    int
	listOffset   int

	findID string

	upserted *domain.UITranslation

	updatedID         string
	updatedStatus     domain.TranslationStatus
	updatedReviewerID string

	deletedID string
}

func (r *uiTranslationRepoStub) List(languageCode, status, search string, limit, offset int) ([]*domain.UITranslation, int64, error) {
	r.listLanguage = languageCode
	r.listStatus = status
	r.listSearch = search
	r.listLimit = limit
	r.listOffset = offset
	return nil, 0, nil
}

func (r *uiTranslationRepoStub) FindByID(id string) (*domain.UITranslation, error) {
	r.findID = id
	return &domain.UITranslation{ID: uuid.MustParse(id)}, nil
}

func (r *uiTranslationRepoStub) Upsert(t *domain.UITranslation) error {
	copyValue := *t
	r.upserted = &copyValue
	return nil
}

func (r *uiTranslationRepoStub) UpdateStatus(id string, status domain.TranslationStatus, reviewerID string) error {
	r.updatedID = id
	r.updatedStatus = status
	r.updatedReviewerID = reviewerID
	return nil
}

func (r *uiTranslationRepoStub) Delete(id string) error {
	r.deletedID = id
	return nil
}

func TestUITranslationServiceListNormalizesFilters(t *testing.T) {
	repo := &uiTranslationRepoStub{}
	svc := NewUITranslationService(repo)

	_, _, err := svc.List(" FR-CA ", " Pending ", "  alias target  ", 25, 10)
	if err != nil {
		t.Fatalf("List returned unexpected error: %v", err)
	}

	if repo.listLanguage != "fr" {
		t.Fatalf("languageCode = %q, want %q", repo.listLanguage, "fr")
	}
	if repo.listStatus != "pending" {
		t.Fatalf("status = %q, want %q", repo.listStatus, "pending")
	}
	if repo.listSearch != "alias target" {
		t.Fatalf("search = %q, want %q", repo.listSearch, "alias target")
	}
}

func TestUITranslationServiceSubmitNormalizesPayload(t *testing.T) {
	repo := &uiTranslationRepoStub{}
	svc := NewUITranslationService(repo)
	submitterID := uuid.New().String()

	translation, err := svc.Submit("  dashboard.title  ", " FR-CA ", "  Tableau de bord  ", "  shared copy  ", submitterID)
	if err != nil {
		t.Fatalf("Submit returned unexpected error: %v", err)
	}
	if translation == nil {
		t.Fatal("Submit returned nil translation")
	}
	if repo.upserted == nil {
		t.Fatal("expected Upsert to be called")
	}

	if repo.upserted.TranslationKey != "dashboard.title" {
		t.Fatalf("TranslationKey = %q, want %q", repo.upserted.TranslationKey, "dashboard.title")
	}
	if repo.upserted.LanguageCode != "fr" {
		t.Fatalf("LanguageCode = %q, want %q", repo.upserted.LanguageCode, "fr")
	}
	if repo.upserted.TranslationValue != "Tableau de bord" {
		t.Fatalf("TranslationValue = %q, want %q", repo.upserted.TranslationValue, "Tableau de bord")
	}
	if repo.upserted.Notes != "shared copy" {
		t.Fatalf("Notes = %q, want %q", repo.upserted.Notes, "shared copy")
	}
	if repo.upserted.Status != domain.TranslationStatusPending {
		t.Fatalf("Status = %q, want %q", repo.upserted.Status, domain.TranslationStatusPending)
	}
	if repo.upserted.SubmittedBy == nil || repo.upserted.SubmittedBy.String() != submitterID {
		t.Fatalf("SubmittedBy = %v, want %s", repo.upserted.SubmittedBy, submitterID)
	}
}

func TestUITranslationServiceSubmitRejectsInvalidPayload(t *testing.T) {
	tests := []struct {
		name    string
		key     string
		lang    string
		value   string
		userID  string
		wantErr error
	}{
		{name: "missing key", key: "   ", lang: "fr", value: "Bonjour", wantErr: errTranslationKeyRequired},
		{name: "missing language", key: "dashboard.title", lang: "   ", value: "Bonjour", wantErr: errLanguageCodeRequired},
		{name: "missing value", key: "dashboard.title", lang: "fr", value: "   ", wantErr: errTranslationValueRequired},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			repo := &uiTranslationRepoStub{}
			svc := NewUITranslationService(repo)

			translation, err := svc.Submit(tc.key, tc.lang, tc.value, "", tc.userID)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("Submit error = %v, want %v", err, tc.wantErr)
			}
			if translation != nil {
				t.Fatalf("Submit translation = %#v, want nil", translation)
			}
			if repo.upserted != nil {
				t.Fatal("Upsert should not be called for invalid payload")
			}
		})
	}

	repo := &uiTranslationRepoStub{}
	svc := NewUITranslationService(repo)
	_, err := svc.Submit("dashboard.title", "fr", "Bonjour", "", "not-a-uuid")
	if err == nil || !strings.Contains(err.Error(), "invalid user ID") {
		t.Fatalf("Submit invalid user ID error = %v, want invalid user ID", err)
	}
}

func TestUITranslationServiceSubmitRejectsUnsafeNestingPatterns(t *testing.T) {
	tests := []struct {
		name  string
		value string
	}{
		{name: "comma in nesting", value: "$t(key, fallback)"},
		{name: "object in nesting", value: "$t(key, {defaultValue: text})"},
		{name: "array in nesting", value: "$t(key, [1, 2])"},
		{name: "nesting with context", value: "$t(key, {context: plural})"},
		{name: "nesting in middle of text", value: "See $t(key, {option: value}) for details"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			repo := &uiTranslationRepoStub{}
			svc := NewUITranslationService(repo)

			translation, err := svc.Submit("test.key", "en", tc.value, "", "")
			if !errors.Is(err, errUnsafeNestingOptions) {
				t.Fatalf("Submit error = %v, want %v", err, errUnsafeNestingOptions)
			}
			if translation != nil {
				t.Fatalf("Submit translation = %#v, want nil", translation)
			}
			if repo.upserted != nil {
				t.Fatal("Upsert should not be called for unsafe nesting")
			}
		})
	}
}

func TestUITranslationServiceSubmitAcceptsSafePointerPatterns(t *testing.T) {
	tests := []struct {
		name  string
		value string
	}{
		{name: "plain text", value: "Hello World"},
		{name: "simple pointer", value: "$t(home.title)"},
		{name: "nested pointer", value: "$t(reference.layout.header)"},
		{name: "interpolation", value: "Hello {{name}}"},
		{name: "pointer with text", value: "$t(nav.home) or visit our website"},
		{name: "multiple pointers", value: "$t(prefix.label) - $t(suffix.label)"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			repo := &uiTranslationRepoStub{}
			svc := NewUITranslationService(repo)

			translation, err := svc.Submit("test.key", "en", tc.value, "", "")
			if err != nil {
				t.Fatalf("Submit returned unexpected error: %v", err)
			}
			if translation == nil {
				t.Fatal("Submit returned nil translation")
			}
			if repo.upserted == nil {
				t.Fatal("expected Upsert to be called")
			}
			if repo.upserted.TranslationValue != tc.value {
				t.Fatalf("TranslationValue = %q, want %q", repo.upserted.TranslationValue, tc.value)
			}
		})
	}
}

func TestUITranslationServiceGetApproveRejectDeleteValidateIDs(t *testing.T) {
	repo := &uiTranslationRepoStub{}
	svc := NewUITranslationService(repo)
	translationID := uuid.New().String()
	reviewerID := uuid.New().String()

	if _, err := svc.GetByID("  " + translationID + "  "); err != nil {
		t.Fatalf("GetByID returned unexpected error: %v", err)
	}
	if repo.findID != translationID {
		t.Fatalf("FindByID id = %q, want %q", repo.findID, translationID)
	}

	if err := svc.Approve("  "+translationID+"  ", "  "+reviewerID+"  "); err != nil {
		t.Fatalf("Approve returned unexpected error: %v", err)
	}
	if repo.updatedID != translationID || repo.updatedReviewerID != reviewerID || repo.updatedStatus != domain.TranslationStatusApproved {
		t.Fatalf("Approve updated values = (%q, %q, %q)", repo.updatedID, repo.updatedReviewerID, repo.updatedStatus)
	}

	if err := svc.Reject(translationID, reviewerID); err != nil {
		t.Fatalf("Reject returned unexpected error: %v", err)
	}
	if repo.updatedStatus != domain.TranslationStatusRejected {
		t.Fatalf("Reject status = %q, want %q", repo.updatedStatus, domain.TranslationStatusRejected)
	}

	if err := svc.Delete("  " + translationID + " "); err != nil {
		t.Fatalf("Delete returned unexpected error: %v", err)
	}
	if repo.deletedID != translationID {
		t.Fatalf("Delete id = %q, want %q", repo.deletedID, translationID)
	}
}

func TestUITranslationServiceReviewActionsRejectInvalidIDs(t *testing.T) {
	repo := &uiTranslationRepoStub{}
	svc := NewUITranslationService(repo)

	if err := svc.Approve("", uuid.New().String()); !errors.Is(err, errTranslationIDRequired) {
		t.Fatalf("Approve blank ID error = %v, want %v", err, errTranslationIDRequired)
	}
	if err := svc.Reject(uuid.New().String(), ""); !errors.Is(err, errReviewerUserIDRequired) {
		t.Fatalf("Reject blank reviewer error = %v, want %v", err, errReviewerUserIDRequired)
	}
	if err := svc.Delete("not-a-uuid"); err == nil || !strings.Contains(err.Error(), "invalid translation ID") {
		t.Fatalf("Delete invalid ID error = %v, want invalid translation ID", err)
	}
	if _, err := svc.GetByID("not-a-uuid"); err == nil || !strings.Contains(err.Error(), "invalid translation ID") {
		t.Fatalf("GetByID invalid ID error = %v, want invalid translation ID", err)
	}
}

var _ repository.UITranslationRepository = (*uiTranslationRepoStub)(nil)
