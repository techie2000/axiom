package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/repository"
	"github.com/techie2000/axiom/pkg/logger"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// AuthService provides user registration, login, and administration functions.
type AuthService interface {
	// Register creates a new user registration request (status = pending).
	Register(req RegisterRequest) error
	// Login authenticates a user and returns a signed JWT token.
	Login(email, password string) (*LoginResponse, error)
	// ListUsers returns users filtered by status.
	ListUsers(status string, limit, offset int) ([]*domain.User, error)
	// GetUser returns a single user by ID.
	GetUser(id string) (*domain.User, error)
	// ApproveUser activates a pending user account.
	ApproveUser(adminID, userID string) error
	// RejectUser deactivates a user account (fails if this would remove the last active admin).
	RejectUser(adminID, userID string) error
	// UpdateUserRole changes a user's role. Fails when demoting the last active admin.
	UpdateUserRole(adminID, userID, role string) error
	// EnsureBootstrapAdmin seeds the default admin account if no active admin exists.
	EnsureBootstrapAdmin() error
	// IsBootstrapAccount returns true when the given user ID belongs to the bootstrap admin.
	IsBootstrapAccount(userID string) bool
	// EnsurePlaywrightTestUser seeds a dedicated active test user for Playwright
	// end-to-end testing. Must only be called in dev/main environments
	// (i.e. when PLAYWRIGHT_SEED_USER=true). The user is created with the
	// supplied email and password; if it already exists the call is a no-op.
	EnsurePlaywrightTestUser(email, password string) error
}

// RegisterRequest holds the fields required for a registration request.
type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Username string `json:"username" binding:"required,min=3,max=100"`
	Password string `json:"password" binding:"required,min=8"`
	FullName string `json:"full_name"`
}

// LoginResponse is returned after a successful authentication.
type LoginResponse struct {
	Token       string      `json:"token"`
	User        *domain.User `json:"user"`
	IsBootstrap bool        `json:"is_bootstrap"`
}

const bootstrapAdminID = "00000000-0000-0000-0000-000000000001"

type authService struct {
	repo      repository.UserRepository
	jwtSecret string
	jwtExpiry time.Duration
}

// NewAuthService creates a new AuthService.
func NewAuthService(repo repository.UserRepository, jwtSecret string, jwtExpiry time.Duration) AuthService {
	return &authService{
		repo:      repo,
		jwtSecret: jwtSecret,
		jwtExpiry: jwtExpiry,
	}
}

func (s *authService) Register(req RegisterRequest) error {
	// Check for duplicate email — treat unexpected DB errors as hard failures.
	existing, err := s.repo.FindByEmail(req.Email)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return fmt.Errorf("database error while checking existing email: %w", err)
	}
	if existing != nil {
		return errors.New("email already registered")
	}
	// Check for duplicate username — treat unexpected DB errors as hard failures.
	existingU, err := s.repo.FindByUsername(req.Username)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return fmt.Errorf("database error while checking existing username: %w", err)
	}
	if existingU != nil {
		return errors.New("username already taken")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	user := &domain.User{
		Email:        req.Email,
		Username:     req.Username,
		PasswordHash: string(hash),
		FullName:     req.FullName,
		Role:         domain.UserRoleUser,
		Status:       domain.UserStatusPending,
	}
	return s.repo.Create(user)
}

func (s *authService) Login(email, password string) (*LoginResponse, error) {
	user, err := s.repo.FindByEmail(email)
	if err != nil {
		// Return a generic message to prevent user-enumeration
		return nil, errors.New("invalid credentials")
	}

	if user.Status != domain.UserStatusActive {
		// Use a generic error to prevent revealing whether an e-mail is registered.
		return nil, errors.New("invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("invalid credentials")
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	// Auto-deactivate the bootstrap account when a real (non-bootstrap) admin logs in.
	if user.Role == domain.UserRoleAdmin && !user.IsBootstrap {
		s.deactivateBootstrap()
	}

	return &LoginResponse{
		Token:       token,
		User:        user,
		IsBootstrap: user.IsBootstrap,
	}, nil
}

// deactivateBootstrap sets the bootstrap seed account to inactive when it is no longer needed.
// Failures are logged as warnings but never block a legitimate login.
func (s *authService) deactivateBootstrap() {
	bootstrap, err := s.repo.FindByID(bootstrapAdminID)
	if err != nil || bootstrap == nil || bootstrap.Status == domain.UserStatusInactive {
		return
	}
	bootstrap.Status = domain.UserStatusInactive
	if err := s.repo.Update(bootstrap); err != nil {
		logger.Warn().Err(err).Msg("failed to auto-deactivate bootstrap admin account")
	}
}

func (s *authService) ListUsers(status string, limit, offset int) ([]*domain.User, error) {
	return s.repo.FindAll(status, limit, offset)
}

func (s *authService) GetUser(id string) (*domain.User, error) {
	return s.repo.FindByID(id)
}

func (s *authService) ApproveUser(adminID, userID string) error {
	user, err := s.repo.FindByID(userID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// The bootstrap account must never be reactivated through any code path; its lifecycle
	// is managed exclusively by auto-deactivation on first real-admin login.
	if user.IsBootstrap {
		return errors.New("the bootstrap admin account cannot be reactivated")
	}

	approverID, err := uuid.Parse(adminID)
	if err != nil {
		return fmt.Errorf("invalid admin ID: %w", err)
	}

	now := time.Now().UTC()
	user.Status = domain.UserStatusActive
	user.ApprovedBy = &approverID
	user.ApprovedAt = &now
	return s.repo.Update(user)
}

func (s *authService) RejectUser(adminID, userID string) error {
	user, err := s.repo.FindByID(userID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Prevent deactivating the last active admin.
	if user.Role == domain.UserRoleAdmin && user.Status == domain.UserStatusActive {
		count, err := s.repo.CountActiveAdmins()
		if err != nil {
			return fmt.Errorf("could not verify admin count: %w", err)
		}
		if count <= 1 {
			return errors.New("cannot deactivate the last active admin user")
		}
	}

	// TODO: record adminID in audit trail when audit logging is implemented
	_ = adminID
	user.Status = domain.UserStatusInactive
	return s.repo.Update(user)
}

func (s *authService) UpdateUserRole(adminID, userID, role string) error {
	newRole := domain.UserRole(role)
	if newRole != domain.UserRoleAdmin && newRole != domain.UserRoleUser {
		return fmt.Errorf("invalid role %q: must be 'admin' or 'user'", role)
	}

	user, err := s.repo.FindByID(userID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Block all role changes on the bootstrap account — it must stay as admin until it is
	// auto-deactivated, and once deactivated it is permanently locked.
	if user.IsBootstrap {
		return errors.New("the bootstrap admin account role cannot be changed")
	}

	// Prevent demoting the last active admin.
	if user.Role == domain.UserRoleAdmin && newRole == domain.UserRoleUser {
		count, err := s.repo.CountActiveAdmins()
		if err != nil {
			return fmt.Errorf("could not verify admin count: %w", err)
		}
		if count <= 1 {
			return errors.New("cannot demote the last active admin user")
		}
	}

	// TODO: record adminID in audit trail when audit logging is implemented
	_ = adminID
	user.Role = newRole
	return s.repo.Update(user)
}

func (s *authService) EnsureBootstrapAdmin() error {
	// First, check if there is already at least one active admin. If so, there is nothing to do.
	count, err := s.repo.CountActiveAdmins()
	if err != nil {
		return fmt.Errorf("could not verify admin count: %w", err)
	}
	if count > 0 {
		return nil
	}

	// No active admins exist. Ensure the bootstrap admin account is present and active.
	user, err := s.repo.FindByID(bootstrapAdminID)
	if err != nil {
		// If the DB migration has not run yet (or the bootstrap row does not exist),
		// skip silently – the migration is responsible for seeding the bootstrap admin.
		return nil
	}

	// If the record with the bootstrap ID is not marked as a bootstrap account, treat this
	// as a configuration error rather than silently modifying an arbitrary user.
	if !user.IsBootstrap {
		return fmt.Errorf("bootstrap admin account configuration error: unexpected user record at bootstrap ID")
	}

	// Reactivate and enforce admin role on the bootstrap account when it is not currently active.
	if user.Status != domain.UserStatusActive || user.Role != domain.UserRoleAdmin {
		user.Status = domain.UserStatusActive
		user.Role = domain.UserRoleAdmin
		if err := s.repo.Update(user); err != nil {
			return fmt.Errorf("failed to update bootstrap admin account: %w", err)
		}
	}
	return nil
}

func (s *authService) IsBootstrapAccount(userID string) bool {
	return userID == bootstrapAdminID
}

// playwrightTestUserID is the fixed UUID for the Playwright test user. Using a
// fixed ID makes the seed idempotent and allows it to be safely re-run on every
// startup. This ID must never be used in UAT or production deployments.
const playwrightTestUserID = "00000000-0000-0000-0000-000000000002"

func validatePlaywrightSeedCredentials(email, password string) error {
	normalizedEmail := strings.TrimSpace(strings.ToLower(email))
	normalizedPassword := strings.TrimSpace(password)
	if normalizedEmail == "" {
		return errors.New("playwright test user email is required")
	}
	if normalizedPassword == "" {
		return errors.New("playwright test user password is required")
	}

	atIdx := strings.LastIndex(normalizedEmail, "@")
	if atIdx <= 0 || atIdx == len(normalizedEmail)-1 {
		return fmt.Errorf("playwright test user email must be a valid dev/test address: %q", email)
	}

	username := normalizedEmail[:atIdx]
	domainPart := normalizedEmail[atIdx+1:]
	allowedDomains := []string{"localhost", "example.com"}
	allowedDomainSuffixes := []string{".local", ".test"}

	isAllowedDomain := false
	for _, allowedDomain := range allowedDomains {
		if domainPart == allowedDomain {
			isAllowedDomain = true
			break
		}
	}
	if !isAllowedDomain {
		for _, suffix := range allowedDomainSuffixes {
			if strings.HasSuffix(domainPart, suffix) {
				isAllowedDomain = true
				break
			}
		}
	}
	if !isAllowedDomain {
		return fmt.Errorf("refusing to seed playwright test user for non-dev/test email domain: %q", email)
	}

	normalizedPasswordLower := strings.ToLower(normalizedPassword)
	disallowedPasswords := map[string]struct{}{
		"password":    {},
		"password123": {},
		"changeme":    {},
		"admin":       {},
		"playwright":  {},
	}
	if _, found := disallowedPasswords[normalizedPasswordLower]; found {
		return errors.New("refusing to seed playwright test user with a default or weak password")
	}
	if normalizedPasswordLower == normalizedEmail || normalizedPasswordLower == username {
		return errors.New("refusing to seed playwright test user with a predictable password")
	}

	return nil
}

// EnsurePlaywrightTestUser creates or reactivates a dedicated Playwright test
// user so that end-to-end tests can authenticate without manual setup.
// The user is always given role=admin so that tests can exercise every
// protected endpoint.
//
// IMPORTANT: This method must only be called when PLAYWRIGHT_SEED_USER=true,
// which should be set in dev/main .env files only, never in UAT or production.
// The caller (main.go) is responsible for gate-checking the config flag before
// invoking this method.
func (s *authService) EnsurePlaywrightTestUser(email, password string) error {
	if err := validatePlaywrightSeedCredentials(email, password); err != nil {
		return fmt.Errorf("playwright test user seeding blocked: %w", err)
	}

	// Derive a username from the local part of the email address (e.g.
	// "playwright" from "playwright@axiom.local") so the username stays
	// consistent with whatever email is configured.
	username := email
	if atIdx := strings.Index(email, "@"); atIdx > 0 {
		username = email[:atIdx]
	}

	// Check whether the user already exists (by the fixed ID).
	existing, err := s.repo.FindByID(playwrightTestUserID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return fmt.Errorf("database error while checking playwright test user: %w", err)
	}

	updated := false

	if existing != nil {
		// User exists. Ensure email matches the configured Playwright email.
		if existing.Email != email {
			existing.Email = email
			updated = true
		}

		// Ensure username matches the one derived from the email.
		if existing.Username != username {
			existing.Username = username
			updated = true
		}

		// Ensure the password hash matches the configured Playwright password.
		if err := bcrypt.CompareHashAndPassword([]byte(existing.PasswordHash), []byte(password)); err != nil {
			hash, hashErr := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
			if hashErr != nil {
				return fmt.Errorf("failed to hash playwright test user password: %w", hashErr)
			}
			existing.PasswordHash = string(hash)
			updated = true
		}

		// Ensure the user is active so tests can log in.
		if existing.Status != domain.UserStatusActive {
			existing.Status = domain.UserStatusActive
			updated = true
		}

		if updated {
			if updateErr := s.repo.Update(existing); updateErr != nil {
				return fmt.Errorf("failed to reconcile playwright test user: %w", updateErr)
			}
			logger.Info().Msg("Playwright test user reconciled to match configured credentials")
		} else {
			logger.Info().Msg("Playwright test user already exists with matching credentials")
		}
		return nil
	}

	// Also check by email in case of a collision with a manually created account.
	byEmail, emailErr := s.repo.FindByEmail(email)
	if emailErr != nil && !errors.Is(emailErr, gorm.ErrRecordNotFound) {
		return fmt.Errorf("database error while checking email: %w", emailErr)
	}
	if emailErr == nil && byEmail != nil {
		logger.Warn().
			Str("email", email).
			Msg("Playwright test user email is already taken by another account; skipping seed")
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash playwright test user password: %w", err)
	}

	user := &domain.User{
		BaseModel:    domain.BaseModel{ID: uuid.MustParse(playwrightTestUserID)},
		Email:        email,
		Username:     username,
		PasswordHash: string(hash),
		FullName:     "Playwright Test User",
		Role:         domain.UserRoleAdmin,
		Status:       domain.UserStatusActive,
		IsBootstrap:  false,
	}

	if createErr := s.repo.Create(user); createErr != nil {
		return fmt.Errorf("failed to create playwright test user: %w", createErr)
	}

	logger.Info().Str("email", email).Msg("Playwright test user created successfully")
	return nil
}

// generateToken issues a signed JWT for the given user.
func (s *authService) generateToken(user *domain.User) (string, error) {
	now := time.Now().UTC()
	claims := jwt.MapClaims{
		"user_id":  user.ID.String(),
		"email":    user.Email,
		"username": user.Username,
		"role":     string(user.Role),
		"iat":      now.Unix(),
		"exp":      now.Add(s.jwtExpiry).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}
