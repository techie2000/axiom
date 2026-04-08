#!/usr/bin/env pwsh

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateSet('patch', 'minor', 'major')]
    [string]$Part = 'patch',

    [string]$VersionFile = 'VERSION',

    [string]$GoVersionFile = 'backend/internal/version/version.go'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-ParsedVersion {
    param([string]$Value)

    if ($Value -notmatch '^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$') {
        throw "Version '$Value' is not valid semantic version text in MAJOR.MINOR.PATCH format."
    }

    return [pscustomobject]@{
        Major = [int]$Matches.major
        Minor = [int]$Matches.minor
        Patch = [int]$Matches.patch
    }
}

function Get-NextVersion {
    param(
        [int]$Major,
        [int]$Minor,
        [int]$Patch,
        [string]$Part
    )

    switch ($Part) {
        'major' {
            return '{0}.{1}.{2}' -f ($Major + 1), 0, 0
        }
        'minor' {
            return '{0}.{1}.{2}' -f $Major, ($Minor + 1), 0
        }
        'patch' {
            return '{0}.{1}.{2}' -f $Major, $Minor, ($Patch + 1)
        }
        default {
            throw "Unsupported version part '$Part'."
        }
    }
}

if (-not (Test-Path -LiteralPath $VersionFile)) {
    throw "Version file not found: $VersionFile"
}

if (-not (Test-Path -LiteralPath $GoVersionFile)) {
    throw "Go version file not found: $GoVersionFile"
}

$currentVersion = (Get-Content -LiteralPath $VersionFile -Raw).Trim()
$parsedVersion = Get-ParsedVersion -Value $currentVersion
$nextVersion = Get-NextVersion -Major $parsedVersion.Major -Minor $parsedVersion.Minor -Patch $parsedVersion.Patch -Part $Part

$versionGoContent = Get-Content -LiteralPath $GoVersionFile -Raw
$updatedVersionGoContent = [System.Text.RegularExpressions.Regex]::Replace(
    $versionGoContent,
    'const Version = "\d+\.\d+\.\d+"',
    ('const Version = "{0}"' -f $nextVersion),
    1
)

if ($updatedVersionGoContent -eq $versionGoContent) {
    throw "Failed to locate Version constant in $GoVersionFile"
}

if ($PSCmdlet.ShouldProcess((Resolve-Path -LiteralPath $VersionFile).Path, "Set version to $nextVersion")) {
    [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $VersionFile), "$nextVersion`n", [System.Text.UTF8Encoding]::new($false))
}

if ($PSCmdlet.ShouldProcess((Resolve-Path -LiteralPath $GoVersionFile).Path, "Set version to $nextVersion")) {
    [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $GoVersionFile), $updatedVersionGoContent, [System.Text.UTF8Encoding]::new($false))
}

Write-Host "Version bumped from $currentVersion to $nextVersion ($Part)."