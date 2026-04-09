---
applyTo: '**/*.go,**/*_test.go,frontend/**/*.ts,frontend/**/*.tsx,frontend/**/*.js,frontend/**/*.jsx'
description: 'Mandatory test maintenance requirements for backend and frontend behavior changes in Axiom project'
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
