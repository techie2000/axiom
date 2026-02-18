---
description: 'Generic code review instructions that can be customized for any project using GitHub Copilot'
applyTo: '**'
excludeAgent: ["coding-agent"]
---

# Generic Code Review Instructions

Comprehensive code review guidelines for GitHub Copilot that can be adapted to any project. These instructions follow
best practices from prompt engineering and provide a structured approach to code quality, security, testing, and
architecture review.

## Review Language

When performing a code review, respond in **English**

## Review Priorities

When performing a code review, prioritize issues in the following order:

### 🔴 CRITICAL (Block merge)
- **Security**: Vulnerabilities, exposed secrets, authentication/authorization issues
- **Correctness**: Logic errors, data corruption risks, race conditions
- **Breaking Changes**: API contract changes without versioning
- **Data Loss**: Risk of data loss or corruption

### 🟡 IMPORTANT (Requires discussion)
- **Code Quality**: Severe violations of SOLID principles, excessive duplication
- **Test Coverage**: Missing tests for critical paths or new functionality
- **Performance**: Obvious performance bottlenecks (N+1 queries, memory leaks)
- **Architecture**: Significant deviations from established patterns

### 🟢 SUGGESTION (Non-blocking improvements)
- **Readability**: Poor naming, complex logic that could be simplified
- **Optimization**: Performance improvements without functional impact
- **Best Practices**: Minor deviations from conventions
- **Documentation**: Missing or incomplete comments/documentation

## General Review Principles

When performing a code review, follow these principles:

1. **Be specific**: Reference exact lines, files, and provide concrete examples
2. **Provide context**: Explain WHY something is an issue and the potential impact
3. **Suggest solutions**: Show corrected code when applicable, not just what's wrong
4. **Be constructive**: Focus on improving the code, not criticizing the author
5. **Recognize good practices**: Acknowledge well-written code and smart solutions
6. **Be pragmatic**: Not every suggestion needs immediate implementation
7. **Group related comments**: Avoid multiple comments about the same topic

## Code Quality Standards

When performing a code review, check for:

### Clean Code
- Descriptive and meaningful names for variables, functions, and classes
- Single Responsibility Principle: each function/class does one thing well
- DRY (Don't Repeat Yourself): no code duplication
- Functions should be small and focused (ideally < 20-30 lines)
- Avoid deeply nested code (max 3-4 levels)
- Avoid magic numbers and strings (use constants)
- Code should be self-documenting; comments only when necessary

#### Clean Code Examples

```javascript
// ❌ BAD: Poor naming and magic numbers
function calc(x, y) {
    if (x > 100) return y * 0.15;
    return y * 0.10;
}

// ✅ GOOD: Clear naming and constants
const PREMIUM_THRESHOLD = 100;
const PREMIUM_DISCOUNT_RATE = 0.15;
const STANDARD_DISCOUNT_RATE = 0.10;

function calculateDiscount(orderTotal, itemPrice) {
    const isPremiumOrder = orderTotal > PREMIUM_THRESHOLD;
    const discountRate = isPremiumOrder ? PREMIUM_DISCOUNT_RATE : STANDARD_DISCOUNT_RATE;
    return itemPrice * discountRate;
}
```

### Error Handling
- Proper error handling at appropriate levels
- Meaningful error messages
- No silent failures or ignored exceptions
- Fail fast: validate inputs early
- Use appropriate error types/exceptions

#### Error Handling Examples

```python
# ❌ BAD: Silent failure and generic error
def process_user(user_id):
    try:
        user = db.get(user_id)
        user.process()
    except:
        pass

# ✅ GOOD: Explicit error handling
def process_user(user_id):
    if not user_id or user_id <= 0:
        raise ValueError(f"Invalid user_id: {user_id}")

    try:
        user = db.get(user_id)
    except UserNotFoundError:
        raise UserNotFoundError(f"User {user_id} not found in database")
    except DatabaseError as e:
        raise ProcessingError(f"Failed to retrieve user {user_id}: {e}")

    return user.process()
```

## Security Review

When performing a code review, check for security issues:

- **Sensitive Data**: No passwords, API keys, tokens, or PII in code or logs
- **Input Validation**: All user inputs are validated and sanitized
- **SQL Injection**: Use parameterized queries, never string concatenation
- **Authentication**: Proper authentication checks before accessing resources
- **Authorization**: Verify user has permission to perform action
- **Cryptography**: Use established libraries, never roll your own crypto
- **Dependency Security**: Check for known vulnerabilities in dependencies

### Examples
```java
// ❌ BAD: SQL injection vulnerability
String query = "SELECT * FROM users WHERE email = '" + email + "'";

// ✅ GOOD: Parameterized query
PreparedStatement stmt = conn.prepareStatement(
    "SELECT * FROM users WHERE email = ?"
);
stmt.setString(1, email);
```

```javascript
// ❌ BAD: Exposed secret in code
const API_KEY = "sk_live_abc123xyz789";

// ✅ GOOD: Use environment variables
const API_KEY = process.env.API_KEY;
```

## Testing Standards

When performing a code review, verify test quality:

- **Coverage**: Critical paths and new functionality must have tests
- **Test Names**: Descriptive names that explain what is being tested
- **Test Structure**: Clear Arrange-Act-Assert or Given-When-Then pattern
- **Independence**: Tests should not depend on each other or external state
- **Assertions**: Use specific assertions, avoid generic assertTrue/assertFalse
- **Edge Cases**: Test boundary conditions, null values, empty collections
- **Mock Appropriately**: Mock external dependencies, not domain logic

### Examples
```typescript
// ❌ BAD: Vague name and assertion
test('test1', () => {
    const result = calc(5, 10);
    expect(result).toBeTruthy();
});

// ✅ GOOD: Descriptive name and specific assertion
test('should calculate 10% discount for orders under $100', () => {
    const orderTotal = 50;
    const itemPrice = 20;

    const discount = calculateDiscount(orderTotal, itemPrice);

    expect(discount).toBe(2.00);
});
```

## Performance Considerations

When performing a code review, check for performance issues:

- **Database Queries**: Avoid N+1 queries, use proper indexing
- **Algorithms**: Appropriate time/space complexity for the use case
- **Caching**: Utilize caching for expensive or repeated operations
- **Resource Management**: Proper cleanup of connections, files, streams
- **Pagination**: Large result sets should be paginated
- **Lazy Loading**: Load data only when needed

### Examples
```python
# ❌ BAD: N+1 query problem
users = User.query.all()
for user in users:
    orders = Order.query.filter_by(user_id=user.id).all()  # N+1!

# ✅ GOOD: Use JOIN or eager loading
users = User.query.options(joinedload(User.orders)).all()
for user in users:
    orders = user.orders
```

## Architecture and Design

When performing a code review, verify architectural principles:

- **Separation of Concerns**: Clear boundaries between layers/modules
- **Dependency Direction**: High-level modules don't depend on low-level details
- **Interface Segregation**: Prefer small, focused interfaces
- **Loose Coupling**: Components should be independently testable
- **High Cohesion**: Related functionality grouped together
- **Consistent Patterns**: Follow established patterns in the codebase

## Documentation Standards

When performing a code review, check documentation:

- **API Documentation**: Public APIs must be documented (purpose, parameters, returns)
- **Complex Logic**: Non-obvious logic should have explanatory comments
- **README Updates**: Update README when adding features or changing setup
- **Breaking Changes**: Document any breaking changes clearly
- **Examples**: Provide usage examples for complex features

## Comment Format Template

When performing a code review, use this format for comments:

```markdown
**[PRIORITY] Category: Brief title**

Detailed description of the issue or suggestion.

**Why this matters:**
Explanation of the impact or reason for the suggestion.

**Suggested fix:**
[code example if applicable]

**Reference:** [link to relevant documentation or standard]
```

### Example Comments

#### Critical Issue
```markdown
**🔴 CRITICAL - Security: SQL Injection Vulnerability**

The query on line 45 concatenates user input directly into the SQL string,
creating a SQL injection vulnerability.

**Why this matters:**
An attacker could manipulate the email parameter to execute arbitrary SQL commands,
potentially exposing or deleting all database data.

**Suggested fix:**
```sql
-- Instead of:
query = "SELECT * FROM users WHERE email = '" + email + "'"

-- Use:
PreparedStatement stmt = conn.prepareStatement(
    "SELECT * FROM users WHERE email = ?"
);
stmt.setString(1, email);
```

**Reference:**  
[OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)

#### Important Issue
```markdown
**🟡 IMPORTANT - Testing: Missing test coverage for critical path**

The `processPayment()` function handles financial transactions but has no tests
for the refund scenario.

**Why this matters:**
Refunds involve money movement and should be thoroughly tested to prevent
financial errors or data inconsistencies.

**Suggested fix:**
Add test case:
```javascript
test('should process full refund when order is cancelled', () => {
    const order = createOrder({ total: 100, status: 'cancelled' });

    const result = processPayment(order, { type: 'refund' });

    expect(result.refundAmount).toBe(100);
    expect(result.status).toBe('refunded');
});
```

**Reference:**  
[OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/XSS_Prevention_Cheat_Sheet.html)

#### Suggestion
```markdown
**🟢 SUGGESTION - Readability: Simplify nested conditionals**

The nested if statements on lines 30-40 make the logic hard to follow.

**Why this matters:**
Simpler code is easier to maintain, debug, and test.

**Suggested fix:**
```javascript
// Instead of nested ifs:
if (user) {
    if (user.isActive) {
        if (user.hasPermission('write')) {
            // do something
        }
    }
}

// Consider guard clauses:
if (!user || !user.isActive || !user.hasPermission('write')) {
    return;
}
// do something
```

**Reference:**  
[OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/CSRF_Prevention_Cheat_Sheet.html)

## Review Checklist

When performing a code review, systematically verify:

### Code Quality
- [ ] Code follows consistent style and conventions
- [ ] Names are descriptive and follow naming conventions
- [ ] Functions/methods are small and focused
- [ ] No code duplication
- [ ] Complex logic is broken into simpler parts
- [ ] Error handling is appropriate
- [ ] No commented-out code or TODO without tickets

### Security
- [ ] No sensitive data in code or logs
- [ ] Input validation on all user inputs
- [ ] No SQL injection vulnerabilities
- [ ] Authentication and authorization properly implemented
- [ ] Dependencies are up-to-date and secure

### Testing
- [ ] New code has appropriate test coverage
- [ ] Tests are well-named and focused
- [ ] Tests cover edge cases and error scenarios
- [ ] Tests are independent and deterministic
- [ ] No tests that always pass or are commented out

### Performance
- [ ] No obvious performance issues (N+1, memory leaks)
- [ ] Appropriate use of caching
- [ ] Efficient algorithms and data structures
- [ ] Proper resource cleanup

### Architecture
- [ ] Follows established patterns and conventions
- [ ] Proper separation of concerns
- [ ] No architectural violations
- [ ] Dependencies flow in correct direction

### Documentation
- [ ] Public APIs are documented
- [ ] Complex logic has explanatory comments
- [ ] README is updated if needed
- [ ] Breaking changes are documented

## Project-Specific Customizations

### 1. Language/Framework Specific Checks

#### Go Backend (Gin, GORM, Fiber, Beego)
When performing a code review of Go code:
- **Package Declarations**: Verify NO duplicate `package` declarations in files - each file must have exactly ONE
  package declaration at the top
- **Package Naming**: Verify package names match directory names (e.g., files in `handler/` must have
  `package handler`)
- **Import Organization**: Check imports are grouped: standard library, external packages, internal packages
  (separated by blank lines)
- **Error Handling**: Verify all errors are checked and handled appropriately (no ignored errors)
- **Context Usage**: Verify `context.Context` is the first parameter in functions that need it
- **GORM Queries**: Check for proper `WHERE` clauses, pagination, and index usage to prevent N+1 queries
- **Middleware Order**: Verify middleware is applied in correct order: Auth → CORS → Rate Limit → Logging → Handler
- **Idiomatic Go**: Verify early returns to reduce nesting, keep happy path left-aligned
- **Receiver Naming**: Verify receiver names are short (1-2 chars), consistent within a type
- **Acronym Casing**: Verify acronyms are all uppercase (e.g., `HTTPServer`, `URLParser`, `IDToken`)

#### Next.js Frontend (React 19, TypeScript)
When performing a code review of frontend code:
- **React Hooks**: Verify hooks follow Rules of Hooks (only at top level, only in React functions)
- **Component Structure**: Check components use Next.js 15 App Router patterns (app directory structure)
- **TypeScript**: Verify proper type annotations, no `any` types without justification
- **Tailwind CSS**: Check utility classes are used correctly, avoid inline styles
- **shadcn/ui Components**: Verify components follow shadcn/ui patterns for consistency
- **API Routes**: Verify Next.js API routes use proper HTTP methods and status codes

#### Docker Containerization
When performing a code review involving Docker:
- **Multi-stage Builds**: Verify Dockerfiles use multi-stage builds for smaller images
- **Layer Caching**: Check COPY commands are ordered for optimal layer caching
- **Security**: Verify no secrets in Dockerfiles or images, use build args or runtime secrets
- **Base Images**: Check base images are specific versions (not `latest`) for reproducibility
- **Health Checks**: Verify containers have appropriate HEALTHCHECK instructions

### 2. Build and Deployment

When performing a code review involving build/deployment:
- **Database Migrations**: Verify all `.up.sql` migrations have corresponding `.down.sql` for reversibility
- **Migration Naming**: Check migrations follow pattern `XXXXXX_description.up.sql` /
  `XXXXXX_description.down.sql`
- **Multi-Environment Config**: Verify changes work across all environments (dev, uat, prod) using appropriate
  docker-compose files
- **Environment Variables**: Check all required env vars are documented and have sensible defaults where appropriate
- **Port Assignments**: Verify ports follow the project's environment port reference (docs/environments/environment-port-reference.md)
- **Service Dependencies**: Check docker-compose `depends_on` correctly reflects service startup order
- **Volume Mounts**: Verify volume mounts are correct for dev vs prod environments
- **Health Checks**: Confirm services have proper health checks for orchestration

### 3. Business Logic Rules

When performing a code review involving business logic:
- **CQRS Pattern**: Verify commands (writes) and queries (reads) are properly separated
- **LEI Data Validation**: Check LEI codes match format: 20 alphanumeric characters
- **ADR-003 Contract** (CSV/JSON Conversion):
  - All values remain strings (no type coercion: `"30"` stays `"30"`)
  - Empty fields become `""`, NEVER `null`
  - Single rows produce arrays, not objects
  - Row order is preserved
  - Invalid files are rejected, not silently fixed
- **Financial Data Integrity**: Verify proper validation of:
  - ISO country codes (2-letter)
  - ISO currency codes (3-letter)
  - Account numbers and SSI details
  - Entity identifiers
- **Audit Logging**: Check all data mutations are logged with user, timestamp, and change details
- **Event Publishing**: Verify async operations publish events to RabbitMQ for proper tracking
- **Transaction Boundaries**: Check database transactions are properly scoped (not too large, not missing)

### 4. Team Conventions

When performing a code review:
- **Test-Driven Maintenance**: Verify EVERY code change includes corresponding test updates or new tests
  - New functions must have test functions
  - Modified functions must update existing tests
  - Changed signatures must update all test calls
  - Validation changes must add test cases
- **Test Coverage**: Check that module test coverage remains >70% (use `go test -cover ./...`)
- **Test Naming**: Verify tests follow pattern: `Test[FunctionName][Scenario]`
- **Documentation Updates**: Check README.md and relevant docs are updated for user-facing changes
  - API changes → update API documentation
  - Configuration changes → update config documentation
  - Feature additions → update feature documentation
- **Version Management**: For releases, verify:
  - VERSION file is updated
  - version.go is updated
  - CHANGELOG.md includes release notes
- **Commit Convention**: Verify commits follow conventional commits format:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation
  - `refactor:` for code refactoring
  - `test:` for test changes
  - `chore:` for maintenance tasks
- **Branch Naming**: Check branches follow pattern: `type/description` (e.g., `feat/lei-integration`, `fix/auth-bug`)
- **Import Paths**: Verify internal imports use `github.com/techie2000/axiom/backend/...` module path
- **Logging**: Check structured logging with proper levels (debug, info, warn, error) using zerolog
- **API Documentation**: Verify Swagger annotations are updated for API changes

## Additional Resources

For more information on effective code reviews and GitHub Copilot customization:

- [GitHub Copilot Prompt Engineering](https://docs.github.com/en/copilot/concepts/prompting/prompt-engineering)
- [GitHub Copilot Custom Instructions](https://code.visualstudio.com/docs/copilot/customization/custom-instructions)
- [Awesome GitHub Copilot Repository](https://github.com/github/awesome-copilot)
- [GitHub Code Review Guidelines](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests)
- [Google Engineering Practices - Code Review](https://google.github.io/eng-practices/review/)
- [OWASP Security Guidelines](https://owasp.org/)

## Prompt Engineering Tips

When performing a code review, apply these prompt engineering principles from the [GitHub Copilot documentation](https://docs.github.com/en/copilot/concepts/prompting/prompt-engineering):

1. **Start General, Then Get Specific**: Begin with high-level architecture review, then drill into implementation details
2. **Give Examples**: Reference similar patterns in the codebase when suggesting changes
3. **Break Complex Tasks**: Review large PRs in logical chunks (security → tests → logic → style)
4. **Avoid Ambiguity**: Be specific about which file, line, and issue you're addressing
5. **Indicate Relevant Code**: Reference related code that might be affected by changes
6. **Experiment and Iterate**: If initial review misses something, review again with focused questions

## Project Context

### Axiom - Financial Services Static Data System

- **Tech Stack**: 
  - Backend: Go 1.24, Gin/Fiber/Beego, GORM, PostgreSQL, RabbitMQ
  - Frontend: Next.js 15, React 19, TypeScript 5.3, Tailwind CSS 3.4, shadcn/ui
  - Infrastructure: Docker, Docker Compose, nginx (planned)
- **Architecture**: Modular Monolith with clear layer separation, CQRS pattern for reads/writes
- **Build Tool**: Go modules (`go.mod`), npm for frontend, Make for automation
- **Testing**: Go testing package with table-driven tests, >70% coverage target
- **Code Style**: Follows Effective Go and Go Code Review Comments (see go.instructions.md)
- **Module Path**: `github.com/techie2000/axiom/backend`
