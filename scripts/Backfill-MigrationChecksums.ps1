<#
.SYNOPSIS
    Backfill checksums for already-applied migrations.

.DESCRIPTION
    Updates the schema_migrations table with checksums for migrations that were
    applied manually without checksum tracking. Useful for bringing legacy migrations
    up to the current tracking standard.

.PARAMETER MigrationsPath
    Path to the migrations directory. Default: modules/reference/migrations

.EXAMPLE
    .\scripts\Backfill-MigrationChecksums.ps1

.EXAMPLE
    .\scripts\Backfill-MigrationChecksums.ps1 -MigrationsPath .\modules\reference\migrations
#>

[CmdletBinding()]
param(
    [string]$MigrationsPath = "modules\reference\migrations"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Configuration
$ContainerName = "axiom-postgres"
$DatabaseName = "axiom_db"
$DatabaseUser = "axiom"
$env:PGPASSWORD = "localdev123"

function Get-FileChecksum {
    param([string]$FilePath)
    
    $hash = Get-FileHash -Path $FilePath -Algorithm SHA256
    return $hash.Hash.ToLower()
}

try {
    Write-Host "`n=== Backfill Migration Checksums ===" -ForegroundColor Cyan
    Write-Host "Migrations path: $MigrationsPath`n" -ForegroundColor Gray
    
    # Get all applied migrations with null checksums
    $query = "SELECT version FROM reference.schema_migrations WHERE checksum IS NULL ORDER BY version"
    $appliedMigrations = docker exec -i $ContainerName psql -U $DatabaseUser $DatabaseName -t -c $query
    
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to query applied migrations"
    }
    
    $migrationVersions = $appliedMigrations -split "`n" | Where-Object { $_.Trim() } | ForEach-Object { $_.Trim() }
    
    if ($migrationVersions.Count -eq 0) {
        Write-Host "✓ All migrations already have checksums" -ForegroundColor Green
        return
    }
    
    Write-Host "Found $($migrationVersions.Count) migrations without checksums:" -ForegroundColor Yellow
    $migrationVersions | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
    
    $updated = 0
    $notFound = 0
    
    Write-Host "`n💾 Processing..." -ForegroundColor Yellow
    
    foreach ($version in $migrationVersions) {
        # Find matching file
        $migrationFile = Get-ChildItem -Path $MigrationsPath -Filter "$version*.sql" -ErrorAction SilentlyContinue | Select-Object -First 1
        
        if (-not $migrationFile) {
            Write-Host "  ⚠️  $version - migration file not found" -ForegroundColor Yellow
            $notFound++
            continue
        }
        
        # Calculate checksum
        $checksum = Get-FileChecksum -FilePath $migrationFile.FullName
        
        # Update database
        $updateQuery = "UPDATE reference.schema_migrations SET checksum = '$checksum' WHERE version = '$version'"
        docker exec -i $ContainerName psql -U $DatabaseUser $DatabaseName -c $updateQuery | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ $version - checksum: $($checksum.Substring(0, 16))..." -ForegroundColor Green
            $updated++
        } else {
            Write-Host "  ❌ $version - failed to update" -ForegroundColor Red
        }
    }
    
    Write-Host "`n=== Summary ===" -ForegroundColor Cyan
    Write-Host "Updated: $updated" -ForegroundColor $(if ($updated -gt 0) { 'Green' } else { 'Gray' })
    Write-Host "Not found: $notFound" -ForegroundColor $(if ($notFound -gt 0) { 'Yellow' } else { 'Gray' })
    
    if ($updated -gt 0) {
        Write-Host "`n📊 Sample of updated records:" -ForegroundColor Cyan
        $query = "SELECT version, LEFT(checksum, 16) || '...' as checksum_preview, installed_on FROM reference.schema_migrations WHERE checksum IS NOT NULL ORDER BY installed_on DESC LIMIT 5"
        docker exec -i $ContainerName psql -U $DatabaseUser $DatabaseName -c $query
    }
    
    Write-Host "`n✓ Backfill complete" -ForegroundColor Green
    
} catch {
    Write-Host "`n❌ Backfill failed: $_" -ForegroundColor Red
    exit 1
}
