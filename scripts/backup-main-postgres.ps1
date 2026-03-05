#!/usr/bin/env pwsh
<#!
.SYNOPSIS
Creates a timestamped backup of the running main PostgreSQL database.

.DESCRIPTION
Reads .env.main (or a provided env file), discovers the postgres container
name from COMPOSE_PROJECT_NAME, and runs pg_dump inside the container.
The backup is copied to backups/main/postgres by default.

.PARAMETER EnvFile
Env file with COMPOSE_PROJECT_NAME, POSTGRES_USER, and POSTGRES_DB.
Defaults to .env.main.

.PARAMETER OutputDir
Directory where backup files are written.
Defaults to backups/main/postgres.

.PARAMETER Format
Backup format: custom (pg_dump -Fc) or plain (SQL text).
Defaults to custom.

.EXAMPLE
./scripts/backup-main-postgres.ps1

.EXAMPLE
./scripts/backup-main-postgres.ps1 -Format plain

.EXAMPLE
./scripts/backup-main-postgres.ps1 -EnvFile .env.main.pr107 -OutputDir backups/main/postgres/pr107
#>

[CmdletBinding()]
param(
    [string]$EnvFile = '.env.main',
    [string]$OutputDir = 'backups/main/postgres',

    [ValidateSet('custom', 'plain')]
    [string]$Format = 'custom'
)

$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
Set-Location $workspaceRoot

if (-not (Test-Path $EnvFile)) {
    throw "Env file not found: $EnvFile"
}

$envMap = @{}
foreach ($line in Get-Content $EnvFile) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $trimmed = $line.Trim()
    if ($trimmed.StartsWith('#')) { continue }
    if ($trimmed -notmatch '=') { continue }
    $parts = $trimmed.Split('=', 2)
    $envMap[$parts[0].Trim()] = $parts[1].Trim()
}

$composeProject = $envMap['COMPOSE_PROJECT_NAME']
$dbUser = $envMap['POSTGRES_USER']
$dbName = $envMap['POSTGRES_DB']

if (-not $composeProject -or -not $dbUser -or -not $dbName) {
    throw "Missing one or more required settings in ${EnvFile}: COMPOSE_PROJECT_NAME, POSTGRES_USER, POSTGRES_DB"
}

$containerName = "$composeProject-postgres"

$running = docker ps --format '{{.Names}}' | Where-Object { $_ -eq $containerName }
if (-not $running) {
    throw "Postgres container is not running: $containerName"
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$extension = if ($Format -eq 'custom') { 'dump' } else { 'sql' }
$fileName = "$composeProject-$dbName-$timestamp.$extension"
$hostPath = Join-Path $OutputDir $fileName
$containerPath = "/tmp/$fileName"

if ($Format -eq 'custom') {
    docker exec $containerName pg_dump -U $dbUser -d $dbName -F c -f $containerPath
}
else {
    docker exec $containerName sh -c "pg_dump -U $dbUser -d $dbName > $containerPath"
}

try {
    docker cp "$containerName`:$containerPath" $hostPath
}
finally {
    docker exec $containerName rm -f $containerPath | Out-Null
}

$size = (Get-Item $hostPath).Length
Write-Host "Backup created: $hostPath" -ForegroundColor Green
Write-Host "Size: $size bytes"
Write-Host ""

if ($Format -eq 'custom') {
    Write-Host "Restore example:" -ForegroundColor Cyan
    Write-Host "docker cp $hostPath $containerName`:/tmp/$fileName"
    Write-Host "docker exec -it $containerName pg_restore -U $dbUser -d $dbName --clean --if-exists /tmp/$fileName"
}
else {
    Write-Host "Restore example:" -ForegroundColor Cyan
    Write-Host "docker cp $hostPath $containerName`:/tmp/$fileName"
    Write-Host "docker exec -i $containerName psql -U $dbUser -d $dbName -f /tmp/$fileName"
}
