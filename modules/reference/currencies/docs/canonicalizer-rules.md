# Canonicalizer Data Transformation Rules for Currencies

## Purpose

The canonicalizer is the **ONLY** layer responsible for data transformation and business rules enforcement. It standardizes data after csv2json format conversion and before database insertion.

## Layer Responsibilities

### csv2json (Format Conversion Only)

- ✅ Converts CSV rows to JSON messages
- ✅ Preserves data exactly as-is from CSV
- ❌ Does NOT transform or validate data
- ❌ Does NOT pad numeric codes
- ❌ Does NOT change case or format

**Example**: If CSV contains `"8"`, csv2json outputs `"8"` in JSON

### canonicalizer (Data Transformation & Validation)

- ✅ **ALL** business rules enforced here
- ✅ Pads numeric codes: `"8"` → `"008"`
- ✅ Normalizes case: `"usd"` → `"USD"`
- ✅ Validates required fields
- ✅ Applies defaults for missing values
- ✅ Cleans whitespace
- ✅ Handles flexible date formats

**This is the single point of truth for data transformation**

### PostgreSQL (Final Safety Net)

- ✅ Enforces database constraints
- ✅ Rejects invalid data that bypasses canonicalizer
- ✅ CHECK constraints enforce business rules:
  - `chk_code_format`: Currency code must be 3 uppercase letters
  - `chk_number_format`: Numeric code must be 3 digits if present
  - `chk_status_values`: Status must be 'active', 'historical', or 'special'
  - `chk_active_has_minor_units`: Active currencies MUST have minor_units defined
  - `chk_active_no_end_date`: Active currencies cannot have end_date
- ❌ Should rarely fail if canonicalizer works correctly

## Transformation Rules for reference.currencies

### 1. Currency Code Normalization

**Rule**: Convert all currency codes to UPPERCASE

**Examples**:

- Input: `"usd"` → Output: `"USD"`
- Input: `"Eur"` → Output: `"EUR"`
- Input: `"xau"` → Output: `"XAU"`

**Implementation**:

```go
currency.Code = strings.ToUpper(strings.TrimSpace(input.AlphabeticCode))
```

**Why**: ISO 4217 standard defines codes as UPPERCASE

### 2. Numeric Code Padding

**Rule**: Pad numeric currency codes to exactly 3 digits with leading zeros

**Examples**:

- Input: `"8"` → Output: `"008"` (Albanian Lek)
- Input: `"36"` → Output: `"036"` (Australian Dollar)
- Input: `"840"` → Output: `"840"` (US Dollar - already correct)

**Implementation**:

```go
// Pad numeric code to 3 digits
if input.NumericCode != "" {
    numericCode := fmt.Sprintf("%03s", strings.TrimSpace(input.NumericCode))
    currency.Number = &numericCode
}
```

**Why**:

- ISO 4217 standard defines numeric codes as 3-digit strings
- Database constraint enforces this: `number TEXT`
- Ensures consistent lookups and sorting

### 3. Name Trimming

**Rule**: Remove leading/trailing whitespace from currency names

**Implementation**:

```go
currency.Name = strings.TrimSpace(input.Currency)
```

### 4. Minor Units Validation

**Rule**: Parse minor units (decimal places) as integer. **REQUIRED for active currencies**, NULL allowed only for special/historical currencies.

**Special Handling**: ISO 4217 CSV uses `"N.A."` for currencies where minor units don't apply (precious metals, bond units). Transform converts `"N.A."` → `0`.

**Examples**:

- Input: `"2"` → Output: `2` (USD, EUR, GBP - cents/pence) **[REQUIRED for active]**
- Input: `"0"` → Output: `0` (JPY, KRW - no subdivision) **[REQUIRED for active]**
- Input: `"3"` → Output: `3` (BHD, KWD - fils) **[REQUIRED for active]**
- Input: `"N.A."` → Output: `0` (XAU Gold, XAG Silver - special currencies)
- Input: `""` → Output: `NULL` (empty field)

**Implementation**:

```go
if input.MinorUnit != "" {
    minorUnits, err := strconv.Atoi(strings.TrimSpace(input.MinorUnit))
    if err == nil {
        currency.MinorUnits = &minorUnits
    }
}

// Validate: minor_units REQUIRED for active currencies
if currency.Status == "active" && currency.MinorUnits == nil {
    return fmt.Errorf("minor_units is required for active currency: %s", currency.Code)
}
```

**Why**: 
- Active currencies need decimal precision for transactions
- Database stores as INTEGER
- NULL allowed only for special currencies (precious metals, bond units) and historical currencies

### 5. Country Mapping (alpha2)

**Rule**: Extract country alpha2 code from ENTITY field. NULL if cannot map or if special currency.

**Mapping Strategy**:

1. **Match against countries table**: Use country name lookup
2. **NULL for special currencies**: XAU (Gold), XBA-XBD (Bond units), XDR (SDR), XTS (Testing)
3. **NULL for multi-country currencies where ENTITY is ambiguous**: Handle EUR separately
4. **Validate FK**: Must exist in reference.countries or be NULL

**Implementation**:

```go
// Special currencies without country mapping
specialCurrencies := map[string]bool{
    "XAU": true, "XAG": true, "XPT": true, "XPD": true, // Precious metals
    "XBA": true, "XBB": true, "XBC": true, "XBD": true, // Bond markets units
    "XDR": true, // IMF Special Drawing Rights
    "XTS": true, // Testing code
    "XXX": true, // No currency
}

if specialCurrencies[currency.Code] {
    currency.Alpha2 = nil
} else {
    // Lookup country alpha2 from ENTITY field
    alpha2, err := lookupCountryAlpha2(input.Entity)
    if err == nil {
        currency.Alpha2 = &alpha2
    }
}
```

**Why**:

- Establishes FK relationship where applicable
- Allows NULL for special currencies (XAU, XBA, etc.)
- Enables queries like "all currencies used by US"

### 6. Fund Currency Flag

**Rule**: Parse Fund column as boolean. TRUE if "TRUE", FALSE otherwise.

**Examples**:

- Input: `"TRUE"` → Output: Store in remarks with `fund_currency: true`
- Input: `""` → Output: Normal currency

**Implementation**:

```go
if strings.EqualFold(strings.TrimSpace(input.Fund), "TRUE") {
    // Mark as fund currency in remarks or separate column
    currency.Remarks = "Fund currency: " + input.Remarks
}
```

**Alternative**: Add dedicated `is_fund` BOOLEAN column to table

### 7. Remarks Handling

**Rule**: Combine Remarks field with Fund flag context. Trim whitespace.

**Implementation**:

```go
remarks := strings.TrimSpace(input.Remarks)
if strings.EqualFold(strings.TrimSpace(input.Fund), "TRUE") {
    if remarks != "" {
        remarks = "FUND CURRENCY. " + remarks
    } else {
        remarks = "FUND CURRENCY"
    }
}
currency.Remarks = &remarks
```

### 8. Date Handling (Flexible Format)

**Rule**: Store dates as TEXT to support flexible formats. Validate format if possible.

**Supported Formats**:

- `YYYY-MM-DD` - Full date: "2002-01-01"
- `YYYY-MM` - Month precision: "2003-01"
- `YYYY` - Year precision: "1989"
- `YYYY to YYYY` - Range: "1989 to 1990"
- Empty - NULL

**Implementation**:

```go
startDate := strings.TrimSpace(input.StartDate)
if startDate != "" {
    // Validate format (YYYY-MM-DD, YYYY-MM, YYYY, or "YYYY to YYYY")
    if isValidDateFormat(startDate) {
        currency.StartDate = &startDate
    } else {
        return fmt.Errorf("invalid start_date format: %s", startDate)
    }
}

endDate := strings.TrimSpace(input.EndDate)
if endDate != "" {
    if isValidDateFormat(endDate) {
        currency.EndDate = &endDate
    } else {
        return fmt.Errorf("invalid end_date format: %s", endDate)
    }
}
```

### 9. Status Field

**Rule**: Determine currency status based on end_date

**Status Values** (to be defined):

- `active` - end_date is NULL
- `historical` - end_date is populated
- `special` - Fund currency or precious metal

**Implementation**:

```go
if currency.EndDate != nil && *currency.EndDate != "" {
    currency.Status = "historical"
} else if isFundCurrency(input.Fund) {
    currency.Status = "special"
} else {
    currency.Status = "active"
}
```

## Canonical JSON Format

### Input from csv2json

```json
{
  "ENTITY": "UNITED ARAB EMIRATES (THE)",
  "Currency": "UAE Dirham",
  "Alphabetic Code": "AED",
  "Numeric Code": "784",
  "Minor unit": "2",
  "Fund": "",
  "Remarks": "",
  "start date": "",
  "end date": ""
}
```

### Output to Database (Canonical Format)

```json
{
  "code": "AED",
  "number": "784",
  "name": "UAE Dirham",
  "alpha2": "AE",
  "minor_units": 2,
  "start_date": null,
  "end_date": null,
  "remarks": null,
  "status": "active"
}
```

### Example: Fund Currency

**Input**:

```json
{
  "ENTITY": "BOLIVIA (PLURINATIONAL STATE OF)",
  "Currency": "Mvdol",
  "Alphabetic Code": "BOV",
  "Numeric Code": "984",
  "Minor unit": "2",
  "Fund": "TRUE",
  "Remarks": "For indexation purposes and denomination of certain financial instruments (e.g. treasury bills). The Mvdol is set daily by the Central Bank of Bolivia based on the official USD/BOB rate.",
  "start date": "",
  "end date": ""
}
```

**Output**:

```json
{
  "code": "BOV",
  "number": "984",
  "name": "Mvdol",
  "alpha2": "BO",
  "minor_units": 2,
  "start_date": null,
  "end_date": null,
  "remarks": "FUND CURRENCY. For indexation purposes and denomination of certain financial instruments (e.g. treasury bills). The Mvdol is set daily by the Central Bank of Bolivia based on the official USD/BOB rate.",
  "status": "special"
}
```

### Example: Special Currency (No Country)

**Input**:

```json
{
  "ENTITY": "INTERNATIONAL MONETARY FUND (IMF)",
  "Currency": "SDR (Special Drawing Right)",
  "Alphabetic Code": "XDR",
  "Numeric Code": "960",
  "Minor unit": "",
  "Fund": "",
  "Remarks": "Special Drawing Right",
  "start date": "",
  "end date": ""
}
```

**Output**:

```json
{
  "code": "XDR",
  "number": "960",
  "name": "SDR (Special Drawing Right)",
  "alpha2": null,
  "minor_units": null,
  "start_date": null,
  "end_date": null,
  "remarks": "Special Drawing Right",
  "status": "special"
}
```

### Example: Historical Currency

**Input**:

```json
{
  "ENTITY": "AFGHANISTAN",
  "Currency": "Afghani",
  "Alphabetic Code": "AFA",
  "Numeric Code": "004",
  "Minor unit": "2",
  "Fund": "",
  "Remarks": "Replaced by AFN in 2003",
  "start date": "",
  "end date": "2003-01"
}
```

**Output**:

```json
{
  "code": "AFA",
  "number": "004",
  "name": "Afghani",
  "alpha2": "AF",
  "minor_units": 2,
  "start_date": null,
  "end_date": "2003-01",
  "remarks": "Replaced by AFN in 2003",
  "status": "historical"
}
```

## Validation Rules

### Required Fields

- `code` (Alphabetic Code) - MUST NOT be empty
- `name` (Currency) - MUST NOT be empty

### Optional Fields

- `number` (Numeric Code) - Can be NULL for some special currencies
- `alpha2` - NULL for special currencies (XAU, XBA, etc.)
- `minor_units` - **REQUIRED for status='active'**, NULL allowed only for status='special' or status='historical'
- `start_date` - NULL if not known
- `end_date` - NULL for active currencies
- `remarks` - NULL if no additional context
- `status` - Derived from other fields

### Uniqueness Constraints

- `code` must be unique (PRIMARY KEY)
- Multiple entries with same `code` but different `ENTITY` → map to same currency record

## Error Handling

### Reject Record If

- `code` is empty or invalid format
- `name` is empty
- `number` is invalid format (must be numeric if present)
- `minor_units` is non-numeric (if present, excluding "N.A." which converts to 0)
- `minor_units` is NULL when status='active' (REQUIRED for active currencies)
- `alpha2` references non-existent country
- `start_date` or `end_date` in invalid format

### Expected Rejections

**"No universal currency" rows** (3 entities in ISO 4217 CSV):

- ANTARCTICA
- PALESTINE, STATE OF  
- SOUTH GEORGIA AND THE SOUTH SANDWICH ISLANDS

These rows have empty `Alphabetic Code` and `Currency` = "No universal currency". They are correctly rejected as they don't represent actual currencies.

### Skip/Warn If

- Duplicate `code` with identical data → UPSERT (no-op UPDATE)
- Duplicate `code` with different data → UPDATE existing record

## Business Rules

### Multiple Countries, Same Currency

**Scenario**: AUD is used by Australia, Christmas Island, Cocos Islands, Kiribati, Nauru, Norfolk Island, Tuvalu

**Rule**: Store ONE currency record (code='AUD'). Map alpha2 to primary issuing country (Australia='AU').

**Rationale**: Currency is the entity, not country-currency pair. Countries table can reference currencies for their official currency.

### Fund Currencies

**Rule**: Mark in remarks/status as FUND CURRENCY or special currency type.

**Examples**: CHE (WIR Euro), CHW (WIR Franc), CLF (Unidad de Fomento), COU (Unidad de Valor Real), BOV (Mvdol)

### Precious Metals

**Rule**: Store as special currencies with NULL alpha2.

**Examples**: XAU (Gold), XAG (Silver), XPT (Platinum), XPD (Palladium)

## Testing Requirements

See [TESTING-RULES.md](TESTING-RULES.md) for comprehensive test cases.

## Production Verification Results

### Initial Load (January 28, 2026)

**Source Data**: `currencies.csv` (449 entries + header)

**Processing Results**:

- **Input**: 450 CSV rows (449 currencies + 1 header)
- **Output**: 307 unique currencies loaded
- **Rejections**: 3 (expected - "No universal currency" entities)

**Database Results**:

```sql
total_currencies | active | historical | special
------------------+--------+------------+---------
              307 |    159 |        129 |      19
```

**Audit Trail Results**:

```sql
total_audit_records | inserts | updates
---------------------+---------+---------
                 312 |     294 |      18
```

**Key Metrics**:

- **CSV to Database Consolidation**: 449 CSV entries → 307 unique currencies
  - Reason: Multiple CSV entries per currency code (e.g., RUR has 11 entries)
  - Each unique code gets 1 INSERT + (n-1) potential UPDATEs
- **Special Currencies**: 19 loaded (precious metals: XAU, XAG, XPT, XPD + bond units: XBA-XBD + others)
  - Note: "N.A." in CSV converted to minor_units=0 for these currencies
- **Audit Record Distribution**:
  - 294 INSERT operations (one per unique currency code)
  - 18 UPDATE operations (currencies with multiple CSV entries that changed values)
  - Average: 1.06 audit records per currency (very efficient)
- **Data Quality**:
  - 0 active currencies with NULL minor_units ✅
  - 159 active currencies all properly validated ✅
  - 129 historical currencies with end_date ✅
  - 19 special currencies (fund/precious metals/bond units) ✅

**Historical Override Protection**:

8 duplicate historical entries blocked from overriding active records:

- MWK "Kwacha" (historical) blocked from overriding "Malawi Kwacha" (active)
- PEN "Nuevo Sol" (historical) blocked from overriding "Sol" (active)
- RON "New Romanian Leu" (historical) blocked from overriding "Romanian Leu" (active)
- EUR "Euro" SERBIA AND MONTENEGRO (historical) blocked from overriding 37 active EUR entities
- SDG "Sudanese Pound" SOUTH SUDAN (historical) blocked from overriding SUDAN SDG (active)
- SZL "Lilangeni" SWAZILAND (historical) blocked from overriding ESWATINI SZL (active)
- IDR "Rupiah" TIMOR-LESTE (historical) blocked from overriding INDONESIA IDR (active)
- TRY "New Turkish Lira" (historical) blocked from overriding "Turkish Lira" (active)

**Example Audit Trail: RUR (Russian Ruble)**:

11 CSV entries → 10 audit records:

- 1 INSERT (first occurrence: ARMENIA, end_date=1994-08)
- 9 UPDATEs (subsequent entries with different end dates)
  - Changed field: `{end_date}` in all cases
- 1 no-op skipped (AZERBAIJAN also had 1994-08, no change detected)

**Validation**: All 5 CHECK constraints active and enforcing business rules at database level.
