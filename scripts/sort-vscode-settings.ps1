param(
    [string]$SettingsPath = ".vscode/settings.json",
    [switch]$CheckOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Sort-JsonNode {
    param([object]$Node)

    if ($null -eq $Node) {
        return $null
    }

    if ($Node -is [System.Collections.IDictionary]) {
        $sorted = [ordered]@{}
        foreach ($key in ($Node.Keys | Sort-Object)) {
            $sorted[$key] = Sort-JsonNode -Node $Node[$key]
        }
        return $sorted
    }

    if (($Node -is [System.Collections.IEnumerable]) -and -not ($Node -is [string])) {
        $items = @()
        foreach ($item in $Node) {
            $items += ,(Sort-JsonNode -Node $item)
        }
        return $items
    }

    return $Node
}

if (-not (Test-Path -LiteralPath $SettingsPath)) {
    throw "Settings file not found: $SettingsPath"
}

$original = Get-Content -LiteralPath $SettingsPath -Raw

try {
    $parsed = $original | ConvertFrom-Json -AsHashtable
} catch {
    throw "Failed to parse $SettingsPath as JSON. Ensure it contains valid JSON before sorting. $($_.Exception.Message)"
}

$sorted = Sort-JsonNode -Node $parsed
$formatted = ($sorted | ConvertTo-Json -Depth 100) -replace "`r?`n", "`n"
if (-not $formatted.EndsWith("`n")) {
    $formatted += "`n"
}

$normalizedOriginal = $original -replace "`r`n", "`n"

if ($normalizedOriginal -ceq $formatted) {
    Write-Host "settings.json is already sorted."
    exit 0
}

if ($CheckOnly) {
    Write-Error "settings.json is not sorted. Run: pwsh ./scripts/sort-vscode-settings.ps1"
    exit 1
}

[System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $SettingsPath), $formatted, [System.Text.UTF8Encoding]::new($false))
Write-Host "Sorted $SettingsPath alphabetically."
