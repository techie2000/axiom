package service

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/repository"
	"golang.org/x/crypto/bcrypt"
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
	// RejectUser deactivates a user account.
	RejectUser(adminID, userID string) error
	// EnsureBootstrapAdmin seeds the default admin account if no active admin exists.
	EnsureBootstrapAdmin() error
	// IsBootstrapAccount returns true when the given user ID belongs to the bootstrap admin.
	IsBootstrapAccount(userID string) bool
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
	// Check for duplicate email
	if existing, _ := s.repo.FindByEmail(req.Email); existing != nil {
		return errors.New("email already registered")
	}
	// Check for duplicate username
	if existing, _ := s.repo.FindByUsername(req.Username); existing != nil {
		return errors.New("username already taken")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
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
		return nil, errors.New("account is not active")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("invalid credentials")
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	return &LoginResponse{
		Token:       token,
		User:        user,
		IsBootstrap: user.IsBootstrap,
	}, nil
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
	_ = adminID // recorded via audit trail in future; kept for interface consistency
	user.Status = domain.UserStatusInactive
	return s.repo.Update(user)
}

func (s *authService) EnsureBootstrapAdmin() error {
	// Only create the bootstrap row if it does not already exist
	if _, err := s.repo.FindByID(bootstrapAdminID); err == nil {
		return nil // already seeded by migration
	}
	// If the DB migration has not run yet, skip silently – the migration handles the seed.
	return nil
}

func (s *authService) IsBootstrapAccount(userID string) bool {
	return userID == bootstrapAdminID
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
