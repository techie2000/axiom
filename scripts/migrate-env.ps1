param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("main", "dev", "uat", "prod")]
    [string]$Environment,

    [ValidateSet("up", "down", "force")]
    [string]$Direction = "up",

    [int]$ForceVersion = -1
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$composeMap = @{
    main = @{ EnvFile = ".env.main"; ComposeFile = "docker-compose.main.yml" }
    dev  = @{ EnvFile = ".env.dev"; ComposeFile = "docker-compose.dev.yml" }
    uat  = @{ EnvFile = ".env.uat"; ComposeFile = "docker-compose.uat.yml" }
    prod = @{ EnvFile = ".env.prod"; ComposeFile = "docker-compose.prod.yml" }
}

$config = $composeMap[$Environment]
if (-not (Test-Path $config.EnvFile)) {
    throw "Missing env file: $($config.EnvFile)"
}
if (-not (Test-Path $config.ComposeFile)) {
    throw "Missing compose file: $($config.ComposeFile)"
}

$envLines = Get-Content $config.EnvFile | Where-Object { $_ -match '=' -and -not $_.Trim().StartsWith('#') }
$envMap = @{}
foreach ($line in $envLines) {
    $parts = $line.Split('=', 2)
    if ($parts.Count -eq 2) {
        $envMap[$parts[0].Trim()] = $parts[1].Trim()
    }
}

$dbUser = $envMap['DATABASE_USER']
$dbPassword = $envMap['DATABASE_PASSWORD']
$dbName = $envMap['DATABASE_NAME']
if (-not $dbUser -or -not $dbPassword -or -not $dbName) {
    throw "DATABASE_USER, DATABASE_PASSWORD, and DATABASE_NAME must be set in $($config.EnvFile)"
}

$databaseUrl = "postgres://${dbUser}:${dbPassword}@postgres:5432/${dbName}?sslmode=disable"

$cmdSuffix = switch ($Direction) {
    "up" { "up" }
    "down" { "down 1" }
    "force" {
        if ($ForceVersion -lt 0) {
            throw "-ForceVersion is required when -Direction force"
        }
        "force $ForceVersion"
    }
}

$containerScript = @'
rm -f /tmp/migrate /tmp/migrate.tar.gz && apk add --no-cache wget tar >/dev/null && wget --no-check-certificate -q -O /tmp/migrate.tar.gz https://github.com/golang-migrate/migrate/releases/download/v4.18.1/migrate.linux-amd64.tar.gz && tar -xzf /tmp/migrate.tar.gz -C /tmp && chmod +x /tmp/migrate && /tmp/migrate -path /root/migrations -database '__DB__' -verbose __CMD__
'@

$containerScript = $containerScript.Replace("__CMD__", $cmdSuffix)
$containerScript = $containerScript.Replace("__DB__", $databaseUrl)

Write-Host "Starting dependencies for $Environment..."
docker compose --env-file $($config.EnvFile) -f $($config.ComposeFile) up -d postgres rabbitmq backend

Write-Host "Running migration '$Direction' for $Environment..."
docker compose --env-file $($config.EnvFile) -f $($config.ComposeFile) exec -T backend sh -lc $containerScript

Write-Host "Done."
