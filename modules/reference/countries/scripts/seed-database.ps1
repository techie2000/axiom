#!/usr/bin/env pwsh
# Direct database seeding script for testing (bypasses RabbitMQ pipeline)
# This inserts the test countries directly into PostgreSQL

param(
    [string]$DbHost = "localhost",
    [string]$DbPort = "5432",
    [string]$DbName = "axiom_db",
    [string]$DbUser = "axiom",
    [string]$DbPassword = ""
)

if ($DbPassword -eq "") {
    $DbPassword = Read-Host "Enter database password" -AsSecureString
    $DbPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($DbPassword)
    )
}

Write-Host "=== Seeding Countries Data ===" -ForegroundColor Cyan
Write-Host ""

$TestDataFile = "testdata\countries.json"
if (-not (Test-Path $TestDataFile)) {
    Write-Host "ERROR: Test data not found: $TestDataFile" -ForegroundColor Red
    exit 1
}

$jsonData = Get-Content $TestDataFile -Raw | ConvertFrom-Json
$countries = $jsonData.data

Write-Host "Found $($countries.Count) countries to insert" -ForegroundColor Green
Write-Host ""

# Build SQL INSERT statements
$sqlStatements = @()
foreach ($country in $countries) {
    $sql = @"
INSERT INTO reference.countries (alpha2, alpha3, numeric, name_english, name_french, status)
VALUES ('$($country.alpha2)', '$($country.alpha3)', '$($country.numeric)', 
        '$($country.name_english -replace "'", "''")', '$($country.name_french -replace "'", "''")', 
        '$($country.status)')
ON CONFLICT (alpha2) DO UPDATE SET
    alpha3 = EXCLUDED.alpha3,
    numeric = EXCLUDED.numeric,
    name_english = EXCLUDED.name_english,
    name_french = EXCLUDED.name_french,
    status = EXCLUDED.status;
"@
    $sqlStatements += $sql
}

# Save to SQL file
$sqlFile = "seed_countries.sql"
$sqlStatements | Out-File -FilePath $sqlFile -Encoding UTF8
Write-Host "Generated SQL file: $sqlFile" -ForegroundColor Green

# Execute using psql if available
if (Get-Command psql -ErrorAction SilentlyContinue) {
    Write-Host "Executing SQL with psql..." -ForegroundColor Yellow
    $env:PGPASSWORD = $DbPassword
    psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -f $sqlFile
    $env:PGPASSWORD = ""
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Data seeded successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Verify with:" -ForegroundColor Yellow
        Write-Host "  SELECT COUNT(*) FROM reference.countries;" -ForegroundColor White
        Write-Host "  SELECT alpha2, name_english FROM reference.countries ORDER BY name_english LIMIT 10;" -ForegroundColor White
    } else {
        Write-Host "ERROR: Failed to execute SQL" -ForegroundColor Red
    }
} else {
    Write-Host ""
    Write-Host "psql not found. Run the SQL manually:" -ForegroundColor Yellow
    Write-Host "  psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -f $sqlFile" -ForegroundColor White
}

Write-Host ""
Write-Host "Seed script complete!" -ForegroundColor Green
