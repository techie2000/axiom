#!/usr/bin/env pwsh
# Migration Runner for Axiom Reference Schema
# Runs pending SQL migrations against the PostgreSQL database

param(
    [string]$MigrationsPath = "./modules/reference/migrations",
    [string]$DBHost = "localhost",
    [string]$DBPort = "5433",
    [string]$DBName = "axiom_db",
    [string]$DBUser = "axiom",
    [string]$DBPassword = "changeme",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Axiom Database Migration Runner" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Set PGPASSWORD environment variable
$env:PGPASSWORD = $DBPassword

# Check if docker exec should be used
$useDocker = $false
if ($DBHost -eq "localhost" -and (docker ps --filter "name=axiom-postgres" --format "{{.Names}}" 2>$null) -eq "axiom-postgres") {
    $useDocker = $true
    Write-Host "✓ Using Docker container: axiom-postgres" -ForegroundColor Green
} else {
    Write-Host "✓ Using direct connection: ${DBHost}:${DBPort}" -ForegroundColor Green
}

# Function to execute SQL
function Invoke-SQL {
    param([string]$SQL, [string]$Description)
    
    if ($useDocker) {
        $result = docker exec axiom-postgres psql -U $DBUser -d $DBName -c $SQL 2>&1
    } else {
        $result = psql -h $DBHost -p $DBPort -U $DBUser -d $DBName -c $SQL 2>&1
    }
    
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed: $result"
    }
    
    return $result
}

# Function to execute SQL file
function Invoke-SQLFile {
    param([string]$FilePath)
    
    if ($useDocker) {
        # Copy file to container and execute
        docker cp $FilePath axiom-postgres:/tmp/migration.sql | Out-Null
        $result = docker exec axiom-postgres psql -U $DBUser -d $DBName -f /tmp/migration.sql 2>&1
        docker exec axiom-postgres rm /tmp/migration.sql | Out-Null
    } else {
        $result = psql -h $DBHost -p $DBPort -U $DBUser -d $DBName -f $FilePath 2>&1
    }
    
    if ($LASTEXITCODE -ne 0) {
        throw "Migration failed: $result"
    }
    
    return $result
}

# Ensure migration tracking table exists
Write-Host "Checking migration tracking table..." -ForegroundColor Yellow
$trackingSQL = @"
CREATE SCHEMA IF NOT EXISTS reference;
CREATE TABLE IF NOT EXISTS reference.schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    installed_by VARCHAR(100) DEFAULT CURRENT_USER,
    installed_on TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    execution_time_ms INTEGER,
    checksum VARCHAR(64)
);
"@

try {
    Invoke-SQL -SQL $trackingSQL -Description "Migration tracking setup" | Out-Null
    Write-Host "✓ Migration tracking table ready" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to create migration tracking table: $_" -ForegroundColor Red
    exit 1
}

# Get applied migrations
Write-Host "`nFetching applied migrations..." -ForegroundColor Yellow
$appliedMigrations = @{}
try {
    $result = Invoke-SQL -SQL "SELECT version FROM reference.schema_migrations ORDER BY version;" -Description "Get applied migrations"
    $result -split "`n" | Where-Object { $_ -match '^\s*\d{3}_' } | ForEach-Object {
        $version = $_.Trim()
        $appliedMigrations[$version] = $true
    }
    Write-Host "✓ Found $($appliedMigrations.Count) applied migrations" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to query applied migrations: $_" -ForegroundColor Red
    exit 1
}

# Get pending migrations
Write-Host "`nScanning for migration files..." -ForegroundColor Yellow
$migrationFiles = Get-ChildItem -Path $MigrationsPath -Filter "*.sql" | Sort-Object Name

if ($migrationFiles.Count -eq 0) {
    Write-Host "✗ No migration files found in $MigrationsPath" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Found $($migrationFiles.Count) migration files" -ForegroundColor Green

# Filter pending migrations
$pendingMigrations = $migrationFiles | Where-Object {
    $version = $_.BaseName
    -not $appliedMigrations.ContainsKey($version)
}

if ($pendingMigrations.Count -eq 0) {
    Write-Host "`n✓ Database is up to date - no pending migrations" -ForegroundColor Green
    exit 0
}

Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Pending Migrations: $($pendingMigrations.Count)" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

foreach ($migration in $pendingMigrations) {
    Write-Host "  • $($migration.BaseName)" -ForegroundColor White
}

if ($DryRun) {
    Write-Host "`n✓ Dry run complete - no changes made" -ForegroundColor Cyan
    exit 0
}

# Apply migrations
Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Applying Migrations" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

$successCount = 0
$failureCount = 0

foreach ($migration in $pendingMigrations) {
    Write-Host "`nApplying: $($migration.BaseName)..." -ForegroundColor Yellow
    
    $version = $migration.BaseName
    $description = ($version -replace '^\d{3}_', '') -replace '_', ' '
    
    # Calculate checksum
    $checksum = (Get-FileHash -Path $migration.FullName -Algorithm SHA256).Hash
    
    $startTime = Get-Date
    
    try {
        # Apply migration
        $result = Invoke-SQLFile -FilePath $migration.FullName
        
        $endTime = Get-Date
        $executionTime = [int](($endTime - $startTime).TotalMilliseconds)
        
        # Record migration
        $recordSQL = @"
INSERT INTO reference.schema_migrations (version, description, execution_time_ms, checksum)
VALUES ('$version', '$description', $executionTime, '$checksum');
"@
        Invoke-SQL -SQL $recordSQL -Description "Record migration" | Out-Null
        
        Write-Host "  ✓ Applied in ${executionTime}ms" -ForegroundColor Green
        $successCount++
        
    } catch {
        Write-Host "  ✗ Failed: $_" -ForegroundColor Red
        $failureCount++
        
        if ($migration.BaseName -notmatch '^000_') {
            Write-Host "`nStopping migration process due to error." -ForegroundColor Red
            break
        }
    }
}

Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Migration Summary" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Success: $successCount" -ForegroundColor Green
if ($failureCount -gt 0) {
    Write-Host "  Failed:  $failureCount" -ForegroundColor Red
}
Write-Host ""

if ($failureCount -eq 0) {
    Write-Host "✓ All migrations applied successfully!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "✗ Some migrations failed" -ForegroundColor Red
    exit 1
}
