<#
.SYNOPSIS
    Populates currency_code column in countries table based on ISO 4217 ENTITY field

.DESCRIPTION
    This script parses the currencies.csv ENTITY field to map countries to their currencies,
    then updates the reference.countries.currency_code column. It validates all data against
    the current database state and reports matches, mismatches, and skipped entries.

.PARAMETER CurrenciesCsvPath
    Path to currencies.csv file (defaults to modules/reference/currencies/data/currencies.csv)

.PARAMETER ConnectionString
    PostgreSQL connection string (defaults to local Docker instance)

.PARAMETER DryRun
    If specified, shows what would be updated without making changes

.EXAMPLE
    .\Populate-CountryCurrencies.ps1
    
.EXAMPLE
    .\Populate-CountryCurrencies.ps1 -DryRun
    
.EXAMPLE
    .\Populate-CountryCurrencies.ps1 -CurrenciesCsvPath "C:\data\currencies.csv"

.NOTES
    This is a maintenance script, not a migration. Run after:
    - Initial data load
    - Adding new countries
    - Currency changes (country adopts/abandons currency)
#>

[CmdletBinding()]
param(
    [string]$CurrenciesCsvPath = "$PSScriptRoot\..\modules\reference\currencies\data\currencies.csv",
    [string]$ConnectionString = "Host=localhost;Port=5432;Database=axiom_db;Username=axiom;Password=localdev123",
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Check if Npgsql is available, if not use psql
$useNpgsql = $false
try {
    Import-Module -Name Npgsql -ErrorAction Stop
    $useNpgsql = $true
    Write-Host "✓ Using Npgsql for database operations" -ForegroundColor Green
} catch {
    Write-Host "ℹ Using psql command-line tool for database operations" -ForegroundColor Cyan
    Write-Host "  (Install Npgsql module for better performance: Install-Module -Name Npgsql)" -ForegroundColor DarkGray
}

function Invoke-PostgresQuery {
    param(
        [string]$Query,
        [switch]$AsHashtable
    )
    
    if ($useNpgsql) {
        $connection = New-Object Npgsql.NpgsqlConnection($ConnectionString)
        $connection.Open()
        try {
            $command = $connection.CreateCommand()
            $command.CommandText = $Query
            $reader = $command.ExecuteReader()
            $results = @()
            while ($reader.Read()) {
                $row = @{}
                for ($i = 0; $i -lt $reader.FieldCount; $i++) {
                    $row[$reader.GetName($i)] = $reader.GetValue($i)
                }
                $results += [PSCustomObject]$row
            }
            return $results
        } finally {
            $connection.Close()
        }
    } else {
        # Use psql with CSV output for easier parsing
        $env:PGPASSWORD = "localdev123"
        $tempFile = [System.IO.Path]::GetTempFileName()
        try {
            $output = docker exec -i axiom-postgres psql -U axiom axiom_db -c "COPY ($Query) TO STDOUT WITH CSV HEADER"
            if ($LASTEXITCODE -ne 0) {
                throw "psql command failed with exit code $LASTEXITCODE"
            }
            $output | Set-Content -Path $tempFile -Encoding UTF8
            return Import-Csv -Path $tempFile
        } finally {
            if (Test-Path $tempFile) {
                Remove-Item $tempFile
            }
        }
    }
}

function Invoke-PostgresNonQuery {
    param([string]$Query)
    
    if ($useNpgsql) {
        $connection = New-Object Npgsql.NpgsqlConnection($ConnectionString)
        $connection.Open()
        try {
            $command = $connection.CreateCommand()
            $command.CommandText = $Query
            return $command.ExecuteNonQuery()
        } finally {
            $connection.Close()
        }
    } else {
        $env:PGPASSWORD = "localdev123"
        docker exec -i axiom-postgres psql -U axiom axiom_db -c $Query | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "psql command failed with exit code $LASTEXITCODE"
        }
    }
}

Write-Host "`n=== Populate Country Currencies ===" -ForegroundColor Cyan
Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n" -ForegroundColor Gray

# Validate CSV exists
if (-not (Test-Path $CurrenciesCsvPath)) {
    Write-Error "currencies.csv not found at: $CurrenciesCsvPath"
    exit 1
}

Write-Host "📄 Reading currencies.csv..." -ForegroundColor Yellow
$csvData = Import-Csv -Path $CurrenciesCsvPath

# Parse ENTITY → Currency Code mappings
Write-Host "🔍 Parsing ENTITY field mappings..." -ForegroundColor Yellow
$entityMappings = @{}
foreach ($row in $csvData) {
    $entity = $row.ENTITY
    $code = $row.'Alphabetic Code'
    
    # Skip fund currencies (Fund = TRUE)
    if ($row.Fund -eq 'TRUE') {
        continue
    }
    
    # Skip special non-country entities
    if ($entity -in @('EUROPEAN UNION', 'INTERNATIONAL MONETARY FUND (IMF)', 'ZZ07_Bond Markets Unit European_EURCO', 'ZZ08_Testing_Code', 'ZZ09_No_Currency', 'ZZ11_Gold')) {
        continue
    }
    
    if (-not $entityMappings.ContainsKey($entity)) {
        $entityMappings[$entity] = @()
    }
    $entityMappings[$entity] += $code
}

Write-Host "  Found $($entityMappings.Count) unique country/territory entries" -ForegroundColor Gray

# Query database for countries
Write-Host "`n🔍 Querying database for countries..." -ForegroundColor Yellow
$countries = Invoke-PostgresQuery -Query "SELECT alpha2, name_english, currency_code FROM reference.countries ORDER BY alpha2"
Write-Host "  Found $($countries.Count) countries in database" -ForegroundColor Gray

# Query database for valid currencies with status and end_date for prioritization
Write-Host "`n🔍 Querying database for currencies..." -ForegroundColor Yellow
$currencies = Invoke-PostgresQuery -Query "SELECT code, status, end_date FROM reference.currencies ORDER BY code"
$currencyDetails = @{}
foreach ($curr in $currencies) {
    $currencyDetails[$curr.code] = @{
        Status = $curr.status
        EndDate = $curr.end_date
    }
}
$validCurrencyCodes = $currencies | Where-Object { $_.status -eq 'active' } | ForEach-Object { $_.code }
Write-Host "  Found $($validCurrencyCodes.Count) active currencies in database" -ForegroundColor Gray

# Build country lookup by normalized name
Write-Host "`n🔍 Building country name lookup..." -ForegroundColor Yellow
$countryLookup = @{}
foreach ($country in $countries) {
    $normalizedName = $country.name_english.ToUpper().Trim()
    $countryLookup[$normalizedName] = $country
}

# Manual overrides for ambiguous multi-currency cases
# Used when multiple active currencies exist with no clear priority
$currencyOverrides = @{
    'VE' = 'VES'  # Venezuela: VES (Bolívar Soberano) is primary over VED (digital variant)
}

# Match ENTITY to countries and generate updates
Write-Host "`n🔗 Matching ENTITY to countries..." -ForegroundColor Yellow
$matches = @()
$unmatched = @()
$invalidCurrency = @()
$multiCurrency = @()

foreach ($entity in $entityMappings.Keys) {
    $normalizedEntity = $entity.ToUpper().Trim()
    
    if ($countryLookup.ContainsKey($normalizedEntity)) {
        $country = $countryLookup[$normalizedEntity]
        $currencyCodes = $entityMappings[$entity]
        $currencyCode = $null  # Initialize
        
        # Check for manual override first
        if ($currencyOverrides.ContainsKey($country.alpha2)) {
            $currencyCode = $currencyOverrides[$country.alpha2]
            if ($currencyCodes -contains $currencyCode) {
                # Override exists and is valid
                if ($currencyCodes.Count -gt 1) {
                    $multiCurrency += [PSCustomObject]@{
                        Entity = $entity
                        Alpha2 = $country.alpha2
                        Currencies = $currencyCodes -join ', '
                        Selected = $currencyCode
                        Reason = 'manual-override'
                    }
                }
            } else {
                # Override currency not in list, fall through to normal logic
                $currencyCode = $null
            }
        }
        
        # Handle multiple currencies - prioritize by status and end_date
        if (-not $currencyCode -and $currencyCodes.Count -gt 1) {
            # Prioritize: 1) active status, 2) no end_date, 3) first in list
            $sortedCodes = $currencyCodes | Sort-Object {
                $details = $currencyDetails[$_]
                if (-not $details) { return 99 }  # Unknown currency - deprioritize
                
                $priority = 0
                # Active currencies get priority 0, inactive get 10
                if ($details.Status -ne 'active') { $priority += 10 }
                # Currencies with end_date get +5 penalty
                if ($details.EndDate) { $priority += 5 }
                return $priority
            }
            
            $primaryCurrency = $sortedCodes[0]
            $multiCurrency += [PSCustomObject]@{
                Entity = $entity
                Alpha2 = $country.alpha2
                Currencies = $currencyCodes -join ', '
                Selected = $primaryCurrency
                Reason = if ($currencyDetails[$primaryCurrency].Status -eq 'active') { 'active' } else { 'historical' }
            }
            $currencyCode = $primaryCurrency
        } elseif (-not $currencyCode) {
            $currencyCode = $currencyCodes[0]
        }
        
        # Validate currency exists in database
        if ($currencyCode -notin $validCurrencyCodes) {
            $invalidCurrency += [PSCustomObject]@{
                Entity = $entity
                Alpha2 = $country.alpha2
                Currency = $currencyCode
            }
            continue
        }
        
        # Only update if currency_code is different (or NULL)
        if ($country.currency_code -ne $currencyCode) {
            $matches += [PSCustomObject]@{
                Alpha2 = $country.alpha2
                CountryName = $country.name_english
                OldCurrency = $country.currency_code
                NewCurrency = $currencyCode
                Entity = $entity
            }
        }
    } else {
        $unmatched += [PSCustomObject]@{
            Entity = $entity
            Currencies = ($entityMappings[$entity] -join ', ')
        }
    }
}

# Display results
Write-Host "`n=== Results ===" -ForegroundColor Cyan
Write-Host "✅ Matched: $($matches.Count) countries to update" -ForegroundColor Green
Write-Host "⚠️  Unmatched: $($unmatched.Count) ENTITY values not found in countries table" -ForegroundColor Yellow
Write-Host "❌ Invalid: $($invalidCurrency.Count) references to inactive/missing currencies" -ForegroundColor Red
if ($multiCurrency.Count -gt 0) {
    Write-Host "ℹ️  Multi-currency: $($multiCurrency.Count) countries with multiple currencies" -ForegroundColor Cyan
}

# Show unmatched details
if ($unmatched.Count -gt 0) {
    Write-Host "`n⚠️  Unmatched ENTITY values (manual review needed):" -ForegroundColor Yellow
    $unmatched | Format-Table -Property Entity, Currencies -AutoSize | Out-String | Write-Host
}

# Show invalid currency details
if ($invalidCurrency.Count -gt 0) {
    Write-Host "`n❌ Invalid currency references:" -ForegroundColor Red
    $invalidCurrency | Format-Table -Property Entity, Alpha2, Currency -AutoSize | Out-String | Write-Host
}

# Show multi-currency details
if ($multiCurrency.Count -gt 0) {
    Write-Host "`nℹ️  Multi-currency countries (using first non-fund currency):" -ForegroundColor Cyan
    $multiCurrency | Format-Table -Property Entity, Alpha2, Currencies, Selected -AutoSize | Out-String | Write-Host
}

# Execute updates
if ($matches.Count -eq 0) {
    Write-Host "`n✓ No updates needed - all countries already have correct currency_code" -ForegroundColor Green
} else {
    Write-Host "`n📝 Updates to apply:" -ForegroundColor Cyan
    $matches | Select-Object -First 10 | Format-Table -Property Alpha2, CountryName, OldCurrency, NewCurrency -AutoSize | Out-String | Write-Host
    if ($matches.Count -gt 10) {
        Write-Host "  ... and $($matches.Count - 10) more" -ForegroundColor Gray
    }
    
    if ($DryRun) {
        Write-Host "`n🔍 DRY RUN - No changes made" -ForegroundColor Yellow
    } else {
        Write-Host "`n💾 Applying updates..." -ForegroundColor Yellow
        $updateCount = 0
        foreach ($match in $matches) {
            $query = "UPDATE reference.countries SET currency_code = '$($match.NewCurrency)' WHERE alpha2 = '$($match.Alpha2)'"
            try {
                Invoke-PostgresNonQuery -Query $query
                $updateCount++
            } catch {
                Write-Host "  ❌ Failed to update $($match.Alpha2): $_" -ForegroundColor Red
            }
        }
        Write-Host "✓ Updated $updateCount countries" -ForegroundColor Green
    }
}

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Countries in database: $($countries.Count)" -ForegroundColor Gray
Write-Host "ENTITY mappings parsed: $($entityMappings.Count)" -ForegroundColor Gray
Write-Host "Matched and updated: $($matches.Count)" -ForegroundColor $(if ($matches.Count -gt 0) { 'Green' } else { 'Gray' })
Write-Host "Unmatched (need review): $($unmatched.Count)" -ForegroundColor $(if ($unmatched.Count -gt 0) { 'Yellow' } else { 'Gray' })
Write-Host "Invalid currencies: $($invalidCurrency.Count)" -ForegroundColor $(if ($invalidCurrency.Count -gt 0) { 'Red' } else { 'Gray' })

Write-Host "`n✓ Complete" -ForegroundColor Green
