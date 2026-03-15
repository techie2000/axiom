<#
.SYNOPSIS
    Registers human-friendly .localhost URL aliases for all Axiom environments
    using the portless proxy (https://github.com/vercel-labs/portless).

.DESCRIPTION
    Portless maps named .localhost URLs to the port-prefixed Docker service ports
    used by Axiom's multi-environment setup.

    After running this script the following URLs become available (HTTP proxy port 1355):
        axiom-main.localhost:1355            Frontend  :43000
        api.axiom-main.localhost:1355        Backend   :48080
        rabbitmq.axiom-main.localhost:1355   RabbitMQ  :45673
        axiom-dev.localhost:1355             Frontend  :13000
        api.axiom-dev.localhost:1355         Backend   :18080
        rabbitmq.axiom-dev.localhost:1355    RabbitMQ  :15673
        axiom-uat.localhost:1355             Frontend  :23000
        api.axiom-uat.localhost:1355         Backend   :28080
        rabbitmq.axiom-uat.localhost:1355    RabbitMQ  :25673
        axiom-prod.localhost:1355            Frontend  :33000
        api.axiom-prod.localhost:1355        Backend   :38080
        rabbitmq.axiom-prod.localhost:1355   RabbitMQ  :35673

.PARAMETER Environments
    One or more environment names to register: main, dev, uat, prod.
    Defaults to all four environments when omitted.

.EXAMPLE
    pwsh -File scripts/portless-setup.ps1
    Registers aliases for all four environments.

.EXAMPLE
    pwsh -File scripts/portless-setup.ps1 -Environments dev,uat
    Registers aliases for the dev and uat environments only.

.NOTES
    Prerequisites:
        npm install -g portless
        portless proxy start            # HTTP on port 1355
        # or:
        portless proxy start --https   # HTTPS on port 443 (no port in URLs)
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [ValidateSet('main', 'dev', 'uat', 'prod')]
    [string[]] $Environments = @('main', 'dev', 'uat', 'prod')
)

# ---------------------------------------------------------------------------
# Environment port mapping
# ---------------------------------------------------------------------------
$PortMap = @{
    main = @{ Frontend = 43000; Api = 48080; RabbitMQ = 45673 }
    dev  = @{ Frontend = 13000; Api = 18080; RabbitMQ = 15673 }
    uat  = @{ Frontend = 23000; Api = 28080; RabbitMQ = 25673 }
    prod = @{ Frontend = 33000; Api = 38080; RabbitMQ = 35673 }
}

# ---------------------------------------------------------------------------
# Prerequisite check
# ---------------------------------------------------------------------------
if (-not (Get-Command portless -ErrorAction SilentlyContinue)) {
    Write-Error @"
portless is not installed.

Install it with:
    npm install -g portless

Then start the proxy:
    portless proxy start
or for HTTPS:
    portless proxy start --https
"@
    exit 1
}

# ---------------------------------------------------------------------------
# Register aliases
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "Registering portless aliases..." -ForegroundColor Cyan
Write-Host ""

foreach ($env in $Environments) {
    $ports = $PortMap[$env]

    Write-Host "  📦 Environment: $env" -ForegroundColor Yellow

    $aliases = @(
        @{ Name = "axiom-$env";          Port = $ports.Frontend; Label = 'frontend' }
        @{ Name = "api.axiom-$env";      Port = $ports.Api;      Label = 'backend API' }
        @{ Name = "rabbitmq.axiom-$env"; Port = $ports.RabbitMQ; Label = 'RabbitMQ management' }
    )

    foreach ($a in $aliases) {
        $result = portless alias $a.Name $a.Port --force 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ $($a.Name) → :$($a.Port)  ($($a.Label))" -ForegroundColor Green
        } else {
            Write-Warning "  Failed to register $($a.Name) → :$($a.Port) : $result"
        }
    }

    Write-Host ""
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-Host "🌐 Active routes:" -ForegroundColor Cyan
portless list 2>$null
Write-Host ""
Write-Host "💡 Tip: Use 'portless proxy start --https' for portless HTTPS URLs (no :1355 suffix)." -ForegroundColor DarkCyan
Write-Host "💡 Tip: Safari users should also run 'portless hosts sync' once." -ForegroundColor DarkCyan
Write-Host ""
Write-Host "✅ Portless setup complete." -ForegroundColor Green
