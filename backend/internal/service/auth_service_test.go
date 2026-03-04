package service

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

// ---------------------------------------------------------------------------
// Stub repository
// ---------------------------------------------------------------------------

// authRepoStub is a minimal in-memory UserRepository used by auth service tests.
type authRepoStub struct {
	users            map[string]*domain.User // keyed by ID string
	createErr        error
	updateErr        error
	activeAdminCount int64
	countErr         error
}

func newAuthRepoStub() *authRepoStub {
	return &authRepoStub{users: make(map[string]*domain.User)}
}

func (r *authRepoStub) addUser(u *domain.User) {
	r.users[u.ID.String()] = u
}

func (r *authRepoStub) Create(u *domain.User) error {
	if r.createErr != nil {
		return r.createErr
	}
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	r.users[u.ID.String()] = u
	return nil
}

func (r *authRepoStub) FindByID(id string) (*domain.User, error) {
	u, ok := r.users[id]
	if !ok {
		return nil, errors.New("record not found")
	}
	return u, nil
}

func (r *authRepoStub) FindByEmail(email string) (*domain.User, error) {
	for _, u := range r.users {
		if u.Email == email {
			return u, nil
		}
	}
	return nil, errors.New("record not found")
}

func (r *authRepoStub) FindByUsername(username string) (*domain.User, error) {
	for _, u := range r.users {
		if u.Username == username {
			return u, nil
		}
	}
	return nil, errors.New("record not found")
}

func (r *authRepoStub) FindAll(status string, limit, offset int) ([]*domain.User, error) {
	var result []*domain.User
	for _, u := range r.users {
		if status == "" || string(u.Status) == status {
			result = append(result, u)
		}
	}
	return result, nil
}

func (r *authRepoStub) Update(u *domain.User) error {
	if r.updateErr != nil {
		return r.updateErr
	}
	r.users[u.ID.String()] = u
	return nil
}

func (r *authRepoStub) CountActiveAdmins() (int64, error) {
	if r.countErr != nil {
		return 0, r.countErr
	}
	return r.activeAdminCount, nil
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func mustHash(password string) string {
	h, err := bcrypt.GenerateFromPassword([]byte(password), 4) // cost 4 is fast for tests
	if err != nil {
		panic(err)
	}
	return string(h)
}

func bootstrapUser() *domain.User {
	return &domain.User{
		BaseModel:    domain.BaseModel{ID: uuid.MustParse(bootstrapAdminID)},
		Email:        "admin@axiom.local",
		Username:     "bootstrap",
		PasswordHash: mustHash("Admin1234!"),
		Role:         domain.UserRoleAdmin,
		Status:       domain.UserStatusActive,
		IsBootstrap:  true,
	}
}

func activeAdmin(id uuid.UUID) *domain.User {
	return &domain.User{
		BaseModel:    domain.BaseModel{ID: id},
		Email:        "real@example.com",
		Username:     "realadmin",
		PasswordHash: mustHash("Password1!"),
		Role:         domain.UserRoleAdmin,
		Status:       domain.UserStatusActive,
		IsBootstrap:  false,
	}
}

func newSvc(repo *authRepoStub) AuthService {
	return NewAuthService(repo, "test-secret", time.Hour)
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

func TestRegister_Success(t *testing.T) {
	repo := newAuthRepoStub()
	svc := newSvc(repo)

	err := svc.Register(RegisterRequest{
		Email:    "alice@example.com",
		Username: "alice",
		Password: "Password1!",
		FullName: "Alice Smith",
	})
	if err != nil {
		t.Fatalf("Register: unexpected error: %v", err)
	}

	u, lookupErr := repo.FindByEmail("alice@example.com")
	if lookupErr != nil {
		t.Fatalf("expected user to be stored: %v", lookupErr)
	}
	if u.Status != domain.UserStatusPending {
		t.Errorf("Status: want pending, got %v", u.Status)
	}
	if u.Role != domain.UserRoleUser {
		t.Errorf("Role: want user, got %v", u.Role)
	}
}

func TestRegister_DuplicateEmail(t *testing.T) {
	repo := newAuthRepoStub()
	repo.addUser(&domain.User{
		BaseModel: domain.BaseModel{ID: uuid.New()},
		Email:     "alice@example.com",
		Username:  "alice1",
	})
	svc := newSvc(repo)

	err := svc.Register(RegisterRequest{
		Email:    "alice@example.com",
		Username: "alice2",
		Password: "Password1!",
	})
	if err == nil || !strings.Contains(err.Error(), "email already registered") {
		t.Errorf("expected duplicate-email error, got %v", err)
	}
}

func TestRegister_DuplicateUsername(t *testing.T) {
	repo := newAuthRepoStub()
	repo.addUser(&domain.User{
		BaseModel: domain.BaseModel{ID: uuid.New()},
		Email:     "other@example.com",
		Username:  "alice",
	})
	svc := newSvc(repo)

	err := svc.Register(RegisterRequest{
		Email:    "alice@example.com",
		Username: "alice",
		Password: "Password1!",
	})
	if err == nil || !strings.Contains(err.Error(), "username already taken") {
		t.Errorf("expected duplicate-username error, got %v", err)
	}
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

func TestLogin_Success(t *testing.T) {
	repo := newAuthRepoStub()
	u := &domain.User{
		BaseModel:    domain.BaseModel{ID: uuid.New()},
		Email:        "alice@example.com",
		Username:     "alice",
		PasswordHash: mustHash("Password1!"),
		Role:         domain.UserRoleUser,
		Status:       domain.UserStatusActive,
	}
	repo.addUser(u)
	svc := newSvc(repo)

	resp, err := svc.Login("alice@example.com", "Password1!")
	if err != nil {
		t.Fatalf("Login: unexpected error: %v", err)
	}
	if resp.Token == "" {
		t.Error("expected a non-empty JWT token")
	}
	if resp.IsBootstrap {
		t.Error("expected IsBootstrap=false for non-bootstrap user")
	}
}

func TestLogin_UnknownEmail(t *testing.T) {
	repo := newAuthRepoStub()
	svc := newSvc(repo)

	_, err := svc.Login("ghost@example.com", "anything")
	if err == nil || err.Error() != "invalid credentials" {
		t.Errorf("expected generic 'invalid credentials' error, got %v", err)
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	repo := newAuthRepoStub()
	repo.addUser(&domain.User{
		BaseModel:    domain.BaseModel{ID: uuid.New()},
		Email:        "alice@example.com",
		Username:     "alice",
		PasswordHash: mustHash("Password1!"),
		Status:       domain.UserStatusActive,
	})
	svc := newSvc(repo)

	_, err := svc.Login("alice@example.com", "wrong")
	if err == nil || err.Error() != "invalid credentials" {
		t.Errorf("expected 'invalid credentials' error, got %v", err)
	}
}

func TestLogin_InactiveAccount(t *testing.T) {
	repo := newAuthRepoStub()
	repo.addUser(&domain.User{
		BaseModel:    domain.BaseModel{ID: uuid.New()},
		Email:        "alice@example.com",
		Username:     "alice",
		PasswordHash: mustHash("Password1!"),
		Status:       domain.UserStatusInactive,
	})
	svc := newSvc(repo)

	_, err := svc.Login("alice@example.com", "Password1!")
	if err == nil || !strings.Contains(err.Error(), "not active") {
		t.Errorf("expected 'not active' error, got %v", err)
	}
}

func TestLogin_PendingAccount(t *testing.T) {
	repo := newAuthRepoStub()
	repo.addUser(&domain.User{
		BaseModel:    domain.BaseModel{ID: uuid.New()},
		Email:        "alice@example.com",
		Username:     "alice",
		PasswordHash: mustHash("Password1!"),
		Status:       domain.UserStatusPending,
	})
	svc := newSvc(repo)

	_, err := svc.Login("alice@example.com", "Password1!")
	if err == nil || !strings.Contains(err.Error(), "not active") {
		t.Errorf("expected 'not active' error, got %v", err)
	}
}

// A non-bootstrap admin login must deactivate the bootstrap account automatically.
func TestLogin_RealAdminDeactivatesBootstrap(t *testing.T) {
	repo := newAuthRepoStub()

	boot := bootstrapUser()
	repo.addUser(boot)

	realID := uuid.New()
	repo.addUser(activeAdmin(realID))

	svc := newSvc(repo)

	_, err := svc.Login("real@example.com", "Password1!")
	if err != nil {
		t.Fatalf("Login: unexpected error: %v", err)
	}

	stored := repo.users[bootstrapAdminID]
	if stored.Status != domain.UserStatusInactive {
		t.Errorf("bootstrap account: want inactive after real admin login, got %v", stored.Status)
	}
}

// The bootstrap user's IsBootstrap flag must be reflected in the response.
func TestLogin_BootstrapFlagInResponse(t *testing.T) {
	repo := newAuthRepoStub()
	repo.addUser(bootstrapUser())
	svc := newSvc(repo)

	resp, err := svc.Login("admin@axiom.local", "Admin1234!")
	if err != nil {
		t.Fatalf("Login: unexpected error: %v", err)
	}
	if !resp.IsBootstrap {
		t.Error("expected IsBootstrap=true in response for bootstrap admin")
	}
}

// ---------------------------------------------------------------------------
// ApproveUser
// ---------------------------------------------------------------------------

func TestApproveUser_Success(t *testing.T) {
	repo := newAuthRepoStub()
	adminID := uuid.New()
	userID := uuid.New()
	repo.addUser(&domain.User{
		BaseModel: domain.BaseModel{ID: userID},
		Email:     "pending@example.com",
		Status:    domain.UserStatusPending,
	})
	svc := newSvc(repo)

	err := svc.ApproveUser(adminID.String(), userID.String())
	if err != nil {
		t.Fatalf("ApproveUser: unexpected error: %v", err)
	}

	u := repo.users[userID.String()]
	if u.Status != domain.UserStatusActive {
		t.Errorf("Status: want active, got %v", u.Status)
	}
	if u.ApprovedBy == nil || *u.ApprovedBy != adminID {
		t.Errorf("ApprovedBy: want %v, got %v", adminID, u.ApprovedBy)
	}
	if u.ApprovedAt == nil {
		t.Error("ApprovedAt: want non-nil timestamp")
	}
}

func TestApproveUser_BootstrapRejected(t *testing.T) {
	repo := newAuthRepoStub()
	// bootstrap account is already deactivated
	boot := bootstrapUser()
	boot.Status = domain.UserStatusInactive
	repo.addUser(boot)
	svc := newSvc(repo)

	adminID := uuid.New()
	err := svc.ApproveUser(adminID.String(), bootstrapAdminID)
	if err == nil || !strings.Contains(err.Error(), "bootstrap") {
		t.Errorf("expected bootstrap rejection error, got %v", err)
	}
}

func TestApproveUser_UserNotFound(t *testing.T) {
	repo := newAuthRepoStub()
	svc := newSvc(repo)

	err := svc.ApproveUser(uuid.New().String(), uuid.New().String())
	if err == nil || !strings.Contains(err.Error(), "user not found") {
		t.Errorf("expected 'user not found' error, got %v", err)
	}
}

// ---------------------------------------------------------------------------
// RejectUser
// ---------------------------------------------------------------------------

func TestRejectUser_Success(t *testing.T) {
	repo := newAuthRepoStub()
	repo.activeAdminCount = 2 // two admins, so deactivating one is safe
	userID := uuid.New()
	repo.addUser(&domain.User{
		BaseModel: domain.BaseModel{ID: userID},
		Email:     "user@example.com",
		Role:      domain.UserRoleAdmin,
		Status:    domain.UserStatusActive,
	})
	svc := newSvc(repo)

	err := svc.RejectUser(uuid.New().String(), userID.String())
	if err != nil {
		t.Fatalf("RejectUser: unexpected error: %v", err)
	}
	if repo.users[userID.String()].Status != domain.UserStatusInactive {
		t.Error("user should be inactive after rejection")
	}
}

func TestRejectUser_LastAdminBlocked(t *testing.T) {
	repo := newAuthRepoStub()
	repo.activeAdminCount = 1
	userID := uuid.New()
	repo.addUser(&domain.User{
		BaseModel: domain.BaseModel{ID: userID},
		Email:     "last@example.com",
		Role:      domain.UserRoleAdmin,
		Status:    domain.UserStatusActive,
	})
	svc := newSvc(repo)

	err := svc.RejectUser(uuid.New().String(), userID.String())
	if err == nil || !strings.Contains(err.Error(), "last active admin") {
		t.Errorf("expected last-admin protection error, got %v", err)
	}
}

func TestRejectUser_NonAdminNoCountCheck(t *testing.T) {
	repo := newAuthRepoStub()
	repo.countErr = errors.New("should not be called")
	userID := uuid.New()
	repo.addUser(&domain.User{
		BaseModel: domain.BaseModel{ID: userID},
		Email:     "user@example.com",
		Role:      domain.UserRoleUser,
		Status:    domain.UserStatusActive,
	})
	svc := newSvc(repo)

	// Should succeed without querying CountActiveAdmins.
	err := svc.RejectUser(uuid.New().String(), userID.String())
	if err != nil {
		t.Fatalf("RejectUser: unexpected error for non-admin user: %v", err)
	}
}

// ---------------------------------------------------------------------------
// UpdateUserRole
// ---------------------------------------------------------------------------

func TestUpdateUserRole_Promote(t *testing.T) {
	repo := newAuthRepoStub()
	userID := uuid.New()
	repo.addUser(&domain.User{
		BaseModel: domain.BaseModel{ID: userID},
		Email:     "user@example.com",
		Role:      domain.UserRoleUser,
		Status:    domain.UserStatusActive,
	})
	svc := newSvc(repo)

	err := svc.UpdateUserRole(uuid.New().String(), userID.String(), "admin")
	if err != nil {
		t.Fatalf("UpdateUserRole (promote): unexpected error: %v", err)
	}
	if repo.users[userID.String()].Role != domain.UserRoleAdmin {
		t.Error("expected role to be admin after promotion")
	}
}

func TestUpdateUserRole_Demote(t *testing.T) {
	repo := newAuthRepoStub()
	repo.activeAdminCount = 2
	userID := uuid.New()
	repo.addUser(&domain.User{
		BaseModel: domain.BaseModel{ID: userID},
		Email:     "admin@example.com",
		Role:      domain.UserRoleAdmin,
		Status:    domain.UserStatusActive,
	})
	svc := newSvc(repo)

	err := svc.UpdateUserRole(uuid.New().String(), userID.String(), "user")
	if err != nil {
		t.Fatalf("UpdateUserRole (demote): unexpected error: %v", err)
	}
	if repo.users[userID.String()].Role != domain.UserRoleUser {
		t.Error("expected role to be user after demotion")
	}
}

func TestUpdateUserRole_BootstrapRejected(t *testing.T) {
	repo := newAuthRepoStub()
	repo.addUser(bootstrapUser())
	svc := newSvc(repo)

	err := svc.UpdateUserRole(uuid.New().String(), bootstrapAdminID, "user")
	if err == nil || !strings.Contains(err.Error(), "bootstrap") {
		t.Errorf("expected bootstrap rejection error, got %v", err)
	}
}

func TestUpdateUserRole_LastAdminDemoteBlocked(t *testing.T) {
	repo := newAuthRepoStub()
	repo.activeAdminCount = 1
	userID := uuid.New()
	repo.addUser(&domain.User{
		BaseModel: domain.BaseModel{ID: userID},
		Email:     "last@example.com",
		Role:      domain.UserRoleAdmin,
		Status:    domain.UserStatusActive,
	})
	svc := newSvc(repo)

	err := svc.UpdateUserRole(uuid.New().String(), userID.String(), "user")
	if err == nil || !strings.Contains(err.Error(), "last active admin") {
		t.Errorf("expected last-admin protection error, got %v", err)
	}
}

func TestUpdateUserRole_InvalidRole(t *testing.T) {
	repo := newAuthRepoStub()
	userID := uuid.New()
	repo.addUser(&domain.User{
		BaseModel: domain.BaseModel{ID: userID},
		Email:     "user@example.com",
		Role:      domain.UserRoleUser,
		Status:    domain.UserStatusActive,
	})
	svc := newSvc(repo)

	err := svc.UpdateUserRole(uuid.New().String(), userID.String(), "superadmin")
	if err == nil || !strings.Contains(err.Error(), "invalid role") {
		t.Errorf("expected invalid-role error, got %v", err)
	}
}

func TestUpdateUserRole_UserNotFound(t *testing.T) {
	repo := newAuthRepoStub()
	svc := newSvc(repo)

	err := svc.UpdateUserRole(uuid.New().String(), uuid.New().String(), "admin")
	if err == nil || !strings.Contains(err.Error(), "user not found") {
		t.Errorf("expected 'user not found' error, got %v", err)
	}
}

// ---------------------------------------------------------------------------
// IsBootstrapAccount
// ---------------------------------------------------------------------------

func TestIsBootstrapAccount(t *testing.T) {
	svc := newSvc(newAuthRepoStub())

	if !svc.IsBootstrapAccount(bootstrapAdminID) {
		t.Error("expected IsBootstrapAccount(bootstrapAdminID) = true")
	}
	if svc.IsBootstrapAccount(uuid.New().String()) {
		t.Error("expected IsBootstrapAccount(random UUID) = false")
	}
}

// ---------------------------------------------------------------------------
// deactivateBootstrap (via Login side-effect)
// ---------------------------------------------------------------------------

// When the bootstrap account is already inactive, login of a real admin must not error.
func TestLogin_BootstrapAlreadyInactiveIsNoOp(t *testing.T) {
	repo := newAuthRepoStub()
	boot := bootstrapUser()
	boot.Status = domain.UserStatusInactive
	repo.addUser(boot)

	realID := uuid.New()
	repo.addUser(activeAdmin(realID))

	svc := newSvc(repo)

	_, err := svc.Login("real@example.com", "Password1!")
	if err != nil {
		t.Fatalf("Login: unexpected error when bootstrap already inactive: %v", err)
	}
	// Status must remain inactive (no regression).
	if repo.users[bootstrapAdminID].Status != domain.UserStatusInactive {
		t.Error("bootstrap account status must remain inactive")
	}
}

// ---------------------------------------------------------------------------
// ListUsers / GetUser
// ---------------------------------------------------------------------------

func TestListUsers_FilterByStatus(t *testing.T) {
	repo := newAuthRepoStub()
	repo.addUser(&domain.User{
		BaseModel: domain.BaseModel{ID: uuid.New()},
		Email:     "pending@example.com",
		Status:    domain.UserStatusPending,
	})
	repo.addUser(&domain.User{
		BaseModel: domain.BaseModel{ID: uuid.New()},
		Email:     "active@example.com",
		Status:    domain.UserStatusActive,
	})
	svc := newSvc(repo)

	users, err := svc.ListUsers("pending", 100, 0)
	if err != nil {
		t.Fatalf("ListUsers: %v", err)
	}
	if len(users) != 1 {
		t.Errorf("ListUsers(pending): want 1, got %d", len(users))
	}
}

func TestGetUser_NotFound(t *testing.T) {
	svc := newSvc(newAuthRepoStub())

	_, err := svc.GetUser(uuid.New().String())
	if err == nil {
		t.Error("expected error for unknown user")
	}
}

func TestGetUser_Found(t *testing.T) {
	repo := newAuthRepoStub()
	id := uuid.New()
	repo.addUser(&domain.User{
		BaseModel: domain.BaseModel{ID: id},
		Email:     "found@example.com",
	})
	svc := newSvc(repo)

	u, err := svc.GetUser(id.String())
	if err != nil {
		t.Fatalf("GetUser: %v", err)
	}
	if u.Email != "found@example.com" {
		t.Errorf("GetUser: want found@example.com, got %v", u.Email)
	}
}
