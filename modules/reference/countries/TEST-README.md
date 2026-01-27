# Countries Module Tests

Comprehensive test suite ensuring transformation rules and field mappings work correctly.

## Quick Start

```powershell
# Run all unit tests (no database needed)
.\scripts\run-tests.ps1 -TestType unit -Verbose

# Run integration tests (requires PostgreSQL)
docker-compose up -d postgres
.\scripts\run-tests.ps1 -TestType integration -Verbose

# Run everything with coverage
.\scripts\run-tests.ps1 -TestType coverage
```

## What's Tested

### ✅ Transformation Rules

- Numeric padding: `"4"` → `"004"`
- Case normalization: `"us"` → `"US"`
- Whitespace trimming
- Status validation (reject invalid/missing)
- Required field validation

### ✅ Field Mappings

All CSV → JSON → Database mappings are validated:

- `"Alpha-2 code"` → `alpha2` → `CHAR(2) UPPERCASE`
- `"Alpha-3 code"` → `alpha3` → `CHAR(3) UPPERCASE`
- `"Numeric"` → `numeric` → `CHAR(3)` (3 digits)
- `"English short name"` → `name_english` → `VARCHAR(255)`
- `"status"` → `status` → `country_code_status ENUM`

### ✅ Database Constraints

PostgreSQL constraints act as safety net:

- Numeric format: must match `^[0-9]{3}$`
- Uppercase codes: alpha2/alpha3 must be UPPERCASE
- Valid date ranges: start_date ≤ end_date
- Status enum: only valid ISO 3166-1 status values

## Test Files

```
internal/
├── transform/
│   ├── transform.go          # Canonicalizer rules
│   └── transform_test.go     # 15+ test cases
└── repository/
    ├── country_repository.go
    └── country_repository_test.go  # Integration tests
```

## Test Examples

### Numeric Padding Test

```go
// Input: "4" (from CSV)
// Expected: "004" (canonical form)
TestTransformNumericCode("4") → "004" ✓

// Input: "840" (already 3 digits)
// Expected: "840" (no change)
TestTransformNumericCode("840") → "840" ✓
```

### Status Validation Test

```go
// Valid status
TestValidateStatus("officially_assigned") → PASS ✓

// Missing status - MUST REJECT
TestValidateStatus("") → ERROR ✓

// Invalid status
TestValidateStatus("invalid_status") → ERROR ✓
```

### Field Mapping Test

```go
// Raw CSV data
input := RawCountryData{
    Alpha2Code: "af",        // lowercase
    Alpha3Code: "afg",       // lowercase  
    Numeric: "4",            // not padded
    Status: "officially_assigned"
}

// Expected canonical form
want := Country{
    Alpha2: "AF",            // uppercase
    Alpha3: "AFG",           // uppercase
    Numeric: "004",          // padded
    Status: "officially_assigned"
}

TransformToCountry(input) → matches want ✓
```

## Running Tests

### Unit Tests Only (Fast)

```powershell
cd modules/reference/countries
go test ./internal/transform -v
```

**Output:**

```
=== RUN   TestTransformNumericCode
=== RUN   TestTransformNumericCode/single_digit_-_pad_to_3
=== RUN   TestTransformNumericCode/two_digits_-_pad_to_3
=== RUN   TestTransformNumericCode/three_digits_-_no_change
...
--- PASS: TestTransformNumericCode (0.00s)
PASS
ok      github.com/your-org/axiom/modules/reference/countries/internal/transform
```

### Integration Tests (Requires PostgreSQL)

```powershell
# Start PostgreSQL
docker-compose up -d postgres

# Run integration tests
go test ./internal/repository -v
```

### All Tests with Coverage

```powershell
.\scripts\run-tests.ps1 -TestType coverage
# Opens coverage.html in browser
```

## Test Matrix

| Test Case | Input | Expected Output | Test Type |
|-----------|-------|-----------------|-----------|
| Numeric padding (1 digit) | `"4"` | `"004"` | Unit |
| Numeric padding (2 digits) | `"36"` | `"036"` | Unit |
| Numeric padding (3 digits) | `"840"` | `"840"` | Unit |
| Code uppercase | `"us"` | `"US"` | Unit |
| Code mixed case | `"Gbr"` | `"GBR"` | Unit |
| Whitespace trim | `"  FR  "` | `"FR"` | Unit |
| Valid status | `"officially_assigned"` | PASS | Unit |
| Missing status | `""` | REJECT | Unit |
| Invalid status | `"invalid"` | REJECT | Unit |
| Database constraint (numeric) | `"1"` | REJECT | Integration |
| Database constraint (lowercase) | `"us"` | REJECT | Integration |
| CRUD operations | Create/Read | SUCCESS | Integration |
| Upsert (insert) | New record | SUCCESS | Integration |
| Upsert (update) | Existing record | SUCCESS | Integration |

## CI/CD Integration

```yaml
# .github/workflows/test-countries.yml
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
        ports:
          - 5432:5432
        options: --health-cmd pg_isready --health-interval 10s
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      
      - name: Run tests with coverage
        working-directory: modules/reference/countries
        run: |
          go test ./... -v -coverprofile=coverage.out
          go tool cover -func=coverage.out
```

## Troubleshooting

### "Cannot connect to PostgreSQL"

```powershell
# Check if PostgreSQL is running
docker ps | Select-String "postgres"

# Start PostgreSQL
docker-compose up -d postgres

# Wait for it to be ready
Start-Sleep 5
```

### "Test failed: constraint violation"

This is expected! Tests verify that database constraints work:

- `"1"` should fail (not padded to 3 digits)
- `"us"` should fail (not uppercase)
- `"abc"` should fail (not numeric)

### Run only specific test

```powershell
go test ./internal/transform -v -run TestTransformNumericCode
go test ./internal/repository -v -run TestDatabaseConstraints
```

## Coverage Goals

- **transform package**: 100% (all transformation rules)
- **repository package**: 85%+ (CRUD + constraints)
- **Overall module**: 90%+

## Next Steps

After tests pass:

1. ✅ Transformation rules validated
2. ✅ Field mappings verified
3. ✅ Database constraints tested
4. → Implement in canonicalizer service
5. → Test full pipeline (CSV → RabbitMQ → PostgreSQL)

## Documentation

- [TESTING-RULES.md](./docs/TESTING-RULES.md) - Detailed test documentation
- [canonicalizer-rules.md](./docs/canonicalizer-rules.md) - Business rules specification
- [pipeline-architecture.md](../../../docs/pipeline-architecture.md) - Architecture overview
