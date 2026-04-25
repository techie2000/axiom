# Backend Agent Instructions

> **Read first:** Also consult the root [`AGENTS.md`](../AGENTS.md) for project-wide conventions,
> ADR standards, diagram guidelines, and PR/CI workflows.

This file provides backend-specific coding standards for the Axiom Go backend.
It is the canonical reference for AI agents working in the `backend/` directory.

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

---

# SQL Formatting Guidelines for Axiom

## Core Principles

These rules are enforced by SQLFluff and should be followed when writing SQL code.

## Layout Rules

### Indentation (LT02)

- **NO indentation at root level**: Top-level SQL statements (ALTER, CREATE, DROP, etc.) start at column 1
- **Use 4 spaces** for nested indentation (within parentheses, subqueries, etc.)
- **DO NOT use tabs** - always use spaces
- **Continuation lines in top-level WHERE clauses must also start at column 1** when SQLFluff enforces LT02
- **Inside parenthesized boolean groups**, indent each predicate by exactly **4 spaces**

```sql
-- ✅ GOOD: Top-level WHERE continuation at column 1
CREATE INDEX idx_example_top_level
ON lei_raw.lei_records (BTRIM(entity_legal_form))
WHERE deleted_at IS NULL
AND entity_legal_form IS NOT NULL
AND BTRIM(entity_legal_form) <> '';

-- ✅ GOOD: Nested boolean group uses 4-space indentation
CREATE INDEX idx_example_nested
ON lei_raw.lei_records (legal_name)
WHERE deleted_at IS NULL
AND (
    entity_status IS NULL
    OR BTRIM(entity_status) = ''
    OR UPPER(BTRIM(entity_status)) = 'NULL'
);
```

```sql
-- ❌ BAD: Indented root level
    ALTER TABLE lei_raw.source_files
        ADD COLUMN retry_count INTEGER;

-- ✅ GOOD: No indentation at root level
ALTER TABLE lei_raw.source_files
    ADD COLUMN retry_count INTEGER;

-- ❌ BAD: Indented continuation predicates at top level
CREATE INDEX idx_example
ON lei_raw.lei_records (BTRIM(entity_legal_form))
WHERE deleted_at IS NULL
    AND entity_legal_form IS NOT NULL
    AND BTRIM(entity_legal_form) <> '';

-- ✅ GOOD: Continuation predicates aligned at column 1
CREATE INDEX idx_example
ON lei_raw.lei_records (BTRIM(entity_legal_form))
WHERE deleted_at IS NULL
AND entity_legal_form IS NOT NULL
AND BTRIM(entity_legal_form) <> '';
```

### Trailing Whitespace (LT01)

- **NO trailing whitespace** at end of lines
- SQLFluff will automatically remove them

### Line Length (LT05)

- Maximum 120 characters per line
- Break long lines at natural boundaries (commas, operators)

### Spacing (LT01)

- **Single space** between identifier and opening parenthesis
- **Single space** after commas in lists
- **Touch** before semicolons (no space)
- **Touch** before commas (no space)

```sql
-- ❌ BAD: No space before parenthesis
CREATE INDEX idx_name ON table(column);

-- ✅ GOOD: Single space before parenthesis
CREATE INDEX idx_name ON table (column);
```

## Capitalization Rules

### Keywords (CP01, CP02)

- **UPPERCASE** for all SQL keywords: SELECT, FROM, WHERE, CREATE, ALTER, etc.

```sql
-- ❌ BAD: Lowercase keywords
select * from users where id = 1;

-- ✅ GOOD: Uppercase keywords
SELECT * FROM users WHERE id = 1;
```

### Identifiers (CP01)

- **lowercase** for table names, column names, schema names
- Use underscores for multi-word names: `legal_address_country`

```sql
-- ❌ BAD: Mixed case identifiers
CREATE TABLE UserAccounts (UserID INT);

-- ✅ GOOD: Lowercase identifiers
CREATE TABLE user_accounts (user_id INT);
```

### Functions (CP03)

- **UPPERCASE** for function names: NOW(), GEN_RANDOM_UUID(), COALESCE()

```sql
-- ❌ BAD: Lowercase function
created_at TIMESTAMP NOT NULL DEFAULT now()

-- ✅ GOOD: Uppercase function
created_at TIMESTAMP NOT NULL DEFAULT NOW()
```

### Data Types (CP04)

- **UPPERCASE** for data types: INTEGER, VARCHAR, UUID, TIMESTAMP

```sql
-- ❌ BAD: Lowercase types
id uuid PRIMARY KEY,
name varchar(100)

-- ✅ GOOD: Uppercase types
id UUID PRIMARY KEY,
name VARCHAR(100)
```

### Literals (CP04)

- **UPPERCASE** for NULL, TRUE, FALSE

```sql
-- ❌ BAD: Lowercase literals
WHERE deleted_at IS null

-- ✅ GOOD: Uppercase literals
WHERE deleted_at IS NULL
```

## Structure Rules

### Statement Terminators (LT08)

- **Always end statements** with semicolons
- **No space** before semicolon (touch)

```sql
-- ❌ BAD: No semicolon
CREATE TABLE users (id INTEGER)

-- ✅ GOOD: With semicolon
CREATE TABLE users (id INTEGER);
```

### Comma Placement

- **Trailing commas** (commas at end of line)
- **No space** before comma
- **Single space** after comma

```sql
-- ❌ BAD: Leading commas
CREATE TABLE users (
    id UUID
    , name VARCHAR(100)
    , email VARCHAR(255)
);

-- ✅ GOOD: Trailing commas
CREATE TABLE users (
    id UUID,
    name VARCHAR(100),
    email VARCHAR(255)
);
```

### Multi-line Format

```sql
-- ✅ GOOD: Property formatting for multi-line
ALTER TABLE lei_raw.source_files
    ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN max_retries INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN failure_category VARCHAR(50);
```

## Naming Conventions

### Tables

- Lowercase, plural nouns
- Use underscores for compound names
- Examples: `users`, `lei_records`, `source_files`

### Columns

- Lowercase, descriptive names
- Use underscores for compound names
- Suffix foreign keys with `_id`
- Examples: `user_id`, `legal_name`, `created_at`

### Indexes

- Prefix with `idx_`
- Include table name and column(s)
- Examples: `idx_users_email`, `idx_lei_records_lei`

### Constraints

- Primary keys: Let database auto-name or use `pk_tablename`
- Foreign keys: `fk_table1_table2` or let database auto-name
- Unique: `uq_tablename_column`

## Comments

### Block Comments

```sql
-- Multi-line comment explaining
-- complex logic or business rules
-- that need clarification
```

### Inline Comments

```sql
CREATE TABLE users (
    id UUID,  -- Unique identifier
    created_at TIMESTAMP  -- Record creation time
);
```

### COMMENT Statements

```sql
COMMENT ON COLUMN source_files.retry_count IS 
'Number of times this file processing has been retried';
```

## Quick Reference

| Rule | Requirement | Example |
| ------ | ------------- | --------- |
| LT01 | No trailing whitespace | `WHERE id = 1` (not `WHERE id = 1`) |
| LT02 | No root-level indentation | `ALTER TABLE` starts at column 1 |
| LT05 | Max 120 chars per line | Break long lines at commas |
| LT08 | End with semicolon | `SELECT 1;` |
| CP01 | Keywords UPPERCASE | `SELECT FROM WHERE` |
| CP01 | Identifiers lowercase | `user_id`, `table_name` |
| CP03 | Functions UPPERCASE | `NOW()`, `UUID()` |
| CP04 | Types UPPERCASE | `INTEGER`, `VARCHAR` |
| CP04 | Literals UPPERCASE | `NULL`, `TRUE`, `FALSE` |
| RF04 | Avoid keyword names | Don't use `user`, `order` as identifiers |

## Required SQL Validation Workflow

When editing any `.sql` file (especially migrations), follow this workflow before commit:

1. **Lint check is mandatory**
    - Run: `sqlfluff lint backend/migrations/*.sql`
    - Or verify no SQLFluff diagnostics remain in VS Code Problems panel.

2. **Fix lint issues in the same change**
    - Prefer deterministic formatting fixes immediately after SQL edits.
    - Do not leave LT02/LT01/LT08 issues for follow-up commits.

3. **Re-check after fixes**
    - Re-run lint/diagnostics and confirm clean output for changed SQL files.

4. **Do not commit SQL with known SQLFluff errors**
    - SQL formatting compliance is part of the definition of done.

## Database Documentation with COMMENT ON

### **MANDATORY**: Every table and column MUST have a COMMENT

**Why This Matters:**

- Database schema serves as living documentation
- SQL tools and ORMs display comments in autocomplete
- DBAs and developers can understand purpose without reading code
- Comments are visible in `psql \d+` and database IDE tools

### Table Comments

Every table MUST have a descriptive comment explaining its purpose:

```sql
CREATE TABLE lei_raw.lei_records (
    id UUID PRIMARY KEY,
    lei VARCHAR(20) NOT NULL UNIQUE
    -- ... columns ...
);

COMMENT ON TABLE lei_raw.lei_records IS 
'Raw LEI (Legal Entity Identifier) data from GLEIF. Contains entity legal names, addresses, registration details, and validation status for all global legal entities.';
```

### Column Comments

Every column MUST have a comment describing:

- **Purpose**: What the column stores
- **Format**: Data format or constraints (if not obvious from type)
- **Source**: Where data comes from (if external)
- **Business Rules**: Any validation rules or special meanings

```sql
COMMENT ON COLUMN lei_raw.lei_records.lei IS 
'20-character Legal Entity Identifier code (ISO 17442 standard). Unique global identifier for legal entities.';

COMMENT ON COLUMN lei_raw.lei_records.legal_address_country IS 
'ISO 3166-1 alpha-2 country code (2 letters). Legal registered address country.';

COMMENT ON COLUMN lei_raw.lei_records.entity_status IS 
'Current status of the legal entity: ACTIVE, INACTIVE, MERGED, etc. From GLEIF EntityStatus enumeration.';

COMMENT ON COLUMN lei_raw.lei_records.other_names IS 
'JSONB array of alternate entity names. Each object contains: name, type (PREVIOUS_LEGAL_NAME, TRADING_NAME, etc.), and language code.';

COMMENT ON COLUMN lei_raw.source_files.processing_status IS 
'File processing lifecycle status: PENDING (queued), IN_PROGRESS (actively processing), COMPLETED (success), FAILED (error occurred).';

COMMENT ON COLUMN lei_raw.source_files.failure_category IS 
'Categorized failure reason (only set when processing_status=FAILED): SCHEMA_ERROR, NETWORK_ERROR, FILE_CORRUPTION, FILE_MISSING, TIMEOUT, or UNKNOWN. Empty string for non-failed records.';
```

### When to Write Comments

**In CREATE TABLE migrations:**

```sql
CREATE TABLE example (
    id UUID PRIMARY KEY,
    status VARCHAR(20)
);

-- Add comments immediately after CREATE TABLE
COMMENT ON TABLE example IS 'Description of table purpose';
COMMENT ON COLUMN example.id IS 'Unique identifier (UUID v4)';
COMMENT ON COLUMN example.status IS 'Status values: ACTIVE, PAUSED, DELETED';
```

**In ALTER TABLE migrations:**

```sql
ALTER TABLE example
    ADD COLUMN retry_count INTEGER DEFAULT 0;

-- Add comment for new column
COMMENT ON COLUMN example.retry_count IS 'Number of retry attempts (0-3). Incremented on FAILED status; reset to 0 on success.';
```

### Comment Style Guide

✅ **GOOD Comments:**

- Start with what the field stores
- Include format/constraints
- Mention enumerations or valid values
- Note relationships to other tables
- Explain business rules

❌ **BAD Comments (too vague):**

```sql
COMMENT ON COLUMN users.email IS 'Email';  -- Says nothing useful
COMMENT ON COLUMN lei_records.lei IS 'LEI code';  -- What's an LEI?
```

✅ **GOOD Comments (descriptive):**

```sql
COMMENT ON COLUMN users.email IS 'User email address (RFC 5322 format). Must be unique. Used for login and notifications.';
COMMENT ON COLUMN lei_records.lei IS '20-character Legal Entity Identifier (ISO 17442). Format: 18 alphanumeric + 2-digit checksum. Globally unique.';
```

### Migration Checklist

When creating a migration that adds/modifies schema:

- [ ] Every new table has a COMMENT ON TABLE
- [ ] Every new column has a COMMENT ON COLUMN
- [ ] Comments explain PURPOSE, not just restating the column name
- [ ] Enumerations list all valid values
- [ ] Foreign keys mention the referenced table
- [ ] JSONB columns describe the expected structure
- [ ] Constraints are explained (why this length? why nullable?)

## Auto-Formatting

Always run SQLFluff before committing:

```bash
# Check files
sqlfluff lint backend/migrations/*.sql

# Auto-fix issues
sqlfluff fix backend/migrations/*.sql

# Fix without prompts
sqlfluff fix backend/migrations/*.sql --force
```

## SQLFluff Configuration

The project's `.sqlfluff` file enforces all these rules automatically:

- PostgreSQL dialect
- 4-space indentation
- 120-character line length
- Trailing comma style
- UPPERCASE keywords, functions, types, literals
- lowercase identifiers

## Pre-commit Hook (Recommended)

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
sqlfluff lint backend/migrations/*.sql
if [ $? -ne 0 ]; then
    echo "SQLFluff linting failed. Run: sqlfluff fix backend/migrations/*.sql"
    exit 1
fi
```

---

# Test-Driven Maintenance Instructions

## Core Principle

**Every functional code change MUST be accompanied by corresponding test updates or new test cases.**

**Feature work is not complete until tests exist for the new behavior.**

This is mandatory for:

- New features
- New endpoints
- New repository or service logic
- New UI behaviors
- Bug fixes that change observable behavior

If a change introduces behavior and no automated test is added,
the work should be treated as incomplete unless the user explicitly says to skip tests.

## Mandatory Test Update Rules

### When to Update Tests

**ALWAYS update or create tests when:**

1. **Adding New Functions/Methods**
   - Create new test function with table-driven test cases
   - Test both happy path and error conditions
   - Include edge cases and boundary conditions
   - Add benchmarks for performance-critical code

2. **Adding New Feature Behavior**
    - Add or update automated tests in the closest existing test suite for that module or feature
    - Cover the primary success path, failure path, and at least one edge case
    - Verify any new public/API-visible behavior, not just internal helpers
    - Do not rely on manual verification alone when automated coverage is feasible

3. **Modifying Existing Functions**
   - Update existing test cases to match new behavior
   - Add new test cases for new functionality
   - Verify all existing tests still pass
   - Update test descriptions/comments if behavior changed

4. **Changing Function Signatures**
   - Update all test calls to match new signature
   - Add tests for new parameters
   - Verify backward compatibility if applicable

5. **Modifying Return Values**
   - Update all test assertions to expect new return values
   - Test new error conditions
   - Update expected JSON output files in `testdata/` if applicable

6. **Changing Validation Logic**
   - Add test cases for new validation rules
   - Update existing validation tests
   - Test both valid and invalid inputs

7. **Modifying Configuration**
   - Update `internal/config/config_test.go`
   - Test new environment variables
   - Test new default values
   - Update validation test cases

8. **Changing Frontend Behavior**
    - Add or update Vitest coverage in the nearest existing `*.test.ts` or `*.test.tsx` file
    - Prefer testing user-visible behavior, transformation logic, and state transitions over implementation details
    - When UI logic is hard to test directly, extract a pure helper and test that helper with Vitest
    - For i18n, filtering, formatting, preferences, and null-handling changes,
      add focused regression tests for the changed path
    - If the area already has a test file, extend it instead of creating a disconnected new pattern

9. **Changing Backend Data Contracts Used by the Frontend**
     - Treat added, removed, or renamed API fields as a frontend-impacting change
     - Update frontend types/interfaces and verify both list and detail surfaces for affected domains
     - For LEI pages, review `frontend/app/lei-records/page.tsx` table columns and detail modal sections
     - Add or update focused frontend tests for formatting/normalization paths touched by new fields
     - Do not merge backend field changes that are not represented or intentionally hidden in the UI

## Test File Organization

### Test Data Files (`testdata/`)

When adding test data:

- Use descriptive filenames: `valid_[scenario].csv`, `invalid_[reason].csv`
- Create matching `*_expected.json` for valid cases
- Document in TESTING.md what the test data validates

### Test Naming Convention

```go
func Test[FunctionName][Scenario](t *testing.T) {
    // Test implementation
}
```

Examples:

- `TestParseValidBasicCSV`
- `TestParseInvalidHeaderOnly`
- `TestToJSONEmptyFields`

### Frontend Test Placement

For frontend code, prefer colocated Vitest files near the feature they cover:

- `frontend/app/lib/example.ts` -> `frontend/app/lib/example.test.ts`
- `frontend/app/components/Widget.tsx` -> `frontend/app/components/Widget.test.ts`
- `frontend/app/feature/helpers.ts` -> `frontend/app/feature/helpers.test.ts`

Use the nearest existing test pattern in the folder before introducing a new file shape.

### Frontend Test Expectations

The current frontend test harness uses Vitest.

When changing frontend behavior:

- Add a success-path test for the expected user-visible or helper outcome
- Add a failure, validation, or guard-path test when the logic can reject or normalize input
- Add at least one edge-case regression test for the changed behavior
- Prefer deterministic helper tests over brittle rendering tests when no DOM-specific harness is needed
- Avoid snapshot-only coverage for new logic

Good candidates for frontend automated tests in this repository include:

- normalization helpers
- formatting utilities
- docs link builders
- preference/state transformation helpers
- null-like value handling
- component logic that can be exercised without browser-only dependencies

## ADR-003 Contract Validation

**CRITICAL**: All tests must validate ADR-003 contracts:

1. **String Values Only** - No type coercion (test that `"30"` stays `"30"`, not `30`)
2. **Empty String Not Null** - Empty fields become `""`, never `null`
3. **Array Structure** - Single row produces array, not object
4. **Row Order Preservation** - Test that row order is maintained
5. **Strict Parsing** - Test that invalid files are rejected (not silently fixed)

## Test Execution Workflow

## Pull Request Expectation

When a PR adds or changes feature behavior, reviewers should be able to see test evidence in the diff.

Minimum expectation:

- Production code change and corresponding test change appear in the same PR
- Tests exercise the new or changed behavior directly
- Validation commands are included in the PR summary or agent response

**Before committing code:**

1. Run tests for the modified module:

   ```bash
   go test ./internal/[module] -v
   ```

2. Run all tests:

   ```bash
   go test ./... -v
   ```

3. Check coverage:

   ```bash
   go test -cover ./...
   ```

4. Verify no coverage regressions (aim for >70% per module)

### Frontend Validation Workflow

For frontend behavior changes, run the nearest relevant automated checks before commit:

1. Run frontend tests:

    ```bash
    cd frontend && npm test
    ```

2. Run frontend lint when the change touches application code:

    ```bash
    cd frontend && npm run lint
    ```

3. Run targeted verification scripts when relevant to the feature area:

    ```bash
    cd frontend && npm run i18n:verify
    ```

If a full frontend test run is too expensive for a narrow change,
run the most relevant test file or document why only a narrower validation was used.

## Examples

### Example 1: Adding New Parser Feature

**Code Change:**

```go
// Added support for custom delimiter
func ParseWithDelimiter(filepath string, delimiter rune) ([]map[string]string, error) {
    // implementation
}
```

**Required Test:**

```go
func TestParseWithCustomDelimiter(t *testing.T) {
    tests := []struct {
        name      string
        delimiter rune
        wantErr   bool
    }{
        {"comma", ',', false},
        {"tab", '\t', false},
        {"pipe", '|', false},
        {"invalid", '\n', true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := ParseWithDelimiter("testdata/valid_basic.csv", tt.delimiter)
            if (err != nil) != tt.wantErr {
                t.Errorf("ParseWithDelimiter() error = %v, wantErr %v", err, tt.wantErr)
            }
            // Additional assertions...
        })
    }
}
```

### Example 2: Modifying Validation Logic

**Code Change:**

```go
// Added port range validation
func ValidatePort(port int) error {
    if port < 1 || port > 65535 {
        return fmt.Errorf("port must be between 1 and 65535, got %d", port)
    }
    return nil
}
```

**Required Test Update:**

```go
func TestValidateQueuePortRange(t *testing.T) {
    tests := []struct {
        name    string
        port    int
        wantErr bool
    }{
        {"valid_min", 1, false},
        {"valid_mid", 5672, false},
        {"valid_max", 65535, false},
        {"invalid_zero", 0, true},
        {"invalid_negative", -1, true},
        {"invalid_high", 65536, true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := ValidatePort(tt.port)
            if (err != nil) != tt.wantErr {
                t.Errorf("ValidatePort(%d) error = %v, wantErr %v", tt.port, err, tt.wantErr)
            }
        })
    }
}
```

### Example 3: Updating Test Data

**Code Change:**

```go
// Changed behavior: now preserves leading/trailing spaces in fields
```

**Required Updates:**

1. Update `testdata/valid_quoted_expected.json` with spaces
2. Add new test case:

```go
func TestParsePreservesSpaces(t *testing.T) {
    // Test that " value " stays as " value " not "value"
}
```

## Test Coverage Goals

- **Config Module**: >80% (validates all configuration paths)
- **Parser Module**: >70% (covers all CSV parsing scenarios)
- **Converter Module**: >75% (covers all JSON conversion paths)
- **New Modules**: >60% minimum for first implementation

## Continuous Integration

Tests must pass before merging:

- All existing tests pass
- New tests added for new functionality
- Coverage maintained or improved
- No skipped tests without documented reason

## Common Mistakes to Avoid

❌ **DON'T:**

- Skip tests because "it's a small change"
- Only test happy path (always test error conditions)
- Use hardcoded values that might change (use testdata files)
- Commit code without running full test suite
- Ignore test failures in other modules

✅ **DO:**

- Write tests first (TDD) when possible
- Test error conditions thoroughly
- Use table-driven tests for multiple scenarios
- Update TESTING.md when adding new test categories
- Run tests locally before pushing

## Summary Checklist

Before every commit:

- [ ] New functions have new test cases
- [ ] Modified functions have updated test cases
- [ ] All tests pass: `go test ./... -v`
- [ ] Coverage maintained: `go test -cover ./...`
- [ ] Test data files updated if behavior changed
- [ ] TESTING.md updated if new test categories added
- [ ] ADR-003 contracts validated in tests

**Remember: Tests are documentation. They explain what the code does and prove it works correctly.**
