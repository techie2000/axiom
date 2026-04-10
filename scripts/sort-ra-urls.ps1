param(
    [string]$RaUrlsPath = "frontend/public/data/ra-urls.json",
    [switch]$CheckOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $RaUrlsPath)) {
    throw "RA URL file not found: $RaUrlsPath"
}

$original = Get-Content -LiteralPath $RaUrlsPath -Raw

try {
    $parsed = $original | ConvertFrom-Json -AsHashtable
} catch {
    throw "Failed to parse $RaUrlsPath as JSON. Ensure it contains valid JSON before sorting. $($_.Exception.Message)"
}

$sorted = [ordered]@{}

# Keep file-level comment pinned at top when present.
if ($parsed.ContainsKey("_comment")) {
    $sorted["_comment"] = $parsed["_comment"]
}

$raKeys = $parsed.Keys |
    Where-Object { $_ -ne "_comment" } |
    Sort-Object {
        if ($_ -is [string] -and $_ -match '^RA(\d+)$') {
            [int]$Matches[1]
        } else {
            [int]::MaxValue
        }
    }, { [string]$_ }
foreach ($key in $raKeys) {
    $sorted[$key] = $parsed[$key]
}

$formatted = ($sorted | ConvertTo-Json -Depth 100) -replace "`r?`n", "`n"
if (-not $formatted.EndsWith("`n")) {
    $formatted += "`n"
}

$normalizedOriginal = $original -replace "`r`n", "`n"

if ($normalizedOriginal -ceq $formatted) {
    Write-Host "ra-urls.json is already sorted."
    exit 0
}

if ($CheckOnly) {
    Write-Error "ra-urls.json is not sorted. Run: pwsh ./scripts/sort-ra-urls.ps1"
    exit 1
}

[System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $RaUrlsPath), $formatted, [System.Text.UTF8Encoding]::new($false))
Write-Host "Sorted $RaUrlsPath alphabetically by RA key."
