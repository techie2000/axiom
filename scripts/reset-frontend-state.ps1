#!/usr/bin/env pwsh

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("main", "dev", "uat", "prod")]
    [string]$Environment
)

$ErrorActionPreference = "Stop"

$gitCommonDir = (& git rev-parse --path-format=absolute --git-common-dir).Trim()
if (-not $gitCommonDir) {
    throw "Unable to resolve git common dir. Run this script inside the repository or one of its worktrees."
}

$repoRoot = Split-Path -Parent $gitCommonDir

$config = switch ($Environment) {
    "main" {
        @{
            ProjectName = "axiom-main"
            EnvFile = Join-Path $repoRoot ".env.main"
            ComposeFile = Join-Path $repoRoot "docker-compose.main.yml"
            HasFrontendVolumes = $true
            UseMainWrapper = $true
            NodeModulesVolume = "axiom-main_frontend_node_modules_main"
            NextVolume = "axiom-main_frontend_next_main"
        }
    }
    "dev" {
        @{
            ProjectName = "axiom-dev"
            EnvFile = Join-Path $repoRoot ".env.dev"
            ComposeFile = Join-Path $repoRoot "docker-compose.dev.yml"
            HasFrontendVolumes = $true
            UseMainWrapper = $false
            NodeModulesVolume = "axiom-dev_frontend_node_modules_dev"
            NextVolume = "axiom-dev_frontend_next_dev"
        }
    }
    "uat" {
        @{
            ProjectName = "axiom-uat"
            EnvFile = Join-Path $repoRoot ".env.uat"
            ComposeFile = Join-Path $repoRoot "docker-compose.uat.yml"
            HasFrontendVolumes = $false
            UseMainWrapper = $false
        }
    }
    "prod" {
        @{
            ProjectName = "axiom-prod"
            EnvFile = Join-Path $repoRoot ".env.prod"
            ComposeFile = Join-Path $repoRoot "docker-compose.prod.yml"
            HasFrontendVolumes = $false
            UseMainWrapper = $false
        }
    }
}

if (-not (Test-Path $config.EnvFile)) {
    throw "Missing env file: $($config.EnvFile)"
}
if (-not (Test-Path $config.ComposeFile)) {
    throw "Missing compose file: $($config.ComposeFile)"
}

$frontendContainer = "$($config.ProjectName)-frontend"
$composeBaseArgs = @(
    "--project-directory", $repoRoot,
    "--env-file", $config.EnvFile,
    "-f", $config.ComposeFile
)

Write-Host "Stopping $Environment frontend service..."
if ($config.UseMainWrapper) {
    & (Join-Path $repoRoot "scripts/run-main-compose.ps1") stop -t 45 frontend
} else {
    & docker compose @composeBaseArgs stop -t 45 frontend
}

Write-Host "Removing frontend container to release volumes..."
& docker rm -f $frontendContainer *> $null

if ($config.HasFrontendVolumes) {
    Write-Host "Removing stale frontend volumes..."
    & docker volume rm $config.NodeModulesVolume $config.NextVolume *> $null
} else {
    Write-Host "No dedicated frontend node_modules/.next volumes defined for '$Environment'; skipping volume removal."
}

Write-Host "Rebuilding and recreating $Environment frontend service..."
if ($config.UseMainWrapper) {
    & (Join-Path $repoRoot "scripts/run-main-compose.ps1") up -d --build frontend
} else {
    & docker compose @composeBaseArgs up -d --build frontend
}
if ($LASTEXITCODE -ne 0) {
    throw "Failed to recreate $Environment frontend service."
}

Write-Host "$Environment frontend state reset complete."