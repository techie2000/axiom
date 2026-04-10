---
description: 'Instructions for writing Go code following idiomatic Go practices and community standards'
applyTo: '**/*.go,**/go.mod,**/go.sum'
---

# Go Development Instructions

Follow idiomatic Go practices and community standards when writing Go code. These instructions are based on
[Effective Go](https://go.dev/doc/effective_go), [Go Code Review Comments](https://go.dev/wiki/CodeReviewComments),
and [Google's Go Style Guide](https://google.github.io/styleguide/go/).

## General Instructions

- Write simple, clear, and idiomatic Go code
- Favor clarity and simplicity over cleverness
- Follow the principle of least surprise
- Keep the happy path left-aligned (minimize indentation)
- Return early to reduce nesting
- Prefer early return over if-else chains; use `if condition { return }` pattern to avoid else blocks
- Make the zero value useful
- Write self-documenting code with clear, descriptive names
- Document exported types, functions, methods, and packages
- Use Go modules for dependency management
- Leverage the Go standard library instead of reinventing the wheel (e.g., use `strings.Builder` for string
  concatenation, `filepath.Join` for path construction)
- Prefer standard library solutions over custom implementations when functionality exists
- Write comments in English by default; translate only upon user request
- Avoid using emoji in code and comments

## Naming Conventions

### Packages

- Use lowercase, single-word package names
- Avoid underscores, hyphens, or mixedCaps
- Choose names that describe what the package provides, not what it contains
- Avoid generic names like `util`, `common`, or `base`
- Package names should be singular, not plural

#### Package Declaration Rules (CRITICAL)

- **NEVER duplicate `package` declarations** - each Go file should have exactly ONE package declaration at the top
- Do NOT add package declarations when editing existing files that already have one
- When creating new files, add the package declaration only once at the very beginning
- Package declarations must match the directory name (e.g., files in `handler/` directory must have `package handler`)

### Variables and Functions

- Use mixedCaps or MixedCaps for multi-word names (camelCase or PascalCase)
- Exported names start with uppercase (e.g., `UserService`)
- Unexported names start with lowercase (e.g., `parseRequest`)
- Use short, concise names for local variables (e.g., `i`, `err`, `cfg`)
- Use longer, descriptive names for package-level variables and exported functions
- Acronyms should be all uppercase (e.g., `HTTPServer`, `URLParser`, `IDToken`)
- Use receiver names that are short (1-2 characters) and consistent within a type

### Constants

- Use MixedCaps for exported constants
- Group related constants using `const` blocks with `iota` when appropriate

### Interfaces

- Single-method interfaces should be named by the method name plus "er" suffix (e.g., `Reader`, `Writer`, `Formatter`)
- Avoid generic interface names like `Manager`, `Handler`, or `Controller` unless they truly represent that concept

## Code Organization

### File Structure

- Group related functionality in the same package
- Keep files focused on a single responsibility
- Use meaningful file names that describe their contents
- Organize imports in three groups: standard library, external packages, internal packages

### Import Ordering

```go
import (
    // Standard library
    "context"
    "fmt"
    "time"
    
    // External packages
    "github.com/gin-gonic/gin"
    "gorm.io/gorm"
    
    // Internal packages
    "github.com/techie2000/axiom/backend/internal/domain"
    "github.com/techie2000/axiom/backend/pkg/logger"
)
```

### Package Organization

Follow a layered architecture:

- `cmd/` - Application entry points
- `internal/` - Private application code
  - `domain/` - Domain models and business entities
  - `repository/` - Data access layer
  - `service/` - Business logic layer
  - `handler/` - HTTP handlers (presentation layer)
  - `middleware/` - HTTP middleware
  - `config/` - Configuration management
- `pkg/` - Public reusable packages
- `migrations/` - Database migrations

## Error Handling

- Always check errors; never ignore them with `_`
- Wrap errors with context using `fmt.Errorf` with `%w` verb
- Return errors rather than panicking in library code
- Use `panic` only for truly exceptional situations
- Prefer custom error types for package-level errors
- Log errors at the appropriate level (error, warn, info)

```go
// Good
if err != nil {
    return fmt.Errorf("failed to connect to database: %w", err)
}

// Bad - ignoring errors
db.Close() // should check error
```

## Comments and Documentation

### Package Comments

- Every package should have a package comment
- Package comments should describe what the package does
- Place package comments in a dedicated `doc.go` file for complex packages

```go
// Package handler provides HTTP request handlers for the Axiom API.
package handler
```

### Function Comments

- Document all exported functions, types, and methods
- Start comments with the name of the thing being described
- Use complete sentences
- Explain what, not how (code shows how)

```go
// CreateUser creates a new user account with the provided details.
// It returns an error if the email is already in use.
func CreateUser(ctx context.Context, req *CreateUserRequest) (*User, error) {
    // implementation
}
```

### Inline Comments

- Use inline comments sparingly
- Explain why, not what (the code shows what)
- Keep comments up-to-date with code changes

## Functions and Methods

### Function Design

- Keep functions small and focused on a single task
- Limit function parameters (prefer structs for >3 parameters)
- Use named return values sparingly and only when they improve clarity
- Prefer explicit returns over named returns in most cases

### Method Receivers

- Use pointer receivers for methods that modify the receiver
- Use pointer receivers for large structs to avoid copying
- Be consistent with receiver types for a given type
- Receiver names should be short (1-2 characters)

```go
// Good
func (s *UserService) CreateUser(ctx context.Context, user *User) error {
    // implementation
}

// Bad - inconsistent receiver types
func (s *UserService) GetUser(id string) (*User, error) { }
func (s UserService) DeleteUser(id string) error { }  // Should use pointer receiver
```

## Concurrency

- Use channels to communicate between goroutines
- Use `sync.WaitGroup` for goroutine synchronization
- Protect shared state with `sync.Mutex` or `sync.RWMutex`
- Prefer passing data through channels over sharing memory
- Always provide a way to stop goroutines (context cancellation)
- Document goroutine ownership and lifecycle

```go
// Good - using context for cancellation
func (s *Service) Start(ctx context.Context) error {
    go func() {
        ticker := time.NewTicker(time.Minute)
        defer ticker.Stop()
        
        for {
            select {
            case <-ctx.Done():
                return
            case <-ticker.C:
                s.doWork()
            }
        }
    }()
    return nil
}
```

## Testing

### Test Files

- Place tests in the same package as the code being tested
- Use `_test.go` suffix for test files
- Test file should be named after the file it tests (e.g., `user.go` → `user_test.go`)

### Test Functions

- Use table-driven tests for multiple similar test cases
- Name tests descriptively: `TestFunctionName_Scenario_ExpectedBehavior`
- Use subtests with `t.Run()` for better organization
- Test both success and failure cases
- Use test helpers to reduce duplication

```go
func TestUserService_CreateUser(t *testing.T) {
    tests := []struct {
        name    string
        input   *CreateUserRequest
        want    *User
        wantErr bool
    }{
        {
            name: "valid user",
            input: &CreateUserRequest{Email: "test@example.com"},
            want: &User{Email: "test@example.com"},
            wantErr: false,
        },
        {
            name: "duplicate email",
            input: &CreateUserRequest{Email: "exists@example.com"},
            want: nil,
            wantErr: true,
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := service.CreateUser(context.Background(), tt.input)
            if (err != nil) != tt.wantErr {
                t.Errorf("CreateUser() error = %v, wantErr %v", err, tt.wantErr)
                return
            }
            if !reflect.DeepEqual(got, tt.want) {
                t.Errorf("CreateUser() = %v, want %v", got, tt.want)
            }
        })
    }
}
```

## Database and GORM

### Model Definitions

- Use GORM struct tags for database mapping
- Define indexes and constraints in struct tags
- Use `gorm.Model` for standard fields (ID, CreatedAt, UpdatedAt, DeletedAt)
- Use UUID for primary keys where appropriate
- Use proper foreign key relationships

```go
type User struct {
    ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
    Email     string    `gorm:"uniqueIndex;not null;size:255"`
    Name      string    `gorm:"not null;size:255"`
    CreatedAt time.Time
    UpdatedAt time.Time
    DeletedAt gorm.DeletedAt `gorm:"index"`
}
```

### Repository Pattern

- Use repository interfaces for data access
- Keep repository methods focused on data operations
- Business logic belongs in service layer, not repositories
- Use transactions for multi-step operations

```go
type UserRepository interface {
    Create(ctx context.Context, user *User) error
    FindByID(ctx context.Context, id uuid.UUID) (*User, error)
    Update(ctx context.Context, user *User) error
    Delete(ctx context.Context, id uuid.UUID) error
}
```

## HTTP Handlers (Gin Framework)

### Handler Structure

- Keep handlers thin - delegate to service layer
- Validate input early
- Return appropriate HTTP status codes
- Use consistent error response format
- Log errors appropriately

```go
func (h *UserHandler) CreateUser(c *gin.Context) {
    var req CreateUserRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
        return
    }
    
    user, err := h.userService.CreateUser(c.Request.Context(), &req)
    if err != nil {
        h.logger.Error("failed to create user", "error", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        return
    }
    
    c.JSON(http.StatusCreated, user)
}
```

### Middleware

- Use middleware for cross-cutting concerns (auth, logging, CORS)
- Keep middleware focused on a single responsibility
- Document middleware behavior and side effects

## Security

- Never log sensitive data (passwords, tokens, PII)
- Use parameterized queries to prevent SQL injection (GORM does this)
- Validate and sanitize all user input
- Use HTTPS in production
- Implement rate limiting
- Use secure random number generation (`crypto/rand`)
- Store secrets in environment variables or secret management systems
- Implement proper authentication and authorization

## Performance

- Profile before optimizing
- Use `sync.Pool` for frequently allocated objects
- Avoid premature optimization
- Use buffered channels when appropriate
- Close resources (files, database connections) with defer
- Use `strings.Builder` for string concatenation in loops

## Common Patterns

### Context Usage

- Pass `context.Context` as the first parameter
- Respect context cancellation
- Use context for request-scoped values sparingly

### Error Wrapping

```go
if err := doSomething(); err != nil {
    return fmt.Errorf("doing something: %w", err)
}
```

### Option Pattern

```go
type Config struct {
    timeout time.Duration
    retries int
}

type Option func(*Config)

func WithTimeout(d time.Duration) Option {
    return func(c *Config) {
        c.timeout = d
    }
}

func NewService(opts ...Option) *Service {
    cfg := &Config{
        timeout: 30 * time.Second,
        retries: 3,
    }
    for _, opt := range opts {
        opt(cfg)
    }
    return &Service{config: cfg}
}
```

## Tools and Linting

Use the following tools to maintain code quality:

- `gofmt` - Format code (automatically applied)
- `go vet` - Examine code for common mistakes
- `golangci-lint` - Comprehensive linter
- `go mod tidy` - Clean up dependencies

Run before committing:

```bash
go fmt ./...
go vet ./...
golangci-lint run
go test ./...
```

## Anti-Patterns to Avoid

- Don't use `init()` functions unless absolutely necessary
- Avoid global variables; prefer dependency injection
- Don't use panics for normal error handling
- Avoid deeply nested code; extract functions
- Don't ignore errors with `_` unless there's a good reason
- Avoid premature abstraction
- Don't use reflection unless necessary
- Avoid mixing tabs and spaces (use tabs for indentation)

## Project-Specific Guidelines

### Axiom Backend

- Use layered architecture: handler → service → repository
- Keep business logic in service layer
- Use GORM for all database operations
- Follow ISO20022 standards for financial data models
- Use UUID for primary keys on transactional tables
- Implement proper error handling and logging
- Use middleware for authentication, CORS, rate limiting
- Return generic error messages to clients (don't expose internal details)

### Database Migrations

- Use golang-migrate for database migrations
- Write both up and down migrations
- Test migrations before committing
- Keep migrations reversible when possible
- Include proper indexes and constraints

## References

- [Effective Go](https://go.dev/doc/effective_go)
- [Go Code Review Comments](https://go.dev/wiki/CodeReviewComments)
- [Google Go Style Guide](https://google.github.io/styleguide/go/)
- [Uber Go Style Guide](https://github.com/uber-go/guide/blob/master/style.md)
