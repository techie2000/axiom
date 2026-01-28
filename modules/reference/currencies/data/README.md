# Currencies Reference Data

This directory contains ISO 4217 currency code data that is version-controlled as **Level 1 reference data** (system-maintained).

## Files

- **currencies.csv** - Core ISO 4217 currency codes
  - Maintained by system administrators
  - Version controlled for audit trail
  - Updated when ISO publishes changes to currency codes
  - Format: ENTITY, Currency, Alphabetic Code, Numeric Code, Minor unit, Fund, Remarks, start date, end date

## Data Maintenance

This is **system-maintained** reference data:

- Changes are made via pull requests
- Each change is reviewed and documented
- Full history is preserved in git
- Data is authoritative from ISO 4217 standard

## Key Characteristics

### One-to-Many Country Relationships

- Multiple countries can use the same currency (e.g., AUD used by Australia, Christmas Island, Cocos Islands, Kiribati, Nauru, Norfolk Island, Tuvalu)
- Some currencies don't map to any country (e.g., XAU Gold, XBA Bond Markets Unit)

### Special Currency Types

- **Fund currencies** (Fund=TRUE): WIR Euro (CHE), WIR Franc (CHW), Unidad de Fomento (CLF), Unidad de Valor Real (COU), Mvdol (BOV)
- **Precious metals**: XAU (Gold), XAG (Silver), XPT (Platinum), XPD (Palladium)
- **Special drawing rights**: XDR (IMF Special Drawing Rights)
- **Testing codes**: XTS (Code reserved for testing)

### Temporal Data

- **start_date**: When currency was introduced (flexible format: YYYY-MM-DD, YYYY-MM, YYYY, "YYYY to YYYY")
- **end_date**: When currency was withdrawn (NULL for active currencies)
- **Historical currencies**: May have imprecise dates (e.g., "2003-01" or "1989 to 1990")

## Loading Data

Use the provided scripts to load this data into Axiom:

```powershell
# Option 1: Direct database load (for testing)
.\scripts\seed-database.ps1

# Option 2: Through the full pipeline (csv2json → RabbitMQ → canonicalizer)
.\scripts\test-pipeline.ps1
```

## Sources

- ISO 4217: https://www.iso.org/iso-4217-currency-codes.html
- ISO 4217 Maintenance Agency: https://www.six-group.com/en/products-services/financial-information/data-standards.html

## Updates

When updating this data:

1. Document the reason (new currency, code change, withdrawal)
2. Update the CSV file
3. Commit with clear message: "Update ISO 4217: [reason]"
4. Deploy through standard pipeline
