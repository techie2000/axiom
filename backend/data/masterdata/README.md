# Master Data Files

This directory contains reference data for countries, currencies, continents, and languages that is automatically loaded into the Axiom database.

## Files

### continents.json
Continent reference data (7 entries)
- Maps continent codes to continent names
- Codes: AF, AN, AS, EU, NA, OC, SA

### languages.json
Language reference data (184 entries)
- ISO 639-1 two-letter language codes
- English and native language names
- Right-to-left (RTL) flag for languages like Arabic and Hebrew
- Coverage: European, Asian, African, Middle Eastern, and Indigenous languages

### currencies.json
Currency reference data (180 entries)
- ISO 4217 three-letter currency codes
- Currency symbols (international and native)
- Decimal places and rounding information
- Coverage: All active currencies from all continents, plus precious metals and special codes

### countries.json
Country reference data (196 entries)
- ISO 3166-1 alpha-2 and alpha-3 country codes
- Official and native country names
- Phone codes, capitals, regions
- Relationships to currencies, languages, and continents
- Coverage: All recognized countries worldwide

## Data Standards

All data follows international ISO standards:
- **ISO 3166-1**: Country codes
- **ISO 4217**: Currency codes (all 180 active currencies)
- **ISO 639-1**: Language codes

## Loading

These files are automatically loaded into the database:
1. **At application startup** - if tables are empty
2. **Daily at 1 AM** - checks for updates and reloads if changed (runs BEFORE LEI sync at 2 AM)

The loading process is idempotent (safe to run multiple times) and logs all actions.

**Loading Order**: 
1. Continents (no dependencies)
2. Languages (no dependencies)
3. **Currencies** (no dependencies - loaded first)
4. **Countries** (depends on currencies and continents)
5. LEI data (depends on countries - loaded at 2 AM)

## Updating

To update master data:
1. Edit the appropriate JSON file
2. Validate JSON syntax (use `jq` or online validator)
3. Test locally by deleting data and restarting the application
4. Commit and push changes
5. Changes will be picked up by daily sync or on next application restart

## Schema

### Continent Entry
```json
{
  "EU": "Europe"
}
```

### Language Entry
```json
{
  "en": {
    "code": "en",
    "name": "English",
    "native": "English"
  },
  "ar": {
    "code": "ar",
    "name": "Arabic",
    "native": "العربية",
    "rtl": true
  }
}
```

### Currency Entry
```json
{
  "USD": {
    "code": "USD",
    "name": "US Dollar",
    "symbol": "$",
    "symbol_native": "$",
    "decimal_digits": 2,
    "rounding": 0,
    "name_plural": "US dollars"
  }
}
```

### Country Entry
```json
{
  "code": "US",
  "alpha3_code": "USA",
  "name": "United States",
  "native_name": "United States",
  "phone_codes": [1],
  "continent": "NA",
  "capital": "Washington, D.C.",
  "currency_codes": ["USD"],
  "languages": ["en"],
  "region": "North America"
}
```

## Validation

Files are validated during loading:
- JSON syntax must be valid
- Required fields must be present
- Codes must be unique
- References (continent, currency, language codes) should exist

Validation errors are logged but don't prevent loading of other valid records.

## Documentation

For detailed information, see [docs/MASTER_DATA.md](../../../docs/MASTER_DATA.md)
