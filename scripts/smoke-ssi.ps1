#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    # Smoke scope intentionally excludes main branch environment.
    [ValidateSet('dev', 'uat', 'prod')]
    [string]$Environment = 'dev',

    [string]$ApiBaseUrl,

    [switch]$SeedSmokeData,

    [switch]$CleanupSmokeData,

    [int]$TimeoutSec = 25
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-EnvironmentConfig {
    param([string]$Env)

    switch ($Env) {
        'dev' {
            return @{
                EnvFile = '.env.dev'
                ComposeFile = 'docker-compose.dev.yml'
                ApiBaseUrl = 'http://localhost:18080'
                Database = 'axiom_dev'
            }
        }
        'uat' {
            return @{
                EnvFile = '.env.uat'
                ComposeFile = 'docker-compose.uat.yml'
                ApiBaseUrl = 'http://localhost:28080'
                Database = 'axiom_uat'
            }
        }
        default {
            return @{
                EnvFile = '.env.prod'
                ComposeFile = 'docker-compose.prod.yml'
                ApiBaseUrl = 'http://localhost:38080'
                Database = 'axiom_prod'
            }
        }
    }
}

function ConvertTo-B64Url {
    param([byte[]]$Bytes)

    return [Convert]::ToBase64String($Bytes).TrimEnd('=') -replace '\+', '-' -replace '/', '_'
}

function New-JwtToken {
    param([string]$Secret)

    $headerJson = '{"alg":"HS256","typ":"JWT"}'
    $payloadJson = '{"user_id":"00000000-0000-0000-0000-000000000001","email":"smoke@test.local"}'

    $header = ConvertTo-B64Url ([Text.Encoding]::UTF8.GetBytes($headerJson))
    $payload = ConvertTo-B64Url ([Text.Encoding]::UTF8.GetBytes($payloadJson))
    $unsigned = "$header.$payload"

    $hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($Secret))
    try {
        $signature = ConvertTo-B64Url ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($unsigned)))
    }
    finally {
        $hmac.Dispose()
    }

    return "$unsigned.$signature"
}

function ConvertTo-RecordArray {
    param([object]$Raw)

    if ($null -eq $Raw) {
        return @()
    }

    if ($Raw -is [System.Array]) {
        if (($Raw.Count -eq 1) -and ($Raw[0] -is [System.Array])) {
            return @($Raw[0])
        }

        return @($Raw)
    }

    return @($Raw)
}

function Invoke-Sql {
    param(
        [hashtable]$Config,
        [string]$Sql
    )

    docker compose --env-file $Config.EnvFile -f $Config.ComposeFile exec -T postgres psql -U axiom -d $Config.Database -c $Sql | Out-Null
}

$config = Get-EnvironmentConfig -Env $Environment
$resolvedApiBaseUrl = if ([string]::IsNullOrWhiteSpace($ApiBaseUrl)) { $config.ApiBaseUrl } else { $ApiBaseUrl.TrimEnd('/') }

if (-not (Test-Path $config.EnvFile)) {
    throw "Environment file not found: $($config.EnvFile)"
}

$secretLine = Get-Content $config.EnvFile | Where-Object { $_ -match '^JWT_SECRET=' } | Select-Object -First 1
if ([string]::IsNullOrWhiteSpace($secretLine)) {
    throw "JWT_SECRET missing in $($config.EnvFile)"
}

$jwtSecret = ($secretLine -replace '^JWT_SECRET=', '').Trim()
$token = New-JwtToken -Secret $jwtSecret

if ($SeedSmokeData) {
    Write-Host '[SSI Smoke] Seeding 2 temporary rows...' -ForegroundColor Cyan
    Invoke-Sql -Config $config -Sql "DELETE FROM ssis WHERE beneficiary_name IN ('SSI Smoke CP 1','SSI Smoke CP 2');"
    Invoke-Sql -Config $config -Sql "INSERT INTO ssis (beneficiary_name, beneficiary_account, beneficiary_bank, beneficiary_bank_bic, intermediary_bank, intermediary_bank_bic, settlement_type, active, valid_from) VALUES ('SSI Smoke CP 1','GB29NWBK60161331926819','Smoke Bank UK','NWBKGB2L','Intermediary One','IRVTUS3N','DAP',TRUE,NOW()),('SSI Smoke CP 2','SE4550000000058398257466','Smoke Bank SE','ESSESESS','Intermediary Two','CHASUS33','FOP',TRUE,NOW());"
}

$requiredFields = @(
    'id', 'ssi_reference', 'counterparty_name', 'account_name', 'country_code',
    'currency', 'bic', 'iban', 'settlement_method', 'status', 'updated_at'
)

Write-Host "[SSI Smoke] Calling $resolvedApiBaseUrl/api/v1/ssis ..." -ForegroundColor Cyan
$response = Invoke-WebRequest -Uri "$resolvedApiBaseUrl/api/v1/ssis?limit=500&offset=0" -Headers @{ Authorization = "Bearer $token"; Accept = 'application/json' } -TimeoutSec $TimeoutSec
$records = @(ConvertTo-RecordArray -Raw ($response.Content | ConvertFrom-Json))

$missingFields = @()
if ($records.Count -gt 0) {
    foreach ($field in $requiredFields) {
        if (-not ($records[0].PSObject.Properties.Name -contains $field)) {
            $missingFields += $field
        }
    }
}

$smokeRows = @($records | Where-Object { $_.counterparty_name -in @('SSI Smoke CP 1', 'SSI Smoke CP 2') })
$bgcMatches = @($records | Where-Object { (($_.counterparty_name -as [string]) -match 'BGC') -or (($_.account_name -as [string]) -match 'BGC') })

Write-Host "[SSI Smoke] http_status=$([int]$response.StatusCode)" -ForegroundColor Green
Write-Host "[SSI Smoke] records=$($records.Count)" -ForegroundColor Green
Write-Host "[SSI Smoke] missing_fields=$(if ($missingFields.Count -eq 0) { 'none' } else { $missingFields -join ',' })" -ForegroundColor Green
Write-Host "[SSI Smoke] smoke_rows=$($smokeRows.Count)" -ForegroundColor Green
Write-Host "[SSI Smoke] bgc_matches=$($bgcMatches.Count)" -ForegroundColor Green

if ($CleanupSmokeData) {
    Write-Host '[SSI Smoke] Cleaning temporary rows...' -ForegroundColor Cyan
    Invoke-Sql -Config $config -Sql "DELETE FROM ssis WHERE beneficiary_name IN ('SSI Smoke CP 1','SSI Smoke CP 2');"
}

$isPass = ([int]$response.StatusCode -eq 200) -and ($missingFields.Count -eq 0) -and ($bgcMatches.Count -eq 0)
Write-Host "[SSI Smoke] result=$(if ($isPass) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($isPass) { 'Green' } else { 'Red' })

if (-not $isPass) {
    exit 1
}
