#!/usr/bin/env pwsh
# Run docker compose for the main environment against the canonical repository root
# even when invoked from a git worktree.

param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ComposeArgs
)

$ErrorActionPreference = "Stop"

if (-not $ComposeArgs -or $ComposeArgs.Count -eq 0) {
    $ComposeArgs = @("ps")
}

$gitCommonDir = (& git rev-parse --path-format=absolute --git-common-dir).Trim()
if (-not $gitCommonDir) {
    throw "Unable to resolve git common dir. Run this script inside the repository or one of its worktrees."
}

$repoRoot = Split-Path -Parent $gitCommonDir
$envFile = Join-Path $repoRoot ".env.main"
$composeFile = Join-Path $repoRoot "docker-compose.main.yml"
$postgresDataDir = Join-Path $repoRoot "data/main/postgres"
$logMainDir = Join-Path $repoRoot "log/main"

if (-not (Test-Path $envFile)) {
    throw "Missing env file: $envFile"
}
if (-not (Test-Path $composeFile)) {
    throw "Missing compose file: $composeFile"
}

# Keep bind mounts anchored to the canonical repo root.
$env:POSTGRES_DATA_DIR = $postgresDataDir
$env:LOG_MAIN_DIR = $logMainDir

& (Join-Path $repoRoot "scripts/ensure-bind-mounts.ps1") -Environment main

$composeBaseArgs = @(
    "--project-directory", $repoRoot,
    "--env-file", $envFile,
    "-f", $composeFile
)

& docker compose @composeBaseArgs @ComposeArgs
exit $LASTEXITCODE
