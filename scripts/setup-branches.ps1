#!/usr/bin/env pwsh
<#
.SYNOPSIS
Creates and protects the strategic long-lived branches (dev, uat, prod) for
the Axiom repository using the GitHub CLI (gh).

.DESCRIPTION
PowerShell equivalent of scripts/setup-branches.sh.

Prerequisites:
  - GitHub CLI installed: https://cli.github.com/
  - Authenticated: gh auth login
  - Token needs 'repo' and admin:repo_hook scopes (or owner access)

.PARAMETER DryRun
Print what would happen without making any changes.

.EXAMPLE
./scripts/setup-branches.ps1

.EXAMPLE
./scripts/setup-branches.ps1 -DryRun

.NOTES
See docs/contributing/BRANCHING_STRATEGY.md for full strategy documentation.
#>

[CmdletBinding()]
param(
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
$SourceBranch = 'main'
$Branches = @('dev', 'uat', 'prod')

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
function Log  { param([string]$Msg) Write-Host "  $Msg" }
function Info { param([string]$Msg) Write-Host "->  $Msg" }
function Ok   { param([string]$Msg) Write-Host "OK  $Msg" -ForegroundColor Green }
function Warn { param([string]$Msg) Write-Host "WARN  $Msg" -ForegroundColor Yellow }

function Invoke-Gh {
    param([string[]]$GhArgs)
    if ($DryRun) {
        Write-Host "[dry-run] gh $($GhArgs -join ' ')"
    } else {
        & gh @GhArgs
        if ($LASTEXITCODE -ne 0) {
            throw "gh command failed: gh $($GhArgs -join ' ')"
        }
    }
}

# ---------------------------------------------------------------------------
# Detect repository
# ---------------------------------------------------------------------------
$Repo = $env:GITHUB_REPOSITORY

if ([string]::IsNullOrWhiteSpace($Repo)) {
    try {
        $remoteUrl = git remote get-url origin 2>$null
        if ($remoteUrl -match 'github\.com[:/]([^/]+/[^/\.]+)') {
            $Repo = $Matches[1] -replace '\.git$', ''
        }
    } catch {
        # ignore
    }
}

if ([string]::IsNullOrWhiteSpace($Repo)) {
    Write-Error "Could not detect repository. Set GITHUB_REPOSITORY (owner/repo) or run from inside the repo."
    exit 1
}

Info "Repository : $Repo"
Info "Source     : $SourceBranch"
Info "Dry run    : $DryRun"
Write-Host ""

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "GitHub CLI (gh) is not installed. Install it from https://cli.github.com/"
    exit 1
}

& gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Not authenticated with GitHub CLI. Run: gh auth login"
    exit 1
}

# ---------------------------------------------------------------------------
# Step 1 – Create branches (skip if they already exist)
# ---------------------------------------------------------------------------
Write-Host "-- Step 1: Create branches -------------------------------------------------"
$existingBranches = & gh api --paginate "repos/$Repo/branches" --jq '.[].name' 2>$null

foreach ($branch in $Branches) {
    if ($existingBranches -contains $branch) {
        Warn "Branch '$branch' already exists -- skipping creation."
    } else {
        Info "Creating branch '$branch' from '$SourceBranch' ..."
        if ($DryRun) {
            Write-Host "[dry-run] gh api --method POST repos/$Repo/git/refs -f ref=refs/heads/$branch -f sha=<HEAD sha of $SourceBranch>"
        } else {
            $sourceSha = & gh api "repos/$Repo/branches/$SourceBranch" --jq '.commit.sha'
            if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($sourceSha)) {
                Write-Error "Failed to get SHA for '$SourceBranch'. Check REPO and token scopes."
                exit 1
            }
            & gh api `
                --method POST `
                -H "Accept: application/vnd.github+json" `
                "repos/$Repo/git/refs" `
                -f "ref=refs/heads/$branch" `
                -f "sha=$sourceSha"
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to create branch '$branch'."
                exit 1
            }
            Ok "Created '$branch'."
        }
    }
}
Write-Host ""

# ---------------------------------------------------------------------------
# Step 2 – Apply branch protection rules
# ---------------------------------------------------------------------------
Write-Host "-- Step 2: Apply branch protection -----------------------------------------"

function Set-BranchProtection {
    param([string]$Branch, [int]$RequiredApprovals)

    Info "Protecting '$Branch' (required approvals: $RequiredApprovals) ..."

    $body = @{
        required_status_checks       = @{ strict = $true; contexts = @() }
        enforce_admins               = $true
        required_pull_request_reviews = @{
            dismiss_stale_reviews         = $true
            require_code_owner_reviews    = $false
            required_approving_review_count = $RequiredApprovals
        }
        restrictions                 = $null
        allow_force_pushes           = $false
        allow_deletions              = $false
        required_conversation_resolution = $true
    } | ConvertTo-Json -Depth 10

    if ($DryRun) {
        Write-Host "[dry-run] gh api --method PUT repos/$Repo/branches/$Branch/protection --input <json>"
    } else {
        $tmpFile = [System.IO.Path]::GetTempFileName()
        try {
            Set-Content -Path $tmpFile -Value $body -Encoding utf8
            & gh api `
                --method PUT `
                -H "Accept: application/vnd.github+json" `
                "repos/$Repo/branches/$Branch/protection" `
                --input $tmpFile
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to apply protection to '$Branch'. Check token scopes (repo + admin:repo_hook)."
                exit 1
            }
        } finally {
            Remove-Item $tmpFile -ErrorAction SilentlyContinue
        }
        Ok "Protected '$Branch'."
    }
}

Set-BranchProtection 'main' 1
Set-BranchProtection 'dev'  1
Set-BranchProtection 'uat'  1
Set-BranchProtection 'prod' 2

Write-Host ""

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
Write-Host "============================================================"
Ok "Branch setup complete."
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Verify branches in GitHub -> Code -> Branches."
Write-Host "  2. Confirm protection rules in GitHub -> Settings -> Branches."
Write-Host "  3. Attach required CI status checks once workflows are named."
Write-Host "     GitHub -> Settings -> Branches -> edit rule -> Status checks."
Write-Host ""
Write-Host "  See docs/contributing/BRANCHING_STRATEGY.md for the full guide."
Write-Host "============================================================"
