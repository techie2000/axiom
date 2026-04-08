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

function New-TempPathFor {
    param([string]$Path)

    $directory = Split-Path -Path $Path -Parent
    $fileName = [System.IO.Path]::GetFileName($Path)
    return Join-Path $directory (".{0}.{1}.tmp" -f $fileName, [System.Guid]::NewGuid().ToString('N'))
}

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

$versionFileContent = Get-Content -LiteralPath $VersionFile -Raw
$currentVersion = $versionFileContent.Trim()
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

$versionPath = (Resolve-Path -LiteralPath $VersionFile).Path
$goVersionPath = (Resolve-Path -LiteralPath $GoVersionFile).Path
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$updatedAnyFile = $false
$versionTempPath = New-TempPathFor -Path $versionPath
$goVersionTempPath = New-TempPathFor -Path $goVersionPath

if ($PSCmdlet.ShouldProcess("$versionPath and $goVersionPath", "Set version to $nextVersion")) {
    try {
        [System.IO.File]::WriteAllText($versionTempPath, "$nextVersion`n", $utf8NoBom)
        [System.IO.File]::WriteAllText($goVersionTempPath, $updatedVersionGoContent, $utf8NoBom)

        $versionUpdated = $false
        $goVersionUpdated = $false

        try {
            Move-Item -LiteralPath $versionTempPath -Destination $versionPath -Force
            $versionUpdated = $true

            Move-Item -LiteralPath $goVersionTempPath -Destination $goVersionPath -Force
            $goVersionUpdated = $true
            $updatedAnyFile = $true
        }
        catch {
            if ($versionUpdated -and -not $goVersionUpdated) {
                [System.IO.File]::WriteAllText($versionPath, $versionFileContent, $utf8NoBom)
            }

            throw
        }
    }
    finally {
        if (Test-Path -LiteralPath $versionTempPath) {
            Remove-Item -LiteralPath $versionTempPath -Force
        }

        if (Test-Path -LiteralPath $goVersionTempPath) {
            Remove-Item -LiteralPath $goVersionTempPath -Force
        }
    }
}

if ($updatedAnyFile) {
    Write-Host "Version bumped from $currentVersion to $nextVersion ($Part)."
}
elseif ($WhatIfPreference) {
    Write-Host "WhatIf: version would be bumped from $currentVersion to $nextVersion ($Part)."
}
else {
    Write-Host "Version was not bumped because no files were updated."
}