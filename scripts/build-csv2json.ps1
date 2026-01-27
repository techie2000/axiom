#!/usr/bin/env pwsh
# Build script for csv2json with automatic version injection
# Reads VERSION file and injects into Docker build

param(
    [switch]$UseGitTag,  # Use git tag instead of VERSION file
    [switch]$Local       # Build local binary instead of Docker image
)

$ErrorActionPreference = "Stop"

# Determine version
if ($UseGitTag) {
    # Try to get version from git tag
    $gitTag = git describe --tags --exact-match 2>$null
    if ($LASTEXITCODE -eq 0 -and $gitTag) {
        $VERSION = $gitTag -replace '^v', ''  # Remove 'v' prefix if present
        Write-Host "Using git tag version: $VERSION" -ForegroundColor Cyan
    } else {
        Write-Host "No git tag found, falling back to VERSION file" -ForegroundColor Yellow
        $VERSION = Get-Content "csv2json/VERSION" -Raw | ForEach-Object { $_.Trim() }
    }
} else {
    # Read from VERSION file
    $VERSION = Get-Content "csv2json/VERSION" -Raw | ForEach-Object { $_.Trim() }
    Write-Host "Using VERSION file: $VERSION" -ForegroundColor Cyan
}

if (-not $VERSION) {
    Write-Host "ERROR: Could not determine version" -ForegroundColor Red
    exit 1
}

if ($Local) {
    # Build local binary
    Write-Host "`nBuilding local csv2json binary (version $VERSION)..." -ForegroundColor Green
    
    Push-Location csv2json
    try {
        go build -ldflags "-X main.Version=$VERSION" -o ../bin/csv2json.exe .
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Local binary built: bin/csv2json.exe" -ForegroundColor Green
            
            # Verify version
            $output = & "..\bin\csv2json.exe" --version 2>&1
            if ($output -match $VERSION) {
                Write-Host "✓ Version verified: $VERSION" -ForegroundColor Green
            }
        } else {
            Write-Host "✗ Build failed" -ForegroundColor Red
            exit 1
        }
    } finally {
        Pop-Location
    }
} else {
    # Build Docker image
    Write-Host "`nBuilding csv2json Docker image (version $VERSION)..." -ForegroundColor Green
    
    docker compose build --build-arg VERSION=$VERSION csv2json
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Docker image built: axiom-csv2json:latest" -ForegroundColor Green
        Write-Host "  Version injected: $VERSION" -ForegroundColor Cyan
    } else {
        Write-Host "✗ Docker build failed" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Build complete: csv2json v$VERSION" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
