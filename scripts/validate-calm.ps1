#!/usr/bin/env pwsh
<#
.SYNOPSIS
Validates all CALM architecture model files found under docs/architecture-as-code/models/.

.DESCRIPTION
Runs `npx @finos/calm-cli validate` against every *.architecture.json file.
Exits 1 (or warns and exits 0 with --warn) if any model fails validation.

.PARAMETER Warn
Treat validation failures as warnings and exit 0 instead of failing.

.EXAMPLE
./scripts/validate-calm.ps1

.EXAMPLE
./scripts/validate-calm.ps1 -Warn
#>

[CmdletBinding()]
param(
    [switch]$Warn
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ModelGlob = 'docs/architecture-as-code/models/*.architecture.json'
$models = Get-ChildItem -Path $ModelGlob -ErrorAction SilentlyContinue

if ($null -eq $models -or $models.Count -eq 0) {
    Write-Host "No CALM model files found at $ModelGlob"
    exit 0
}

$errors = 0

foreach ($model in $models) {
    Write-Host "Validating CALM model: $($model.FullName)"
    & npx --yes @finos/calm-cli validate -a "$($model.FullName)"
    if ($LASTEXITCODE -ne 0) {
        $errors++
    }
}

if ($errors -gt 0) {
    if ($Warn) {
        Write-Host "WARN: CALM validation reported $errors failing model(s); continuing in warn mode."
        exit 0
    }

    Write-Host "ERROR: CALM validation failed for $errors model(s)."
    exit 1
}

Write-Host "CALM validation passed for all model files."
