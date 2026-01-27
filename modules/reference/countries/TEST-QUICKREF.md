# Countries Module - Test Quick Reference

## Run Tests

```powershell
# Unit tests (fast, no database)
go test ./internal/transform -v

# Coverage report
go test ./internal/transform -cover

# Integration tests (requires PostgreSQL)
docker-compose up -d postgres
go test ./internal/repository -v

# All tests with HTML coverage
.\scripts\run-tests.ps1 -TestType coverage
```

## Test Coverage

✅ **96.3%** transformation logic  
✅ **30+** test cases  
✅ **4** test suites  

## What's Tested

| Category | Tests | Status |
|----------|-------|--------|
| Numeric padding | 9 | ✅ PASS |
| Status validation | 10 | ✅ PASS |
| Required fields | 7 | ✅ PASS |
| Full transformation | 8 | ✅ PASS |
| Database constraints | 4 | ⏸️ Requires DB |

## Transformation Rules

```
Input → Transform → Output

"4"              → pad numeric   → "004"
"us"             → uppercase     → "US"
"  France  "     → trim          → "France"
"officially assigned" → replace spaces → "officially_assigned"
"OFFICIALLY_ASSIGNED" → lowercase → "officially_assigned"
""               → validate      → ERROR (reject)
```

## Field Mappings

```
CSV Column           → JSON Key      → DB Column
------------------------------------------------------
"Alpha-2 code"       → alpha2        → alpha2 (CHAR(2))
"Alpha-3 code"       → alpha3        → alpha3 (CHAR(3))
"Numeric"            → numeric       → numeric (CHAR(3))
"English short name" → name_english  → name_english
"French short name"  → name_french   → name_french
"status"             → status        → status (ENUM)
```

## Quick Validation

```powershell
# Test a specific rule
go test ./internal/transform -v -run TestTransformNumericCode

# Test status validation
go test ./internal/transform -v -run TestValidateStatus

# Test all transformations
go test ./internal/transform -v -run TestTransformToCountry
```

## Expected Behavior

### ✅ Accept & Transform

- `"4"` → `"004"`
- `"af"` → `"AF"`
- `"officially assigned"` → `"officially_assigned"`
- `"OFFICIALLY_ASSIGNED"` → `"officially_assigned"`

### ❌ Reject

- Empty status (no default)
- Invalid status values
- Non-numeric codes
- Missing required fields

## Files

- `internal/transform/transform.go` - Rules
- `internal/transform/transform_test.go` - Tests
- `scripts/run-tests.ps1` - Runner
- `TEST-README.md` - Full guide
- `TEST-SUMMARY.md` - Results

## Next Steps

1. ✅ Tests pass locally
2. → Implement in canonicalizer
3. → Test full pipeline
4. → Add to CI/CD
