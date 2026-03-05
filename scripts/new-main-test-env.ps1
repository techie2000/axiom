#!/usr/bin/env pwsh
<#!
.SYNOPSIS
Creates an isolated .env file for a temporary main-like test stack.

.DESCRIPTION
Copies values from .env.main (or another source env file) and rewrites
project/port/database fields so the test stack cannot collide with the real
main stack. This prevents accidental volume/container reuse and avoids data
loss from destructive commands on the shared project name.

.PARAMETER Name
Suffix used in COMPOSE_PROJECT_NAME and DB names.
Example: Name=pr107 => COMPOSE_PROJECT_NAME=axiom-main-pr107

.PARAMETER SourceEnvFile
Source env file to copy from. Defaults to .env.main in workspace root.

.PARAMETER OutputEnvFile
Destination env file path. Defaults to .env.main.<Name> in workspace root.

.PARAMETER PortOffset
Offset applied to main ports so test stack uses unique host ports.
Defaults to 100.

.EXAMPLE
./scripts/new-main-test-env.ps1 -Name pr107

.EXAMPLE
./scripts/new-main-test-env.ps1 -Name pr108 -PortOffset 200

.EXAMPLE
./scripts/new-main-test-env.ps1 -Name hotfix -OutputEnvFile .env.main.hotfix
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-zA-Z0-9-]+$')]
    [string]$Name,

    [string]$SourceEnvFile = '.env.main',
    [string]$OutputEnvFile,

    [ValidateRange(1, 5000)]
    [int]$PortOffset = 100
)

$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
Set-Location $workspaceRoot

if (-not (Test-Path $SourceEnvFile)) {
    throw "Source env file not found: $SourceEnvFile"
}

if (-not $OutputEnvFile) {
    $OutputEnvFile = ".env.main.$Name"
}

$lines = Get-Content -Path $SourceEnvFile

function Replace-Or-AddSetting {
    param(
        [string[]]$InputLines,
        [string]$Key,
        [string]$Value
    )

    $pattern = "^\s*" + [regex]::Escape($Key) + "="
    $found = $false
    $output = foreach ($line in $InputLines) {
        if ($line -match $pattern) {
            $found = $true
            "$Key=$Value"
        }
        else {
            $line
        }
    }

    if (-not $found) {
        $output += "$Key=$Value"
    }

    return ,$output
}

function Get-EnvValue {
    param(
        [string[]]$InputLines,
        [string]$Key
    )

    $match = $InputLines | Where-Object { $_ -match "^\s*$([regex]::Escape($Key))=" } | Select-Object -First 1
    if (-not $match) { return $null }
    return ($match -split '=', 2)[1].Trim()
}

$portKeys = @('POSTGRES_PORT', 'RABBITMQ_PORT', 'RABBITMQ_MGMT_PORT', 'BACKEND_PORT', 'FRONTEND_PORT')

$composeName = "axiom-main-$Name"
$envName = "main-$Name"
$dbName = "axiom_main_$($Name -replace '-', '_')"

$lines = Replace-Or-AddSetting -InputLines $lines -Key 'COMPOSE_PROJECT_NAME' -Value $composeName
$lines = Replace-Or-AddSetting -InputLines $lines -Key 'ENVIRONMENT' -Value $envName
$lines = Replace-Or-AddSetting -InputLines $lines -Key 'POSTGRES_DB' -Value $dbName
$lines = Replace-Or-AddSetting -InputLines $lines -Key 'DATABASE_NAME' -Value $dbName
$lines = Replace-Or-AddSetting -InputLines $lines -Key 'NEXT_PUBLIC_ENVIRONMENT' -Value $envName

foreach ($key in $portKeys) {
    $current = Get-EnvValue -InputLines $lines -Key $key
    if ($current -and $current -match '^\d+$') {
        $newPort = [int]$current + $PortOffset
        $lines = Replace-Or-AddSetting -InputLines $lines -Key $key -Value $newPort
    }
}

$backendPort = Get-EnvValue -InputLines $lines -Key 'BACKEND_PORT'
if ($backendPort -and $backendPort -match '^\d+$') {
    $lines = Replace-Or-AddSetting -InputLines $lines -Key 'NEXT_PUBLIC_API_URL' -Value "http://localhost:$backendPort"
}

Set-Content -Path $OutputEnvFile -Value $lines -NoNewline:$false

Write-Host "Created isolated env file: $OutputEnvFile" -ForegroundColor Green
Write-Host "COMPOSE_PROJECT_NAME=$composeName"
Write-Host "POSTGRES_DB=$dbName"
Write-Host "Port offset applied: +$PortOffset"
Write-Host ""
Write-Host "Use it with:" -ForegroundColor Cyan
Write-Host "docker compose --env-file $OutputEnvFile -f docker-compose.main.yml up -d --build"
Write-Host "docker compose --env-file $OutputEnvFile -f docker-compose.main.yml down"
Write-Host ""
Write-Host "Avoid using '-v' unless you intentionally want to destroy this test stack's data." -ForegroundColor Yellow
