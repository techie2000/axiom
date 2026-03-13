package handler

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/service"
)

type uiTranslationServiceStub struct {
	service.UITranslationService
	listLanguage string
	listStatus   string
	listSearch   string
	listLimit    int
	listOffset   int
	listErr      error
	listCalls    int
}

func (s *uiTranslationServiceStub) List(languageCode, status, search string, limit, offset int) ([]*domain.UITranslation, int64, error) {
	s.listLanguage = languageCode
	s.listStatus = status
	s.listSearch = search
	s.listLimit = limit
	s.listOffset = offset
	s.listCalls++
	if s.listErr != nil {
		return nil, 0, s.listErr
	}
	return []*domain.UITranslation{{ID: uuid.New(), TranslationKey: "dashboard.title", LanguageCode: "fr", Status: domain.TranslationStatusApproved}}, 1, nil
}

func TestListTranslationsDefaultsToApprovedForPublicRoute(t *testing.T) {
	stub := &uiTranslationServiceStub{}
	h := NewUITranslationHandler(stub)

	resp := executeGET("/translations", "/translations?language=fr&search=hello", h.ListTranslations)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, resp.Code)
	}
	if stub.listCalls != 1 {
		t.Fatalf("expected List to be called once, got %d", stub.listCalls)
	}
	if stub.listStatus != string(domain.TranslationStatusApproved) {
		t.Fatalf("status = %q, want %q", stub.listStatus, domain.TranslationStatusApproved)
	}
	if stub.listLanguage != "fr" {
		t.Fatalf("language = %q, want %q", stub.listLanguage, "fr")
	}
	if stub.listSearch != "hello" {
		t.Fatalf("search = %q, want %q", stub.listSearch, "hello")
	}
}

func TestListTranslationsRejectsNonApprovedStatusForPublicRoute(t *testing.T) {
	stub := &uiTranslationServiceStub{}
	h := NewUITranslationHandler(stub)

	resp := executeGET("/translations", "/translations?status=pending", h.ListTranslations)
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, resp.Code)
	}
	if stub.listCalls != 0 {
		t.Fatalf("expected List not to be called, got %d call(s)", stub.listCalls)
	}
	if !strings.Contains(resp.Body.String(), "only approved translations") {
		t.Fatalf("expected public access error, got %s", resp.Body.String())
	}
}

func TestListAdminTranslationsAllowsReviewStatuses(t *testing.T) {
	stub := &uiTranslationServiceStub{}
	h := NewUITranslationHandler(stub)

	resp := executeGET("/admin/translations", "/admin/translations?status=rejected&limit=25&offset=50", h.ListAdminTranslations)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, resp.Code)
	}
	if stub.listCalls != 1 {
		t.Fatalf("expected List to be called once, got %d", stub.listCalls)
	}
	if stub.listStatus != string(domain.TranslationStatusRejected) {
		t.Fatalf("status = %q, want %q", stub.listStatus, domain.TranslationStatusRejected)
	}
	if stub.listLimit != 25 || stub.listOffset != 50 {
		t.Fatalf("pagination = (%d, %d), want (25, 50)", stub.listLimit, stub.listOffset)
	}
}

func TestListTranslationsReturnsInternalServerErrorOnServiceFailure(t *testing.T) {
	stub := &uiTranslationServiceStub{listErr: errors.New("boom")}
	h := NewUITranslationHandler(stub)

	resp := executeGET("/translations", "/translations", h.ListTranslations)
	if resp.Code != http.StatusInternalServerError {
		t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, resp.Code)
	}
}