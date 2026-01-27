# Countries Reference Data

This directory contains ISO 3166-1 country code data that is version-controlled as **Level 1 reference data** (system-maintained).

## Files

- **countries.csv** - Core ISO 3166-1 country codes
  - Maintained by system administrators
  - Version controlled for audit trail
  - Updated when ISO publishes changes to country codes
  - Format: English name, French name, Alpha-2, Alpha-3, Numeric, Status

## Data Maintenance

This is **system-maintained** reference data, unlike user-maintained data (e.g., instruments):

- Changes are made via pull requests
- Each change is reviewed and documented
- Full history is preserved in git
- Data is authoritative from ISO 3166-1 standard

## Loading Data

Use the provided scripts to load this data into Axiom:

```powershell
# Option 1: Direct database load (for testing)
.\scripts\seed-database.ps1

# Option 2: Through the full pipeline (csv2json → RabbitMQ → canonicalizer)
.\scripts\test-pipeline.ps1
```

## Sources

- ISO 3166-1: https://www.iso.org/iso-3166-country-codes.html
- ISO 3166-1 Glossary: https://www.iso.org/glossary-for-iso-3166.html

## Updates

When updating this data:
1. Document the reason (new country, name change, code reassignment)
2. Update the CSV file
3. Commit with clear message: "Update ISO 3166-1: [reason]"
4. Deploy through standard pipeline
