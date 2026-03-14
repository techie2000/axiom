#!/usr/bin/env pwsh
<#!
.SYNOPSIS
Runs API smoke tests for dev, UAT, and prod environments.

.DESCRIPTION
Performs a consistent smoke-test suite against Axiom backend endpoints.

Checks per environment:
- GET /health returns HTTP 200 and status "healthy"
- GET /version returns HTTP 200
- GET /api/v1/entities without auth returns HTTP 401
- GET /api/v1/entities with a generated JWT is accepted by auth middleware (not 401/403)
- Optional: POST /api/v1/auth/login returns HTTP 200 (informational, current endpoint is placeholder)

The script reads JWT secrets and backend ports from .env.<environment> files
in the workspace root to avoid hardcoding environment values.

.PARAMETER Environment
Environment to test: dev, uat, prod, main, or all. Defaults to all.

.PARAMETER TimeoutSec
HTTP timeout in seconds for each request. Defaults to 20.

.PARAMETER StartupWaitSec
Maximum seconds to wait for /health before running checks. Defaults to 90.

.PARAMETER CheckLogin
Include POST /api/v1/auth/login in checks. This is informational and does not
fail the run if it is not 200.

.EXAMPLE
./scripts/smoke-api.ps1
Runs smoke tests for all environments.

.EXAMPLE
./scripts/smoke-api.ps1 -Environment uat
Runs smoke tests only for UAT.

.EXAMPLE
./scripts/smoke-api.ps1 -Environment prod -CheckLogin
Runs smoke tests for prod and includes login endpoint check.

.EXAMPLE
./scripts/smoke-api.ps1 -Environment dev -StartupWaitSec 120
Waits up to 120 seconds for API readiness, then runs dev smoke tests.
#>

[CmdletBinding()]
param(
    [ValidateSet('dev', 'uat', 'prod', 'main', 'all')]
    [string]$Environment = 'all',

    [ValidateRange(5, 120)]
    [int]$TimeoutSec = 20,

    [ValidateRange(0, 300)]
    [int]$StartupWaitSec = 90,

    [switch]$CheckLogin
)

$ErrorActionPreference = 'Stop'

function ConvertTo-Base64Url {
    param([byte[]]$Bytes)

    return [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function New-Hs256Jwt {
    param(
        [Parameter(Mandatory = $true)][string]$Secret,
        [Parameter(Mandatory = $true)][string]$UserId,
        [Parameter(Mandatory = $true)][string]$Email
    )

    $headerJson = '{"alg":"HS256","typ":"JWT"}'
    $payloadJson = ConvertTo-Json @{ user_id = $UserId; email = $Email } -Compress

    $header = ConvertTo-Base64Url -Bytes ([System.Text.Encoding]::UTF8.GetBytes($headerJson))
    $payload = ConvertTo-Base64Url -Bytes ([System.Text.Encoding]::UTF8.GetBytes($payloadJson))
    $unsigned = "$header.$payload"

    $hmac = [System.Security.Cryptography.HMACSHA256]::new([System.Text.Encoding]::UTF8.GetBytes($Secret))
    try {
        $signatureBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($unsigned))
    }
    finally {
        $hmac.Dispose()
    }

    $signature = ConvertTo-Base64Url -Bytes $signatureBytes
    return "$unsigned.$signature"
}

function Get-EnvMap {
    param([Parameter(Mandatory = $true)][string]$EnvFile)

    if (-not (Test-Path $EnvFile)) {
        throw "Missing environment file: $EnvFile"
    }

    $envMap = @{}
    $lines = Get-Content $EnvFile

    foreach ($line in $lines) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $trimmed = $line.Trim()
        if ($trimmed.StartsWith('#')) { continue }
        if ($trimmed -notmatch '=') { continue }

        $parts = $trimmed.Split('=', 2)
        if ($parts.Count -eq 2) {
            $key = $parts[0].Trim()
            $value = $parts[1].Trim()
            $envMap[$key] = $value
        }
    }

    return $envMap
}

function Invoke-Endpoint {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$Timeout = 20,
        [hashtable]$Headers,
        [string]$ContentType,
        [string]$Body
    )

    try {
        $requestParams = @{
            Uri       = $Url
            Method    = $Method
            TimeoutSec = $Timeout
        }

        if ($Headers) { $requestParams['Headers'] = $Headers }
        if ($ContentType) { $requestParams['ContentType'] = $ContentType }
        if ($Body) { $requestParams['Body'] = $Body }

        $response = Invoke-WebRequest @requestParams
        return [PSCustomObject]@{
            StatusCode = [int]$response.StatusCode
            Content    = [string]$response.Content
            Ok         = $true
            Error      = $null
        }
    }
    catch {
        $statusCode = $null
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }

        return [PSCustomObject]@{
            StatusCode = $statusCode
            Content    = $null
            Ok         = $false
            Error      = $_.Exception.Message
        }
    }
}

function Wait-ApiReady {
    param(
        [Parameter(Mandatory = $true)][string]$BaseUrl,
        [int]$MaxWaitSec = 90,
        [int]$RequestTimeoutSec = 5
    )

    if ($MaxWaitSec -le 0) {
        return $true
    }

    $deadline = (Get-Date).AddSeconds($MaxWaitSec)
    $healthUrl = "$BaseUrl/health"

    do {
        $probe = Invoke-Endpoint -Method 'GET' -Url $healthUrl -Timeout $RequestTimeoutSec
        if ($probe.StatusCode -eq 200 -and $probe.Content -match 'healthy') {
            return $true
        }

        Start-Sleep -Seconds 2
    }
    while ((Get-Date) -lt $deadline)

    return $false
}

# Resolve workspace root from script location.
$workspaceRoot = Split-Path -Parent $PSScriptRoot
Set-Location $workspaceRoot

$environmentFiles = @{
    dev  = '.env.dev'
    uat  = '.env.uat'
    prod = '.env.prod'
    main = '.env.main'
}

$targetEnvironments = if ($Environment -eq 'all') {
    @('dev', 'uat', 'prod', 'main')
}
else {
    @($Environment)
}

$results = @()

Write-Host "`n=== Axiom API Smoke Test ===" -ForegroundColor Cyan
Write-Host "Workspace: $workspaceRoot"
Write-Host "Targets: $($targetEnvironments -join ', ')"
Write-Host "Timeout: ${TimeoutSec}s`n"
Write-Host "Startup wait: ${StartupWaitSec}s max`n"

foreach ($envName in $targetEnvironments) {
    $envFile = Join-Path $workspaceRoot $environmentFiles[$envName]
    $envMap = Get-EnvMap -EnvFile $envFile

    $backendPort = $envMap['BACKEND_PORT']
    $jwtSecret = $envMap['JWT_SECRET']

    if (-not $backendPort) {
        throw "BACKEND_PORT is missing in $envFile"
    }
    if (-not $jwtSecret) {
        throw "JWT_SECRET is missing in $envFile"
    }

    $baseUrl = "http://localhost:$backendPort"
    Write-Host "[$($envName.ToUpper())] Base URL: $baseUrl" -ForegroundColor Yellow

    if (-not (Wait-ApiReady -BaseUrl $baseUrl -MaxWaitSec $StartupWaitSec -RequestTimeoutSec ([Math]::Min($TimeoutSec, 5)))) {
        Write-Host ("  readiness=TIMEOUT after {0}s; continuing with checks" -f $StartupWaitSec) -ForegroundColor Yellow
    }

    $health = Invoke-Endpoint -Method 'GET' -Url "$baseUrl/health" -Timeout $TimeoutSec
    $version = Invoke-Endpoint -Method 'GET' -Url "$baseUrl/version" -Timeout $TimeoutSec

    # Protected endpoint should reject anonymous requests.
    $unauth = Invoke-Endpoint -Method 'GET' -Url "$baseUrl/api/v1/entities?limit=1&offset=0" -Timeout $TimeoutSec

    # Generate a valid JWT for middleware verification.
    $jwt = New-Hs256Jwt -Secret $jwtSecret -UserId '00000000-0000-0000-0000-000000000001' -Email 'smoke@test.local'
    $auth = Invoke-Endpoint -Method 'GET' -Url "$baseUrl/api/v1/entities?limit=1&offset=0" -Timeout $TimeoutSec -Headers @{ Authorization = "Bearer $jwt" }

    $loginStatus = $null
    if ($CheckLogin) {
        $login = Invoke-Endpoint -Method 'POST' -Url "$baseUrl/api/v1/auth/login" -Timeout $TimeoutSec -ContentType 'application/json' -Body '{"email":"x","password":"y"}'
        $loginStatus = $login.StatusCode
    }

    $healthOk = $health.StatusCode -eq 200 -and $health.Content -match 'healthy'
    $versionOk = $version.StatusCode -eq 200
    $unauthOk = $unauth.StatusCode -eq 401
    $authAccepted = ($null -ne $auth.StatusCode) -and ($auth.StatusCode -notin @(401, 403))

    $allChecksPassed = $healthOk -and $versionOk -and $unauthOk -and $authAccepted

    $results += [PSCustomObject]@{
        Environment      = $envName
        Health           = $health.StatusCode
        Version          = $version.StatusCode
        UnauthProtected  = $unauth.StatusCode
        AuthProtected    = $auth.StatusCode
        Login            = $loginStatus
        Passed           = $allChecksPassed
    }

    Write-Host ("  health={0} version={1} unauth={2} auth={3}" -f $health.StatusCode, $version.StatusCode, $unauth.StatusCode, $auth.StatusCode)
    if ($CheckLogin) {
        Write-Host ("  login={0} (informational)" -f $loginStatus)
    }
    Write-Host ("  result={0}`n" -f ($(if ($allChecksPassed) { 'PASS' } else { 'FAIL' }))) -ForegroundColor $(if ($allChecksPassed) { 'Green' } else { 'Red' })
}

Write-Host "=== Summary ===" -ForegroundColor Cyan
$results | Format-Table -AutoSize

if ($results.Passed -contains $false) {
    Write-Error 'One or more environments failed smoke checks.'
    exit 1
}

Write-Host 'All smoke checks passed.' -ForegroundColor Green
exit 0
