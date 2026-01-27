#!/usr/bin/env pwsh
# Test script for the complete country data ingestion pipeline
# CSV → csv2json → RabbitMQ → canonicalizer → PostgreSQL

param(
    [string]$CsvFile = "C:\Users\mb53535\AppData\Local\Temp\countries.csv",
    [string]$RabbitMQHost = "localhost",
    [string]$RabbitMQQueue = "axiom.reference.countries"
)

Write-Host "=== Axiom Countries Pipeline Test ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Convert CSV to JSON using csv2json
Write-Host "[1/4] Converting CSV to JSON..." -ForegroundColor Yellow
if (-not (Test-Path $CsvFile)) {
    Write-Host "ERROR: CSV file not found: $CsvFile" -ForegroundColor Red
    exit 1
}

# Assuming csv2json is available in PATH or ../../../csv2json/
$JsonOutput = "countries_output.json"
# TODO: Replace with actual csv2json command
Write-Host "  csv2json --input $CsvFile --output $JsonOutput --domain reference --entity countries"
Write-Host "  (csv2json command needs to be run manually)" -ForegroundColor Gray
Write-Host ""

# Step 2: Publish JSON to RabbitMQ
Write-Host "[2/4] Publishing messages to RabbitMQ queue: $RabbitMQQueue" -ForegroundColor Yellow
Write-Host "  Using testdata/countries.json as sample data" -ForegroundColor Gray
$TestDataFile = "testdata\countries.json"

if (Test-Path $TestDataFile) {
    $jsonData = Get-Content $TestDataFile -Raw | ConvertFrom-Json
    Write-Host "  Found $($jsonData.data.Count) countries in test data" -ForegroundColor Green
    
    # TODO: Publish to RabbitMQ using canonicalizer or direct RabbitMQ client
    Write-Host "  Publishing to RabbitMQ..." -ForegroundColor Gray
    Write-Host "  (Manual RabbitMQ publish required - see below)" -ForegroundColor Gray
} else {
    Write-Host "  Test data not found: $TestDataFile" -ForegroundColor Red
}
Write-Host ""

# Step 3: Monitor canonicalizer processing
Write-Host "[3/4] Monitoring canonicalizer processing..." -ForegroundColor Yellow
Write-Host "  Ensure canonicalizer service is running" -ForegroundColor Gray
Write-Host "  Canonicalizer should dequeue messages and write to PostgreSQL" -ForegroundColor Gray
Write-Host ""

# Step 4: Verify data in PostgreSQL
Write-Host "[4/4] Verifying data in PostgreSQL..." -ForegroundColor Yellow
Write-Host "  Run this query to check inserted data:" -ForegroundColor Gray
Write-Host "  SELECT alpha2, alpha3, name_english FROM reference.countries ORDER BY name_english;" -ForegroundColor White
Write-Host ""

# Alternative: Use the countries service HTTP API
Write-Host "=== Alternative: Test via Countries Service API ===" -ForegroundColor Cyan
Write-Host "If the countries service is running, you can check via HTTP:" -ForegroundColor Gray
Write-Host "  curl http://localhost:8080/health" -ForegroundColor White
Write-Host "  curl http://localhost:8080/ready" -ForegroundColor White
Write-Host "  curl http://localhost:8080/countries" -ForegroundColor White
Write-Host ""

Write-Host "=== Manual Steps Required ===" -ForegroundColor Yellow
Write-Host "1. Run csv2json to convert CSV to JSON messages"
Write-Host "2. Publish JSON messages to RabbitMQ (axiom.reference.countries queue)"
Write-Host "3. Start canonicalizer service to process queue"
Write-Host "4. Start countries service to consume processed data"
Write-Host "5. Verify data via HTTP API or direct PostgreSQL query"
Write-Host ""

Write-Host "Test script complete!" -ForegroundColor Green
