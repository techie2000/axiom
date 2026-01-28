<#
.SYNOPSIS
    Apply a database migration with proper tracking (execution time and checksum).

.DESCRIPTION
    Applies a SQL migration file to the PostgreSQL database and records:
    - Version (from filename)
    - Description (from migration file header)
    - Execution time in milliseconds
    - SHA-256 checksum of the migration file
    - Installed by (current user)
    - Installed on (timestamp)

.PARAMETER MigrationFile
    Path to the migration SQL file (e.g., migrations/020_add_some_feature.sql)

.PARAMETER DryRun
    If specified, shows what would be done without applying the migration.

.EXAMPLE
    .\scripts\Apply-Migration.ps1 -MigrationFile .\modules\reference\migrations\020_some_migration.sql

.EXAMPLE
    .\scripts\Apply-Migration.ps1 -MigrationFile .\modules\reference\migrations\020_some_migration.sql -DryRun
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$MigrationFile,
    
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Configuration
$ContainerName = "axiom-postgres"
$DatabaseName = "axiom_db"
$DatabaseUser = "axiom"
$env:PGPASSWORD = "localdev123"

function Get-MigrationVersion {
    param([string]$FilePath)
    
    $fileName = Split-Path -Leaf $FilePath
    if ($fileName -match '^(\d{3}_[^\.]+)') {
        return $matches[1]
    }
    throw "Migration filename must start with NNN_description format: $fileName"
}

function Get-MigrationDescription {
    param([string]$FilePath)
    
    $content = Get-Content $FilePath -Raw
    if ($content -match '(?m)^--\s*Description:\s*(.+)$') {
        return $matches[1].Trim()
    }
    if ($content -match '(?m)^--\s*Migration:\s*\d+:\s*(.+)$') {
        return $matches[1].Trim()
    }
    # Fallback: extract from filename
    $fileName = Split-Path -Leaf $FilePath
    if ($fileName -match '^\d{3}_(.+)\.(sql|up\.sql|down\.sql)$') {
        return $matches[1] -replace '_', ' '
    }
    return "No description provided"
}

function Get-FileChecksum {
    param([string]$FilePath)
    
    $hash = Get-FileHash -Path $FilePath -Algorithm SHA256
    return $hash.Hash.ToLower()
}

function Test-MigrationApplied {
    param([string]$Version)
    
    $query = "SELECT COUNT(*) FROM reference.schema_migrations WHERE version = '$Version'"
    $result = docker exec -i $ContainerName psql -U $DatabaseUser $DatabaseName -t -c $query 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to check migration status: $result"
    }
    
    return [int]$result.Trim() -gt 0
}

# Main script
try {
    Write-Host "`n=== Migration Application Tool ===" -ForegroundColor Cyan
    Write-Host "File: $MigrationFile`n" -ForegroundColor Gray
    
    # Validate file exists
    if (-not (Test-Path $MigrationFile)) {
        throw "Migration file not found: $MigrationFile"
    }
    
    # Extract metadata
    $version = Get-MigrationVersion -FilePath $MigrationFile
    $description = Get-MigrationDescription -FilePath $MigrationFile
    $checksum = Get-FileChecksum -FilePath $MigrationFile
    
    Write-Host "📋 Migration Details:" -ForegroundColor Yellow
    Write-Host "  Version: $version" -ForegroundColor Gray
    Write-Host "  Description: $description" -ForegroundColor Gray
    Write-Host "  Checksum: $checksum" -ForegroundColor Gray
    
    # Check if already applied
    $isApplied = Test-MigrationApplied -Version $version
    if ($isApplied) {
        Write-Host "`n⚠️  Migration already applied!" -ForegroundColor Yellow
        
        # Show existing record
        $query = "SELECT version, description, installed_by, installed_on, execution_time_ms, checksum FROM reference.schema_migrations WHERE version = '$version'"
        Write-Host "`n📊 Existing record:" -ForegroundColor Cyan
        docker exec -i $ContainerName psql -U $DatabaseUser $DatabaseName -c $query
        
        return
    }
    
    if ($DryRun) {
        Write-Host "`n🔍 DRY RUN - Would apply migration" -ForegroundColor Yellow
        Write-Host "  SQL would be executed from: $MigrationFile" -ForegroundColor Gray
        Write-Host "  Migration record would be created with:" -ForegroundColor Gray
        Write-Host "    - Version: $version" -ForegroundColor Gray
        Write-Host "    - Description: $description" -ForegroundColor Gray
        Write-Host "    - Checksum: $checksum" -ForegroundColor Gray
        return
    }
    
    # Read migration SQL (exclude the INSERT INTO schema_migrations if present)
    $migrationSql = Get-Content $MigrationFile -Raw
    $migrationSql = $migrationSql -replace '(?ms)^-- Record migration.*?ON CONFLICT.*?;', ''
    
    Write-Host "`n💾 Applying migration..." -ForegroundColor Yellow
    
    # Start timing
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    
    # Apply migration
    $migrationSql | docker exec -i $ContainerName psql -U $DatabaseUser $DatabaseName 2>&1 | ForEach-Object {
        if ($_ -match 'ERROR:') {
            Write-Host "  $_" -ForegroundColor Red
        } elseif ($_ -match 'NOTICE:') {
            Write-Host "  $_" -ForegroundColor Yellow
        } else {
            Write-Host "  $_" -ForegroundColor Gray
        }
    }
    
    if ($LASTEXITCODE -ne 0) {
        $stopwatch.Stop()
        throw "Migration failed with exit code $LASTEXITCODE"
    }
    
    $stopwatch.Stop()
    $executionTimeMs = [int]$stopwatch.ElapsedMilliseconds
    
    Write-Host "  ✓ Migration applied in $executionTimeMs ms" -ForegroundColor Green
    
    # Record migration with all metadata
    Write-Host "`n📝 Recording migration..." -ForegroundColor Yellow
    
    $recordQuery = @"
INSERT INTO reference.schema_migrations (version, description, execution_time_ms, checksum)
VALUES ('$version', '$description', $executionTimeMs, '$checksum')
ON CONFLICT (version) DO UPDATE 
SET execution_time_ms = EXCLUDED.execution_time_ms,
    checksum = EXCLUDED.checksum;
"@
    
    docker exec -i $ContainerName psql -U $DatabaseUser $DatabaseName -c $recordQuery
    
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to record migration"
    }
    
    Write-Host "  ✓ Migration recorded" -ForegroundColor Green
    
    # Show summary
    Write-Host "`n📊 Migration Summary:" -ForegroundColor Cyan
    $query = "SELECT version, description, installed_by, installed_on, execution_time_ms, checksum FROM reference.schema_migrations WHERE version = '$version'"
    docker exec -i $ContainerName psql -U $DatabaseUser $DatabaseName -c $query
    
    Write-Host "`n✓ Migration completed successfully" -ForegroundColor Green
    
} catch {
    Write-Host "`n❌ Migration failed: $_" -ForegroundColor Red
    exit 1
}
