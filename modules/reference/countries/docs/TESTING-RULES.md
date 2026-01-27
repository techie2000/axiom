# Testing Guide for Countries Module

## Overview

This module has comprehensive test coverage for transformation rules, field mappings, and database constraints.

## Test Structure

```
internal/
├── transform/
│   ├── transform.go       # Transformation rules (canonicalizer logic)
│   └── transform_test.go  # Unit tests for all transformation rules
└── repository/
    ├── country_repository.go
    └── country_repository_test.go  # Integration tests with PostgreSQL
```

## Test Categories

### 1. Transformation Tests (`transform_test.go`)

Tests all canonicalizer business rules in isolation:

#### Numeric Code Padding

- ✅ Single digit: `"4"` → `"004"`
- ✅ Two digits: `"36"` → `"036"`
- ✅ Three digits: `"840"` → `"840"` (no change)
- ✅ With whitespace: `"  4  "` → `"004"`
- ❌ Reject empty strings
- ❌ Reject non-numeric values
- ❌ Reject codes longer than 3 digits

#### Status Validation

- ✅ Valid statuses: `officially_assigned`, `exceptionally_reserved`, etc.
- ✅ Alias support: `"officially assigned"` → `"officially_assigned"` (space to underscore)
- ✅ Case normalization: `"OFFICIALLY_ASSIGNED"` → `"officially_assigned"`
- ✅ Whitespace trimming
- ❌ Reject empty/missing status (cannot default)
- ❌ Reject invalid status values

#### Code Normalization

- ✅ Lowercase to uppercase: `"us"` → `"US"`
- ✅ Mixed case: `"Gbr"` → `"GBR"`
- ✅ Whitespace trimming

#### Required Field Validation

- ❌ Reject if missing: alpha2, alpha3, numeric, name_english, name_french, status
- ✅ All required fields present

#### Complete Transformation Pipeline

- ✅ Full transformation: raw CSV data → canonical Country model
- ✅ Date parsing (ISO 8601 format)
- ✅ Formerly used countries with end dates

### 2. Repository Tests (`country_repository_test.go`)

Integration tests with real PostgreSQL database:

#### CRUD Operations

- ✅ Create new country
- ✅ Upsert (insert + update)
- ✅ Get by Alpha2 code
- ✅ List active countries only
- ✅ List all countries

#### Database Constraints

Tests that PostgreSQL enforces data integrity:

- ❌ Reject non-padded numeric codes (e.g., `"1"` instead of `"001"`)
- ❌ Reject non-numeric codes (e.g., `"abc"`)
- ❌ Reject lowercase country codes (e.g., `"us"` instead of `"US"`)
- ✅ Accept properly formatted data

## Running Tests

### Quick Unit Tests (No Database Required)

```powershell
# Run transformation tests only
cd modules/reference/countries
go test ./internal/transform -v

# Run with coverage
go test ./internal/transform -v -cover
```

### Integration Tests (Requires PostgreSQL)

```powershell
# Start PostgreSQL via Docker
docker-compose up -d postgres

# Run all tests (including integration tests)
go test ./... -v

# Run only integration tests
go test ./internal/repository -v

# Skip integration tests (short mode)
go test ./... -short
```

### Generate Coverage Report

```powershell
# Generate coverage profile
go test ./... -coverprofile=coverage.out

# View coverage in browser
go tool cover -html=coverage.out
```

## Test Data

### Example Raw CSV Data (Before Transformation)

```json
{
  "English short name": "Afghanistan",
  "French short name": "Afghanistan (l')",
  "Alpha-2 code": "af",
  "Alpha-3 code": "afg",
  "Numeric": "4",
  "status": "officially_assigned"
}
```

### Expected Transformed Data (After Canonicalizer)

```json
{
  "alpha2": "AF",
  "alpha3": "AFG",
  "numeric": "004",
  "name_english": "Afghanistan",
  "name_french": "Afghanistan (l')",
  "status": "officially_assigned"
}
```

## Field Mapping Tests

All field mappings from CSV → JSON → Database are validated:

| CSV Field           | JSON Field      | Database Field | Transform Rule             |
|---------------------|-----------------|----------------|----------------------------|
| Alpha-2 code        | alpha2          | alpha2         | Uppercase, trim            |
| Alpha-3 code        | alpha3          | alpha3         | Uppercase, trim            |
| Numeric             | numeric         | numeric        | Pad to 3 digits, trim      |
| English short name  | name_english    | name_english   | Trim                       |
| French short name   | name_french     | name_french    | Trim                       |
| status              | status          | status         | Lowercase, validate, trim  |
| start_date          | start_date      | start_date     | Parse ISO 8601             |
| end_date            | end_date        | end_date       | Parse ISO 8601             |

## Validation Rules Tested

### ✅ Format Transformations (Applied by Canonicalizer)

1. Pad numeric codes to 3 digits with leading zeros
2. Convert country codes to uppercase
3. Trim whitespace from all text fields
4. Normalize status to lowercase with underscores

### ❌ Data Quality Rejections (Invalid Data)

1. Missing required fields → reject
2. Invalid status values → reject
3. Non-numeric numeric codes → reject
4. Numeric codes > 3 digits → reject
5. Invalid date formats → reject

### 🛡️ Database Safety Net

PostgreSQL constraints catch any data that bypasses canonicalizer:

- `CHECK (numeric ~ '^[0-9]{3}$')` - Numeric must be 3 digits
- `CHECK (alpha2 = UPPER(alpha2))` - Alpha2 must be uppercase
- `CHECK (alpha3 = UPPER(alpha3))` - Alpha3 must be uppercase
- `CHECK (start_date <= end_date)` - Valid date ranges

## CI/CD Integration

```yaml
# Example GitHub Actions workflow
name: Test Countries Module

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: axiom_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      
      - name: Run tests
        working-directory: modules/reference/countries
        run: go test ./... -v -cover
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/axiom_test?sslmode=disable
```

## Best Practices

### Writing New Tests

1. **Unit tests first**: Test transformation logic in isolation
2. **Integration tests**: Verify database interactions
3. **Table-driven tests**: Use test tables for multiple scenarios
4. **Clear test names**: Describe what's being tested
5. **Validate errors**: Test both success and failure paths

### Test Coverage Goals

- **Transformation logic**: 100% coverage (all rules tested)
- **Repository operations**: 80%+ coverage (CRUD + constraints)
- **Overall module**: 85%+ coverage

### Running Tests Locally

```powershell
# Quick feedback loop during development
go test ./internal/transform -v -run TestTransformNumericCode

# Full test suite before commit
go test ./... -v -cover

# Check for race conditions
go test ./... -race
```

## Troubleshooting

### "Failed to connect to test database"

- Ensure PostgreSQL is running: `docker-compose up -d postgres`
- Check connection string in test setup
- Run with `-short` to skip integration tests

### "Constraint violation" errors

- These are expected! Tests verify constraints work
- Check test name - if it says "invalid", error is expected

### Coverage too low

- Add test cases for error paths
- Test edge cases (empty strings, whitespace, invalid data)
- Test boundary conditions (3-digit codes, date ranges)

## Next Steps

After all tests pass:

1. Run full pipeline test with Docker Compose
2. Test with real CSV data from `data/countries.csv`
3. Verify RabbitMQ message consumption
4. Check database records via psql or HTTP API

## Related Documentation

- [Canonicalizer Rules](./canonicalizer-rules.md) - Business rule specifications
- [Pipeline Architecture](../../../docs/pipeline-architecture.md) - Layer responsibilities
- [TESTING.md](./TESTING.md) - Integration testing guide
