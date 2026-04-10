package service

import (
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/repository"
)

type userPreferenceRepoStub struct {
	getOneResult *domain.UserPreference
	getOneErr    error
	upsertErr    error
	upserted     *domain.UserPreference
}

func (r *userPreferenceRepoStub) GetByPage(userID, pageKey string) ([]*domain.UserPreference, error) {
	return nil, nil
}

func (r *userPreferenceRepoStub) GetAll(userID string) ([]*domain.UserPreference, error) {
	return nil, nil
}

func (r *userPreferenceRepoStub) GetOne(userID, pageKey, preferenceKey string) (*domain.UserPreference, error) {
	if r.getOneErr != nil {
		return nil, r.getOneErr
	}
	return r.getOneResult, nil
}

func (r *userPreferenceRepoStub) Upsert(pref *domain.UserPreference) error {
	copyValue := *pref
	r.upserted = &copyValue
	return r.upsertErr
}

func (r *userPreferenceRepoStub) Delete(userID, pageKey, preferenceKey string) error {
	return nil
}

type preferenceAuditRepoStub struct {
	recordErr error
	recorded  []*domain.PreferenceAudit
}

func (r *preferenceAuditRepoStub) Record(entry *domain.PreferenceAudit) error {
	copyValue := *entry
	if entry.OldValue != nil {
		old := *entry.OldValue
		copyValue.OldValue = &old
	}
	if entry.IPAddress != nil {
		ip := *entry.IPAddress
		copyValue.IPAddress = &ip
	}
	r.recorded = append(r.recorded, &copyValue)
	return r.recordErr
}

func TestUserPreferenceServiceSetFirstSaveRecordsAuditWithNilOldValue(t *testing.T) {
	prefRepo := &userPreferenceRepoStub{}
	auditRepo := &preferenceAuditRepoStub{}
	svc := NewUserPreferenceService(prefRepo, auditRepo)

	userID := uuid.New().String()
	err := svc.Set(userID, "global", "theme", "light", "10.0.0.1")
	if err != nil {
		t.Fatalf("Set returned unexpected error: %v", err)
	}

	if prefRepo.upserted == nil {
		t.Fatal("expected Upsert to be called")
	}
	if prefRepo.upserted.PreferenceValue != "light" {
		t.Fatalf("PreferenceValue = %q, want %q", prefRepo.upserted.PreferenceValue, "light")
	}

	if len(auditRepo.recorded) != 1 {
		t.Fatalf("audit records = %d, want 1", len(auditRepo.recorded))
	}
	audit := auditRepo.recorded[0]
	if audit.OldValue != nil {
		t.Fatalf("OldValue = %v, want nil", *audit.OldValue)
	}
	if audit.NewValue != "light" {
		t.Fatalf("NewValue = %q, want %q", audit.NewValue, "light")
	}
	if audit.IPAddress == nil || *audit.IPAddress != "10.0.0.1" {
		t.Fatalf("IPAddress = %v, want %q", audit.IPAddress, "10.0.0.1")
	}
}

func TestUserPreferenceServiceSetExistingPreferenceCapturesOldAndNewValues(t *testing.T) {
	prefRepo := &userPreferenceRepoStub{
		getOneResult: &domain.UserPreference{PreferenceValue: "dark"},
	}
	auditRepo := &preferenceAuditRepoStub{}
	svc := NewUserPreferenceService(prefRepo, auditRepo)

	userID := uuid.New().String()
	err := svc.Set(userID, "global", "theme", "light", "")
	if err != nil {
		t.Fatalf("Set returned unexpected error: %v", err)
	}

	if len(auditRepo.recorded) != 1 {
		t.Fatalf("audit records = %d, want 1", len(auditRepo.recorded))
	}
	audit := auditRepo.recorded[0]
	if audit.OldValue == nil || *audit.OldValue != "dark" {
		t.Fatalf("OldValue = %v, want %q", audit.OldValue, "dark")
	}
	if audit.NewValue != "light" {
		t.Fatalf("NewValue = %q, want %q", audit.NewValue, "light")
	}
}

func TestUserPreferenceServiceSetAuditFailureDoesNotFailPreferenceSave(t *testing.T) {
	prefRepo := &userPreferenceRepoStub{}
	auditRepo := &preferenceAuditRepoStub{recordErr: errors.New("audit unavailable")}
	svc := NewUserPreferenceService(prefRepo, auditRepo)

	userID := uuid.New().String()
	err := svc.Set(userID, "global", "theme", "light", "")
	if err != nil {
		t.Fatalf("Set error = %v, want nil", err)
	}
	if prefRepo.upserted == nil {
		t.Fatal("expected Upsert to be called")
	}
	if len(auditRepo.recorded) != 1 {
		t.Fatalf("audit records = %d, want 1", len(auditRepo.recorded))
	}
}

var _ repository.UserPreferenceRepository = (*userPreferenceRepoStub)(nil)
var _ repository.PreferenceAuditRepository = (*preferenceAuditRepoStub)(nil)
