param(
  [Parameter(Mandatory = $true)]
  [string]$ApiBaseUrl,

  [string]$BearerToken,

  [string]$LocaleFile = "frontend/public/locales/en/common.json",

  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

function Get-FlattenedLocaleKeys {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Node,

    [string]$Prefix = ""
  )

  $keys = @()
  $props = $Node.PSObject.Properties
  foreach ($prop in $props) {
    $nextKey = if ([string]::IsNullOrEmpty($Prefix)) { $prop.Name } else { "$Prefix.$($prop.Name)" }

    if ($prop.Value -is [string]) {
      $keys += $nextKey
      continue
    }

    if ($prop.Value -is [pscustomobject]) {
      $keys += Get-FlattenedLocaleKeys -Node $prop.Value -Prefix $nextKey
    }
  }

  return $keys
}

if (-not (Test-Path $LocaleFile)) {
  throw "Locale file not found: $LocaleFile"
}

$localeJson = Get-Content -Raw -Path $LocaleFile | ConvertFrom-Json
$validKeys = Get-FlattenedLocaleKeys -Node $localeJson
$validKeySet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
foreach ($key in $validKeys) {
  [void]$validKeySet.Add($key)
}

$headers = @{}
if (-not [string]::IsNullOrWhiteSpace($BearerToken)) {
  $headers.Authorization = "Bearer $BearerToken"
}
$translationsUri = "$ApiBaseUrl/api/v1/translations?limit=5000&offset=0"
$translationResponse = Invoke-RestMethod -Method Get -Uri $translationsUri -Headers $headers
$records = @($translationResponse.records)

$stale = @()
foreach ($record in $records) {
  if (-not $validKeySet.Contains([string]$record.translation_key)) {
    $stale += $record
  }
}

Write-Host "Total translation rows: $($records.Count)"
Write-Host "Stale rows detected: $($stale.Count)"

if ($stale.Count -eq 0) {
  Write-Host "No stale translations to delete."
  exit 0
}

if ($WhatIf) {
  Write-Host "WhatIf enabled. Stale rows:"
  $stale | Select-Object id, translation_key, language_code, status | Format-Table -AutoSize
  exit 0
}

if ([string]::IsNullOrWhiteSpace($BearerToken)) {
  throw "BearerToken is required for delete mode. Use -WhatIf for dry-run without auth."
}

$deleted = 0
$failed = 0
foreach ($row in $stale) {
  $deleteUri = "$ApiBaseUrl/api/v1/translations/$($row.id)"
  try {
    Invoke-RestMethod -Method Delete -Uri $deleteUri -Headers $headers | Out-Null
    $deleted += 1
  }
  catch {
    $failed += 1
    Write-Warning "Failed to delete translation id=$($row.id) key=$($row.translation_key): $($_.Exception.Message)"
  }
}

Write-Host "Deleted stale translations: $deleted"
Write-Host "Failed deletions: $failed"

if ($failed -gt 0) {
  exit 1
}
