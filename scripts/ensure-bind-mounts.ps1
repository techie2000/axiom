#!/usr/bin/env pwsh
# ensure-bind-mounts.ps1
#
# Creates local bind-mount directories required by docker-compose for dev/main
# environments and, on Linux hosts (including WSL), fixes ownership to match
# the postgres user inside postgres:17-alpine (UID 70 / GID 70).
#
# Docker creates missing bind-mount directories as root on Linux, which causes
# Postgres to refuse to start with "data directory has wrong ownership".
# A temporary Alpine container is used for the chown so that no 'sudo' is
# required on the host.
#
# Usage:
#   .\scripts\ensure-bind-mounts.ps1 -Environment <dev|main>
#
# Examples:
#   .\scripts\ensure-bind-mounts.ps1 -Environment dev
#   .\scripts\ensure-bind-mounts.ps1 -Environment main

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("dev", "main")]
    [string]$Environment
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Write-Info    { param($msg) Write-Host "ℹ  $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "✓  $msg" -ForegroundColor Green }

$PostgresDir = ".\data\$Environment\postgres"
$LeiDir      = ".\data\$Environment\lei"
$LogDir      = ".\log\$Environment"

# ── Create directories if absent ─────────────────────────────────────────────
New-Item -ItemType Directory -Force -Path $PostgresDir | Out-Null
New-Item -ItemType Directory -Force -Path $LeiDir      | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir      | Out-Null

Write-Info "Ensured bind-mount directories for '$Environment':"
Write-Info "  postgres data : $PostgresDir"
Write-Info "  LEI data      : $LeiDir"
Write-Info "  logs          : $LogDir"

# ── Fix postgres ownership on Linux ──────────────────────────────────────────
# On macOS/Windows, Docker Desktop translates host-user ownership into the
# container automatically. On Linux (bare-metal or WSL), the bind-mount
# directory appears with root:root ownership, preventing Postgres (UID 70 in
# Alpine images) from initialising the data directory.
if ($IsLinux) {
    $PostgresDirAbs = (Resolve-Path $PostgresDir).Path
    Write-Info "Linux host detected — setting postgres data dir ownership to UID 70:70 via docker..."
    docker run --rm `
        -v "${PostgresDirAbs}:/target" `
        alpine:latest `
        sh -c "chown -R 70:70 /target && chmod 700 /target"
    if ($LASTEXITCODE -ne 0) {
        throw "docker run failed with exit code $LASTEXITCODE while setting ownership for '$PostgresDirAbs'"
    }
    Write-Success "Ownership of $PostgresDir set to 70:70 (postgres user in postgres:17-alpine)"
} else {
    Write-Info "Non-Linux host — Docker Desktop manages permissions, skipping chown."
}
