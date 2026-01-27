#!/usr/bin/env pwsh
# Build all Axiom services with version injection
# Reads VERSION files and orchestrates multi-service builds

param(
    [ValidateSet("all", "csv2json", "canonicalizer")]
    [string]$Service = "all",
    
    [switch]$UseGitTag,  # Use git tag instead of VERSION files
    [switch]$Local       # Build local binaries instead of Docker images
)

$ErrorActionPreference = "Stop"

# Display banner
Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Axiom Build System" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# Get project version
$PROJECT_VERSION = Get-Content "VERSION" -Raw | ForEach-Object { $_.Trim() }
Write-Host "Axiom Project Version: $PROJECT_VERSION`n" -ForegroundColor Yellow

$buildResults = @()

# Build csv2json
if ($Service -eq "all" -or $Service -eq "csv2json") {
    Write-Host "═══ Building csv2json ═══" -ForegroundColor Cyan
    
    $params = @()
    if ($UseGitTag) { $params += "-UseGitTag" }
    if ($Local) { $params += "-Local" }
    
    try {
        & .\scripts\build-csv2json.ps1 @params
        $buildResults += @{ Service = "csv2json"; Status = "✓ Success"; Color = "Green" }
    } catch {
        $buildResults += @{ Service = "csv2json"; Status = "✗ Failed"; Color = "Red" }
        Write-Host "`nError building csv2json: $_" -ForegroundColor Red
    }
    
    Write-Host ""
}

# Build canonicalizer
if ($Service -eq "all" -or $Service -eq "canonicalizer") {
    Write-Host "═══ Building canonicalizer ═══" -ForegroundColor Cyan
    
    $params = @()
    if ($UseGitTag) { $params += "-UseGitTag" }
    if ($Local) { $params += "-Local" }
    
    try {
        & .\scripts\build-canonicalizer.ps1 @params
        $buildResults += @{ Service = "canonicalizer"; Status = "✓ Success"; Color = "Green" }
    } catch {
        $buildResults += @{ Service = "canonicalizer"; Status = "✗ Failed"; Color = "Red" }
        Write-Host "`nError building canonicalizer: $_" -ForegroundColor Red
    }
    
    Write-Host ""
}

# Display summary
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Build Summary" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

foreach ($result in $buildResults) {
    Write-Host "  $($result.Service): $($result.Status)" -ForegroundColor $result.Color
}

Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# Exit with error if any builds failed
$failedCount = ($buildResults | Where-Object { $_.Status -match "Failed" }).Count
if ($failedCount -gt 0) {
    Write-Host "Build completed with $failedCount failure(s)" -ForegroundColor Red
    exit 1
} else {
    Write-Host "All builds completed successfully!" -ForegroundColor Green
}
