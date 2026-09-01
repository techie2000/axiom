#!/usr/bin/env pwsh
<#
.SYNOPSIS
Validates the multi-environment setup for Axiom.

.DESCRIPTION
Checks configuration files, docker-compose validity, port assignments, and
Makefile targets across all four environments (main, dev, uat, prod).

.EXAMPLE
./scripts/validate-multi-env.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "=========================================="
Write-Host "Axiom Multi-Environment Validation"
Write-Host "=========================================="
Write-Host ""

function Write-Success { param([string]$Msg) Write-Host "  [OK] $Msg" -ForegroundColor Green }
function Write-Fail    { param([string]$Msg) Write-Host "  [FAIL] $Msg" -ForegroundColor Red }

# ---------------------------------------------------------------------------
# 1. Required configuration files
# ---------------------------------------------------------------------------
Write-Host "1. Checking configuration files..."
$files = @('.env.main', '.env.dev', '.env.uat', '.env.prod',
           'docker-compose.main.yml', 'docker-compose.dev.yml',
           'docker-compose.uat.yml', 'docker-compose.prod.yml')

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Success "$file exists"
    } else {
        Write-Fail "$file missing"
        exit 1
    }
}
Write-Host ""

# ---------------------------------------------------------------------------
# 2. docker compose config validation
# ---------------------------------------------------------------------------
Write-Host "2. Validating docker-compose configurations..."
$envs = @('main', 'dev', 'uat', 'prod')
foreach ($env in $envs) {
    $null = & docker compose --env-file ".env.$env" -f "docker-compose.$env.yml" config 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "docker-compose.$env.yml is valid"
    } else {
        Write-Fail "docker-compose.$env.yml has errors"
        exit 1
    }
}
Write-Host ""

# ---------------------------------------------------------------------------
# 3. Port configuration checks
# ---------------------------------------------------------------------------
Write-Host "3. Validating port configurations..."

function Assert-Ports {
    param([string]$EnvFile, [string]$Label, [string]$Backend, [string]$Frontend, [string]$Postgres)

    $content = Get-Content $EnvFile -Raw
    if ($content -match "BACKEND_PORT=$Backend" -and
        $content -match "FRONTEND_PORT=$Frontend" -and
        $content -match "POSTGRES_PORT=$Postgres") {
        Write-Success "$Label ports correctly configured"
    } else {
        Write-Fail "$Label ports incorrectly configured"
        exit 1
    }
}

Assert-Ports '.env.main' 'Main branch (prefix: 4)'  '48080' '43000' '45432'
Assert-Ports '.env.dev'  'Development (prefix: 1)'  '18080' '13000' '15432'
Assert-Ports '.env.uat'  'UAT (prefix: 2)'          '28080' '23000' '25432'
Assert-Ports '.env.prod' 'Production (prefix: 3)'   '38080' '33000' '35432'

Write-Host ""

# ---------------------------------------------------------------------------
# 4. Makefile targets
# ---------------------------------------------------------------------------
Write-Host "4. Validating Makefile targets..."
$makefileContent = Get-Content Makefile -Raw
$targets = @('docker-main-up', 'docker-dev-up', 'docker-uat-up', 'docker-prod-up', 'docker-all-up')
foreach ($target in $targets) {
    if ($makefileContent -match "(?m)^${target}:") {
        Write-Success "Makefile target '$target' exists"
    } else {
        Write-Fail "Makefile target '$target' missing"
        exit 1
    }
}
Write-Host ""

Write-Host "=========================================="
Write-Host "All validation checks passed!" -ForegroundColor Green
Write-Host "=========================================="
Write-Host ""
