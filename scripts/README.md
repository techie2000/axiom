# Axiom Utility Scripts

Maintenance and operational scripts for the Axiom reference data system.

## Data Maintenance Scripts

### Populate-CountryCurrencies.ps1

Populates the `reference.countries.currency_code` column by parsing ISO 4217 ENTITY field mappings from the currencies CSV file.

**Purpose**: Map countries to their official currencies using ISO 4217 data as the source of truth.

**When to run**:
- After initial countries/currencies data load
- After adding new countries to the system
- After currency changes (country adopts/abandons currency)
- Periodically to refresh currency mappings

**Usage**:

```powershell
# Dry run (preview changes without applying)
.\scripts\Populate-CountryCurrencies.ps1 -DryRun

# Apply changes
.\scripts\Populate-CountryCurrencies.ps1

# Custom CSV path
.\scripts\Populate-CountryCurrencies.ps1 -CurrenciesCsvPath "C:\data\currencies.csv"
```

**How it works**:

1. **Parse CSV**: Reads currencies.csv ENTITY field (country names)
2. **Query database**: Gets all countries and active currencies
3. **Match**: Case-insensitive matching of ENTITY to country names
4. **Validate**: Ensures currency codes exist in database
5. **Update**: Sets `currency_code` for matched countries
6. **Report**: Shows matches, unmatched entries, and invalid references

**Output categories**:

- ✅ **Matched**: Countries successfully mapped to currencies (typically 230-240)
- ⚠️ **Unmatched**: ENTITY values not found in countries table (~50)
  - Name variations (e.g., "NETHERLANDS (THE)" vs "Netherlands")
  - Historical entries (e.g., "CZECHOSLOVAKIA", "YUGOSLAVIA")
  - Special codes (e.g., "ZZ01_Gold-Franc", test codes)
- ❌ **Invalid**: References to inactive/missing currencies (~8)
  - Currencies not in database or marked inactive
  - Historical currency codes (e.g., ANG for Netherlands Antilles)
- ℹ️ **Multi-currency**: Countries with multiple currencies (~84)
  - Script selects first non-fund currency
  - Examples: Bolivia (BOB, BOV), Haiti (HTG, USD), El Salvador (SVC, USD)

**Known limitations**:

1. **Name matching**: Case-insensitive exact match only
   - May miss variations like "Türkiye" vs "Turkey"
   - Manual review of unmatched entries recommended
   
2. **Multi-currency handling**: Always selects first currency
   - Some countries use multiple currencies equally
   - May need manual adjustment for specific cases
   
3. **Historical data**: Includes inactive currencies from CSV
   - Script filters to active currencies only
   - Some historical mappings will be skipped

**Dependencies**:

- PowerShell 5.1+ (Windows) or PowerShell Core 7+ (cross-platform)
- Docker (for database access via `docker exec`)
- Optional: Npgsql PowerShell module for better performance
  - Install: `Install-Module -Name Npgsql`

**Database requirements**:

- `reference.countries` table with `currency_code` column (added in migration 017)
- `reference.currencies` table populated
- PostgreSQL accessible via Docker container `axiom-postgres`

**Examples**:

```powershell
# Preview what would be updated
PS> .\scripts\Populate-CountryCurrencies.ps1 -DryRun

=== Results ===
✅ Matched: 228 countries to update
⚠️  Unmatched: 51 ENTITY values not found in countries table
❌ Invalid: 8 references to inactive/missing currencies
ℹ️  Multi-currency: 84 countries with multiple currencies

# Apply updates
PS> .\scripts\Populate-CountryCurrencies.ps1

💾 Applying updates...
✓ Updated 228 countries

=== Summary ===
Countries in database: 603
ENTITY mappings parsed: 293
Matched and updated: 228
```

**Troubleshooting**:

- **"psql command failed"**: Ensure Docker container `axiom-postgres` is running
- **"Cannot convert value"**: Update PowerShell to 5.1+ or install PowerShell Core
- **Slow performance**: Install Npgsql module for faster database operations
- **Unexpected matches**: Review multi-currency report and unmatched list

## Contributing

When adding new scripts:
1. Follow PowerShell best practices (approved verbs, proper error handling)
2. Include comprehensive help documentation (`.SYNOPSIS`, `.DESCRIPTION`, `.EXAMPLE`)
3. Support `-DryRun` for destructive operations
4. Provide clear output with colored status indicators
5. Update this README with usage examples

---

*Last updated: January 28, 2026*
