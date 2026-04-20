#!/usr/bin/env pwsh
# upgrade-postgres.ps1
#
# Safely migrates PostgreSQL data when upgrading between major versions.
# Detects the current data version, backs it up, removes the old volume,
# starts the new PostgreSQL container and restores the backup automatically.
#
# Usage:
#   .\scripts\upgrade-postgres.ps1 -Environment <env> [-Yes]
#
# Parameters:
#   -Environment   One of: dev | uat | prod | main  (required)
#   -Yes           Skip the confirmation prompt
#
# Examples:
#   .\scripts\upgrade-postgres.ps1 -Environment dev
#   .\scripts\upgrade-postgres.ps1 -Environment prod -Yes

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("dev", "uat", "prod", "main")]
    [string]$Environment,

    [switch]$Yes
)

$ErrorActionPreference = "Stop"

$TargetPgVersion = 17
$BackupDir = ".\backups"

$gitCommonDir = ""
try {
    $gitCommonDir = (& git rev-parse --path-format=absolute --git-common-dir 2>$null).Trim()
} catch {
    $gitCommonDir = ""
}

if ([string]::IsNullOrEmpty($gitCommonDir)) {
    $root = Split-Path -Parent $PSScriptRoot
} else {
    $root = Split-Path -Parent $gitCommonDir
}
Set-Location $root

function Write-Info    { param($msg) Write-Host "ℹ  $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "✓  $msg" -ForegroundColor Green }
function Write-Warn    { param($msg) Write-Host "⚠  $msg" -ForegroundColor Yellow }
function Write-Fail    { param($msg) Write-Host "✗  $msg" -ForegroundColor Red; exit 1 }

# ── Config ────────────────────────────────────────────────────────────────────
$EnvFile     = ".env.$Environment"
$ComposeFile = "docker-compose.$Environment.yml"

if (-not (Test-Path $EnvFile))     { Write-Fail "Missing env file: $EnvFile" }
if (-not (Test-Path $ComposeFile)) { Write-Fail "Missing compose file: $ComposeFile" }

# Parse env file (skip blank lines and comments; strip inline comments)
$envMap = @{}
Get-Content $EnvFile | Where-Object { $_ -match '=' -and -not $_.Trim().StartsWith('#') } | ForEach-Object {
    $parts = $_ -split '=', 2
    if ($parts.Count -eq 2) {
        $key   = $parts[0].Trim()
        $value = ($parts[1] -split '#')[0].Trim()
        $envMap[$key] = $value
    }
}

$ProjectName = $envMap['COMPOSE_PROJECT_NAME']
$PgUser      = $envMap['POSTGRES_USER']
$PgPassword  = $envMap['POSTGRES_PASSWORD']
$PgDb        = $envMap['POSTGRES_DB']

if (-not $ProjectName) { Write-Fail "COMPOSE_PROJECT_NAME not set in $EnvFile" }
if (-not $PgUser)      { Write-Fail "POSTGRES_USER not set in $EnvFile" }
if (-not $PgPassword)  { Write-Fail "POSTGRES_PASSWORD not set in $EnvFile" }
if (-not $PgDb)        { Write-Fail "POSTGRES_DB not set in $EnvFile" }

$ContainerName   = "$ProjectName-postgres"
$VolumeName      = "${ProjectName}_postgres_data_${Environment}"
$PostgresDataDir = $envMap['POSTGRES_DATA_DIR']

# Determine storage type: bind mount (main/dev) vs named Docker volume (uat/prod).
# If POSTGRES_DATA_DIR is set in the env file the environment uses a host bind mount.
$UseBindMount = -not [string]::IsNullOrEmpty($PostgresDataDir)
if ($UseBindMount) {
    if ([System.IO.Path]::IsPathRooted($PostgresDataDir)) {
        $DataSrc = $PostgresDataDir
    } else {
        $relativeDataPath = $PostgresDataDir
        if ($relativeDataPath.StartsWith('./')) {
            $relativeDataPath = $relativeDataPath.Substring(2)
        }
        $DataSrc = Join-Path $root $relativeDataPath
    }
} else {
    $DataSrc = $VolumeName
}

# ── Header ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host " PostgreSQL Upgrade - $Environment"   -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Info "Project:   $ProjectName"
Write-Info "Container: $ContainerName"
if ($UseBindMount) {
    Write-Info "Data:      $DataSrc (bind mount)"
} else {
    Write-Info "Volume:    $VolumeName"
}
Write-Info "Target PG: $TargetPgVersion"
Write-Host ""

# ── Check data exists ─────────────────────────────────────────────────────────
if ($UseBindMount) {
    $dirEmpty = -not (Test-Path $DataSrc) -or
                (Get-ChildItem $DataSrc -Force -ErrorAction SilentlyContinue | Measure-Object).Count -eq 0
    if ($dirEmpty) {
        Write-Success "Bind-mount directory '$DataSrc' does not exist or is empty - no existing data to migrate."
        Write-Success "The postgres:${TargetPgVersion}-alpine container will initialise a fresh database on first start."
        exit 0
    }
} else {
    docker volume inspect $VolumeName 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Success "Volume '$VolumeName' does not exist - no existing data to migrate."
        Write-Success "The postgres:${TargetPgVersion}-alpine container will initialise a fresh database on first start."
        exit 0
    }
}

# ── Read PG_VERSION ───────────────────────────────────────────────────────────
if ($UseBindMount) {
    # For bind mounts the data directory is on the host, so we can read PG_VERSION directly.
    $pgVersionFile = Join-Path $DataSrc "PG_VERSION"
    if (Test-Path $pgVersionFile) {
        $CurrentPgVersion = (Get-Content $pgVersionFile -Raw).Trim()
    } else {
        $CurrentPgVersion = "unknown"
    }
} else {
    $CurrentPgVersion = docker run --rm `
        -v "${VolumeName}:/var/lib/postgresql/data" `
        alpine:latest `
        sh -c "cat /var/lib/postgresql/data/PG_VERSION 2>/dev/null || echo 'unknown'"
}

Write-Info "Detected data version: PostgreSQL $CurrentPgVersion"

if ($CurrentPgVersion -eq "$TargetPgVersion") {
    Write-Success "Data is already at PostgreSQL $TargetPgVersion - nothing to do."
    exit 0
}

if ($CurrentPgVersion -eq "unknown") {
    if ($UseBindMount) {
        Write-Warn "Could not read PG_VERSION from $DataSrc. The directory may be empty or uninitialised."
        Write-Warn "If so, you can remove it safely: Remove-Item -Recurse -Force '$DataSrc'"
    } else {
        Write-Warn "Could not read PG_VERSION from volume. The volume may be empty or uninitialised."
        Write-Warn "If so, you can remove it safely: docker volume rm $VolumeName"
    }
    exit 1
}

# ── Confirm ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Warn "PostgreSQL data upgrade required: v${CurrentPgVersion} -> v${TargetPgVersion}"
Write-Warn "This will:"
Write-Host "   1. Stop any running environment services"
Write-Host "   2. Back up all databases to ${BackupDir}\"
if ($UseBindMount) {
    Write-Host "   3. Rename the existing data directory to a timestamped backup"
} else {
    Write-Host "   3. Remove the existing volume ($VolumeName)"
}
Write-Host "   4. Start postgres:${TargetPgVersion}-alpine and restore the backup"
Write-Host ""

if (-not $Yes) {
    $confirm = Read-Host "Continue? [y/N]"
    if ($confirm -ne 'y' -and $confirm -ne 'Y') { Write-Host "Aborted."; exit 0 }
}

$TempContainer = "axiom-pg-upgrade-$PID"

# ── Step 1: Stop running environment ─────────────────────────────────────────
Write-Host ""
Write-Info "Step 1/5: Stopping any running services for '$Environment'..."
docker compose --env-file $EnvFile -f $ComposeFile down 2>&1 | Out-Null

# ── Step 2: Dump via temporary old-version container ─────────────────────────
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$Timestamp  = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "postgres-${Environment}-v${CurrentPgVersion}-${Timestamp}.sql"

# Clean up any previous leftover temp container with the same name
docker rm -f $TempContainer 2>&1 | Out-Null

Write-Info "Step 2/5: Starting temporary postgres:${CurrentPgVersion}-alpine container to take backup..."

# For bind mounts docker requires an absolute path; resolve it from the host working directory.
if ($UseBindMount) {
    try {
        $DataAbs = (Resolve-Path $DataSrc -ErrorAction Stop).Path
    } catch {
        Write-Fail "Cannot resolve bind-mount path '$DataSrc': $_"
    }
    $MountArg = "${DataAbs}:/var/lib/postgresql/data"
} else {
    $MountArg = "${VolumeName}:/var/lib/postgresql/data"
}

docker run -d `
    --name $TempContainer `
    -e POSTGRES_USER=$PgUser `
    -e POSTGRES_PASSWORD=$PgPassword `
    -e POSTGRES_DB=$PgDb `
    -e PGDATA=/var/lib/postgresql/data `
    -v $MountArg `
    "postgres:${CurrentPgVersion}-alpine" | Out-Null

Write-Info "Waiting for temporary container to be ready..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    docker exec $TempContainer pg_isready -U $PgUser 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ready) {
    docker rm -f $TempContainer 2>&1 | Out-Null
    Write-Fail "Temporary postgres:${CurrentPgVersion} container did not become ready. Check: docker logs $TempContainer"
}

Write-Info "Dumping all databases to $BackupFile..."
# Stream output directly to disk to avoid buffering large backups in memory.
# Use --clean --if-exists so restore is idempotent and does not fail on pre-created roles/databases.
docker exec -e "PGPASSWORD=$PgPassword" $TempContainer pg_dumpall --clean --if-exists -U $PgUser > $BackupFile
$dumpExitCode = $LASTEXITCODE

if ($dumpExitCode -ne 0) {
    docker rm -f $TempContainer 2>&1 | Out-Null
    Write-Fail "Database backup failed while running pg_dumpall."
}

docker rm -f $TempContainer | Out-Null

$sizeKB = [math]::Round((Get-Item $BackupFile).Length / 1KB, 0)
Write-Success "Backup saved: $BackupFile ($sizeKB KB)"

# ── Step 3: Remove or rename old data ────────────────────────────────────────
if ($UseBindMount) {
    $BakDir = "${DataSrc}.bak.${Timestamp}"
    Write-Info "Step 3/5: Renaming data directory to $BakDir..."
    try {
        Move-Item $DataSrc $BakDir -ErrorAction Stop
    } catch {
        Write-Fail "Failed to rename '$DataSrc' to '$BakDir' — check permissions and disk space, then retry. Error: $_"
    }
    Write-Success "Data directory backed up to: $BakDir"
} else {
    Write-Info "Step 3/5: Removing old volume ($VolumeName)..."
    docker volume rm $VolumeName | Out-Null
    Write-Success "Old volume removed."
}

# ── Step 4: Start new postgres (v17) ─────────────────────────────────────────
Write-Info "Step 4/5: Starting postgres:${TargetPgVersion}-alpine..."
docker compose --env-file $EnvFile -f $ComposeFile up -d postgres | Out-Null

Write-Info "Waiting for postgres:${TargetPgVersion} to be ready..."
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    docker exec $ContainerName pg_isready -U $PgUser 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ready) {
    Write-Fail "New postgres:${TargetPgVersion} container did not become ready. Check: docker logs $ContainerName"
}

# ── Step 5: Restore backup ────────────────────────────────────────────────────
Write-Info "Step 5/5: Restoring backup into postgres:${TargetPgVersion}..."
$absBackup = (Get-Item $BackupFile).FullName
docker cp $absBackup "${ContainerName}:/tmp/restore.sql"
$env:PGPASSWORD = $PgPassword
docker exec $ContainerName sh -c "PGPASSWORD='${PgPassword}' psql -U '${PgUser}' -d postgres -f /tmp/restore.sql"
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
docker exec $ContainerName rm /tmp/restore.sql

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host " PostgreSQL upgrade complete!"         -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Success "Data migrated: v${CurrentPgVersion} -> v${TargetPgVersion}"
Write-Success "SQL backup retained at: $BackupFile"
if ($UseBindMount) {
    Write-Success "Old data directory backed up to: ${DataSrc}.bak.${Timestamp}"
}
Write-Host ""
Write-Info "Start the full environment with:"
Write-Host "   docker compose --env-file $EnvFile -f $ComposeFile up -d"
Write-Host "  or:"
Write-Host "   make docker-${Environment}-up"
Write-Host ""
