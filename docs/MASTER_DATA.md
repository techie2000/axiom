# Master Data Management

## Overview

Axiom includes comprehensive master data for countries, currencies, continents, and languages that is automatically
loaded into the database on application startup and kept synchronized through a daily scheduler.

## Data Files

Master data is stored in JSON format at `backend/data/masterdata/`:

- **continents.json** - 7 continents (AF, AN, AS, EU, NA, OC, SA)
- **languages.json** - 184 languages with ISO 639-1 codes, native names, and RTL flags
- **currencies.json** - 180 currencies with ISO 4217 codes (all active global currencies)
- **countries.json** - 196 countries with ISO 3166-1 codes and relationships

## Data Standards

### ISO Standards Used

- **ISO 3166-1** - Country codes (alpha-2 and alpha-3)
- **ISO 4217** - Currency codes
- **ISO 639-1** - Language codes (two-letter)

### Data Coverage

#### Continents (7 entries)

- AF: Africa
- AN: Antarctica  
- AS: Asia
- EU: Europe
- NA: North America
- OC: Oceania
- SA: South America

#### Languages (184 entries)

Includes major world languages with:

- **English name**: "Arabic"
- **Native name**: "العربية" (in native script)
- **RTL flag**: true for right-to-left languages (Arabic, Hebrew, Persian, Urdu, etc.)
- **ISO 639-1 code**: Two-letter code (e.g., "ar", "en", "zh")

Coverage includes:

- European languages (40+): English, Spanish, French, German, Italian, Russian, etc.
- Asian languages (50+): Chinese, Japanese, Korean, Hindi, Bengali, Thai, etc.
- Middle Eastern languages (10+): Arabic, Hebrew, Persian, Turkish, Kurdish, etc.
- African languages (30+): Swahili, Hausa, Yoruba, Amharic, Zulu, etc.
- Indigenous languages (15+): Navajo, Quechua, Guarani, Maori, etc.

#### Currencies (180 entries)

All active ISO 4217 currencies with detailed attributes:

- **Code**: ISO 4217 three-letter code (e.g., "USD", "EUR")
- **Name**: English name ("US Dollar")
- **Symbol**: International symbol ("$")
- **Symbol Native**: Local format ("$" for USD, "₹" for INR)
- **Decimal Digits**: Number of decimal places (0-3)
  - 0 decimals: JPY, KRW, IDR, VND, CLP, etc.
  - 2 decimals: USD, EUR, GBP, CAD, etc. (most currencies)
  - 3 decimals: KWD, BHD, OMR, JOD, TND (high-value currencies)
- **Rounding**: Rounding increment (typically 0)
- **Name Plural**: Plural form ("US dollars", "euros")

Coverage by region:

- **Americas**: USD, CAD, BRL, MXN, ARS, CLP, COP, PEN, TTD, JMD, BBD, XCD, etc. (25+ currencies)
- **Europe**: EUR, GBP, CHF, SEK, NOK, DKK, PLN, CZK, RUB, HUF, RON, BGN, HRK, etc. (30+ currencies)
- **Asia**: JPY, CNY, INR, SGD, HKD, KRW, THB, MYR, IDR, PHP, VND, PKR, BDT, NPR, etc. (40+ currencies)
- **Middle East**: SAR, AED, ILS, QAR, KWD, BHD, OMR, JOD, IQD, IRR, LBP, SYP, YER (13+ currencies)
- **Africa**: ZAR, EGP, NGN, KES, GHS, MAD, TND, DZD, AOA, MZN, ZMW, BWP, etc. (45+ currencies)
- **Oceania**: AUD, NZD, FJD, TOP, WST, PGK, SBD, VUV (8+ currencies)
- **Special**: Precious metals (XAU, XAG, XPT, XPD), supranational units (XDR, XSU), investment units

#### Countries (196 entries)

Comprehensive country data including:

- **Code**: ISO 3166-1 alpha-2 (2-letter code)
- **Alpha3 Code**: ISO 3166-1 alpha-3 (3-letter code)
- **Name**: Official English name
- **Native Name**: Name in local language/script
- **Phone Codes**: International dialing codes (array)
- **Continent**: Two-letter continent code
- **Capital**: Capital city name
- **Currency Codes**: Currencies used (array, some countries use multiple)
- **Languages**: Primary languages spoken (array)
- **Region**: Sub-continental geographic region

Coverage by continent:

- Africa: 54 countries (Northern, Western, Eastern, Middle, Southern Africa)
- Asia: 48 countries (Eastern, Southern, South-Eastern, Western, Central Asia)
- Europe: 48 countries (Western, Eastern, Northern, Southern Europe)
- North America: 23 countries (USA, Canada, Mexico, Central America, Caribbean)
- South America: 12 countries (Brazil, Argentina, Chile, Colombia, etc.)
- Oceania: 14 countries (Australia, New Zealand, Pacific islands)

## Database Schema

### Countries Table

```sql
CREATE TABLE countries (
    id UUID PRIMARY KEY,
    code VARCHAR(2) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    native_name VARCHAR(255),
    alpha3_code VARCHAR(3),
    phone_codes JSONB,           -- Array: [1], [44], [86]
    continent VARCHAR(2),         -- AF, AS, EU, NA, SA, OC, AN
    capital VARCHAR(255),
    currency_codes JSONB,         -- Array: ["USD"], ["EUR", "USD"]
    languages JSONB,              -- Array: ["en"], ["en", "es"]
    region VARCHAR(255),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);
```

### Currencies Table

```sql
CREATE TABLE currencies (
    id UUID PRIMARY KEY,
    code VARCHAR(3) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(10),
    symbol_native VARCHAR(10),
    decimal_places INTEGER DEFAULT 2,
    decimal_digits INTEGER DEFAULT 2,
    rounding INTEGER DEFAULT 0,
    name_plural VARCHAR(255),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);
```

### Continents Table

```sql
CREATE TABLE continents (
    code VARCHAR(2) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Languages Table

```sql
CREATE TABLE languages (
    code VARCHAR(2) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    native VARCHAR(100) NOT NULL,
    rtl BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

## Loading Behavior

### Startup Loading

When the application starts, the `MasterDataService` automatically:

1. **Checks if data exists**: Counts records in each table
2. **Skips if populated**: If data already exists, it logs and skips loading
3. **Loads in dependency order**:
   - Continents (no dependencies)
   - Languages (no dependencies)
   - Currencies (no dependencies)
   - Countries (references continents, currencies, languages via codes)

Example startup log:

```text
{"level":"info","time":"2026-02-18T14:30:00Z","message":"Checking master data..."}
{"level":"info","count":7,"time":"2026-02-18T14:30:00Z","message":"Continents already loaded, skipping"}
{"level":"info","count":184,"time":"2026-02-18T14:30:00Z","message":"Languages already loaded, skipping"}
{"level":"info","count":60,"time":"2026-02-18T14:30:00Z","message":"Currencies already loaded, skipping"}
{"level":"info","count":196,"time":"2026-02-18T14:30:00Z","message":"Countries already loaded, skipping"}
```

### Daily Synchronization

The scheduler service runs daily syncs in the following order to prevent conflicts:

1. **12:00 AM (Midnight)** - File cleanup removes old LEI files
2. **1:00 AM** - Master data sync checks for updates
3. **12:00 UTC** - LEI full sync downloads and processes data

**Schedule rationale:**

- File cleanup runs FIRST to free disk space before downloads
- Master data sync runs BEFORE LEI sync to ensure foreign key integrity
- LEI sync has clean slate with no risk of cleanup interference

The scheduler checks for updates by comparing file timestamps or checksums, reloads data if needed, and logs all actions.

The sync is designed to be:

- **Non-disruptive**: Runs after prerequisite jobs complete (cleanup and master data)
- **Properly ordered**: File cleanup → Master data → LEI sync ensures no conflicts
- **Safe**: Cleanup completes before any sync starts, preventing file deletion during processing
- **Idempotent**: Safe to run multiple times
- **Logged**: All actions are recorded for audit

**Important**: Master data must be loaded before LEI data because:

- LEI records reference countries via foreign keys
- Countries reference currencies via foreign keys
- Loading order: Currencies → Countries → LEI data ensures referential integrity

## Manual Operations

### Reload Master Data

To manually reload master data (e.g., after updating JSON files):

1. **Delete existing data** (optional - service skips if data exists):

   ```sql
   -- Development database
   DELETE FROM countries;
   DELETE FROM currencies;
   DELETE FROM languages;
   DELETE FROM continents;
   ```

2. **Restart the application**: Data will be reloaded on startup

### Update Master Data

To update master data:

1. **Edit JSON files** in `backend/data/masterdata/`
2. **Validate JSON format**: Ensure files are valid JSON
3. **Test locally**: Delete data and restart to verify loading
4. **Commit changes**: Push to repository
5. **Deploy**: The daily sync will pick up changes within 24 hours
   - Or restart the application to load immediately

### Add New Entries

#### Add a New Currency

Edit `backend/data/masterdata/currencies.json`:

```json
{
  "NEW": {
    "code": "NEW",
    "name": "New Currency",
    "symbol": "N$",
    "symbol_native": "N$",
    "decimal_digits": 2,
    "rounding": 0,
    "name_plural": "new currencies"
  }
}
```

#### Add a New Country

Edit `backend/data/masterdata/countries.json`:

```json
{
  "code": "XX",
  "alpha3_code": "XXX",
  "name": "New Country",
  "native_name": "Local Name",
  "phone_codes": [999],
  "continent": "EU",
  "capital": "Capital City",
  "currency_codes": ["EUR"],
  "languages": ["en"],
  "region": "Western Europe"
}
```

#### Add a New Language

Edit `backend/data/masterdata/languages.json`:

```json
{
  "xx": {
    "code": "xx",
    "name": "New Language",
    "native": "Native Name",
    "rtl": false
  }
}
```

## API Access

Master data can be accessed through the REST API:

### List Countries

```bash
GET /api/v1/countries?limit=50&offset=0
```

Response:

```json
[
  {
    "id": "uuid",
    "code": "US",
    "name": "United States",
    "native_name": "United States",
    "alpha3_code": "USA",
    "phone_codes": [1],
    "continent": "NA",
    "capital": "Washington, D.C.",
    "currency_codes": ["USD"],
    "languages": ["en"],
    "region": "North America",
    "active": true
  }
]
```

### List Currencies

```bash
GET /api/v1/currencies?limit=50&offset=0
```

Response:

```json
[
  {
    "id": "uuid",
    "code": "USD",
    "name": "US Dollar",
    "symbol": "$",
    "symbol_native": "$",
    "decimal_digits": 2,
    "rounding": 0,
    "name_plural": "US dollars",
    "active": true
  }
]
```

## Migration

The master data schema is created by migration `000015_enhance_masterdata_schema.up.sql`.

To apply this migration:

```bash
# Development
make migrate-dev-up

# UAT
make migrate-uat-up

# Production
make migrate-prod-up
```

To rollback:

```bash
make migrate-dev-down  # or migrate-uat-down, migrate-prod-down
```

## Data Quality

### Validation

The service validates data during loading:

- **Required fields**: Code, name must be present
- **Unique constraints**: Codes must be unique
- **Format validation**: Codes must match expected length
- **JSON parsing**: JSONB fields must be valid JSON arrays

### Error Handling

If a record fails to insert (e.g., duplicate code):

- **Warning logged**: Record is skipped with a warning
- **Continues loading**: Other records are still processed
- **No partial state**: Transactions ensure consistency

### Data Sources

Data is compiled from reliable public sources:

- **ISO 3166** for country codes
- **ISO 4217** for currency codes
- **ISO 639-1** for language codes
- **UN M49** for regional classifications
- **CIA World Factbook** for capitals and regions
- **Wikipedia** for native names and translations

## Troubleshooting

### Data Not Loading

**Symptom**: Application starts but master data tables are empty

**Solutions**:

1. Check file paths: `backend/data/masterdata/` must be accessible
2. Check JSON format: Validate files with `jq` or JSON validator
3. Check permissions: Ensure application can read files
4. Check logs: Look for error messages during startup

### Duplicate Key Errors

**Symptom**: Warnings about failed inserts during loading

**Cause**: Data already exists (expected behavior)

**Solution**: This is normal if data was loaded previously. The service skips duplicates.

### Missing Data in JSON Files

**Symptom**: Some countries/currencies not appearing

**Solutions**:

1. Verify JSON file is complete and not truncated
2. Check for JSON syntax errors
3. Ensure file was committed to repository
4. Restart application to reload

## Future Enhancements

Potential improvements for master data management:

1. **API for updates**: Admin API to update master data without file editing
2. **Version tracking**: Track version numbers and change history
3. **Data validation**: Stricter validation rules and error reporting
4. **Change detection**: More sophisticated file change detection (checksums)
5. **Partial updates**: Update only changed records instead of full reload
6. **Data export**: Export master data in various formats (CSV, Excel)
7. **Multi-currency support**: Enhanced multi-currency handling for countries
8. **Historical data**: Track historical changes to country/currency data
9. **Data sourcing**: Automated data updates from authoritative sources
10. **API integration**: Integration with external data providers

## Related Documentation

- [Database Schema](../database/SCHEMA.md)
- [API Documentation](../api/API.md)
- [Migration Guide](../database/MIGRATIONS.md)
- [Scheduler Service](../services/SCHEDULER.md)
