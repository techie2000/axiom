# Canonicalizer Data Transformation Rules for Countries

## Purpose

The canonicalizer is the **ONLY** layer responsible for data transformation and business rules enforcement. It standardizes data after csv2json format conversion and before database insertion.

## Layer Responsibilities

### csv2json (Format Conversion Only)

- ✅ Converts CSV rows to JSON messages
- ✅ Preserves data exactly as-is from CSV
- ❌ Does NOT transform or validate data
- ❌ Does NOT pad numeric codes
- ❌ Does NOT change case or format

**Example**: If CSV contains `"4"`, csv2json outputs `"4"` in JSON

### canonicalizer (Data Transformation & Validation)

- ✅ **ALL** business rules enforced here
- ✅ Pads numeric codes: `"4"` → `"004"`
- ✅ Normalizes case: `"us"` → `"US"`
- ✅ Validates required fields
- ✅ Applies defaults for missing values
- ✅ Cleans whitespace

**This is the single point of truth for data transformation**

### PostgreSQL (Final Safety Net)

- ✅ Enforces database constraints
- ✅ Rejects invalid data that bypasses canonicalizer
- ❌ Should rarely fail if canonicalizer works correctly

## Transformation Rules for reference.countries

### 1. Numeric Code Padding

**Rule**: Pad numeric country codes to exactly 3 digits with leading zeros

**Examples**:

- Input: `"4"` → Output: `"004"` (Afghanistan)
- Input: `"8"` → Output: `"008"` (Albania)
- Input: `"10"` → Output: `"010"` (Antarctica)
- Input: `"840"` → Output: `"840"` (United States - already correct)

**Implementation**:

```go
// Pad numeric code to 3 digits
numericCode := fmt.Sprintf("%03s", strings.TrimSpace(input.Numeric))
```

**Why**:

- ISO 3166-1 standard defines numeric codes as 3-digit strings
- Database constraint enforces this: `CHECK (numeric ~ '^[0-9]{3}$')`
- Ensures consistent lookups and sorting

### 2. Code Normalization

**Rule**: Convert all country codes to UPPERCASE

**Examples**:

- Input: `"us"` → Output: `"US"`
- Input: `"Gbr"` → Output: `"GBR"`

**Implementation**:

```go
country.Alpha2 = strings.ToUpper(strings.TrimSpace(input.Alpha2))
country.Alpha3 = strings.ToUpper(strings.TrimSpace(input.Alpha3))
```

**Why**: Database constraints enforce uppercase for consistency

### 3. Name Trimming

**Rule**: Remove leading/trailing whitespace from country names

**Implementation**:

```go
country.NameEnglish = strings.TrimSpace(input.NameEnglish)
country.NameFrench = strings.TrimSpace(input.NameFrench)
```

### 4. Status Validation

**Rule**: Validate status is one of the allowed values. If missing, default to `"officially_assigned"`. If invalid, **reject the record**.

**Valid Values**:

- `officially_assigned` (default if missing)
- `exceptionally_reserved`
- `transitionally_reserved`
- `indeterminately_reserved`
- `formerly_used`
- `unassigned`

**Implementation**:

```go
validStatuses := map[string]bool{
    "officially_assigned": true,
    "exceptionally_reserved": true,
    "transitionally_reserved": true,
    "indeterminately_reserved": true,
    "formerly_used": true,
    "unassigned": true,
}

status := strings.ToLower(strings.TrimSpace(input.Status))

// Status is required - cannot guess or default
if status == "" {
    return fmt.Errorf("status is required (cannot default missing data)")
}

// Transform format: replace spaces with underscores (alias support)
// "officially assigned" → "officially_assigned"
status = strings.ReplaceAll(status, " ", "_")

if !validStatuses[status] {
    // Invalid status - reject the record
    return fmt.Errorf("invalid status value: %s (must be one of: officially_assigned, exceptionally_reserved, transitionally_reserved, indeterminately_reserved, formerly_used, unassigned)", input.Status)
}

country.Status = status
```

**Why**:

- Missing required fields must be rejected → we don't guess data
- Invalid status indicates data quality issue → reject and alert
- Never silently correct invalid data

### 5. Date Handling

**Rule**: Parse dates in ISO 8601 format (YYYY-MM-DD), allow null/empty

**Implementation**:

```go
if input.StartDate != "" {
    startDate, err := time.Parse("2006-01-02", input.StartDate)
    if err == nil {
        country.StartDate = &startDate
    }
}
```

### 6. Validation

**Before inserting to database, validate**:

- ✅ Alpha2 is exactly 2 characters
- ✅ Alpha3 is exactly 3 characters
- ✅ Numeric is exactly 3 digits
- ✅ NameEnglish is not empty
- ✅ NameFrench is not empty
- ✅ EndDate >= StartDate (if both provided)

**Example Validation**:

```go
func validateCountry(c *Country) error {
    if len(c.Alpha2) != 2 {
        return fmt.Errorf("alpha2 must be 2 characters: %s", c.Alpha2)
    }
    if len(c.Alpha3) != 3 {
        return fmt.Errorf("alpha3 must be 3 characters: %s", c.Alpha3)
    }
    if !regexp.MustCompile(`^\d{3}$`).MatchString(c.Numeric) {
        return fmt.Errorf("numeric must be 3 digits: %s", c.Numeric)
    }
    if c.NameEnglish == "" {
        return fmt.Errorf("english name is required")
    }
    if c.NameFrench == "" {
        return fmt.Errorf (status, dates)
- **Invalid status values** (should reject)
- Invalid date formats (should reject)

## Error Handling
The canonicalizer must **reject** (not fix) data that indicates quality issues:
- ❌ Invalid status values → reject with error
- ❌ Invalid date formats → reject with error
- ❌ Missing required fields → reject with error
- ✅ Missing optional status → use default `"officially_assigned"`
- ✅ Numeric padding → transform `"4"` to `"004"`
- ✅ Case normalization → transform `"us"` to `"US"`

**Philosophy**: Transform format issues, reject data quality issues.("french name is required")
    }
    return nil
}
```

## Testing

Test files should include edge cases:

- Numeric codes with 1, 2, and 3 digits
- Lowercase codes
- Extra whitespace
- Missing optional fields

## Notes for Canonicalizer Implementation

- **Business rules live here and ONLY here**
- csv2json does not transform data - it only converts format
- These rules ensure data quality at the pipeline level
- Database constraints provide a safety net (should rarely trigger)
- Failed validations should be logged and sent to dead-letter queue
- Successful transformations should be logged for audit trail
- Any new transformation rules must be documented in this file
