#!/usr/bin/env pwsh

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$RepoPath = (Get-Location).Path,

    [string[]]$Namespaces = @(
        'refs/heads/feat',
        'logs/refs/heads/feat',
        'refs/heads/copilot',
        'logs/refs/heads/copilot',
        'refs/heads/perf',
        'logs/refs/heads/perf',
        'refs/remotes/origin/security',
        'refs/remotes/origin/fix',
        'refs/remotes/origin/feat',
        'refs/remotes/origin/copilot',
        'refs/remotes/origin/chore'
    ),

    [int]$MaxRetries = 8,

    [int]$RetryDelayMs = 250,

    [switch]$PruneEmptyParents,

    [string[]]$WorkspaceDirs = @(
        'backups'
    )
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-RepoRoot {
    param([string]$Path)

    # Normalize to a full path first
    $resolvedPath = (Resolve-Path -LiteralPath $Path).Path

    # Prefer git for repo root detection (handles subfolders and worktrees)
    if (Get-Command git -ErrorAction SilentlyContinue) {
        try {
            $gitTopLevel = & git -C $resolvedPath rev-parse --show-toplevel 2>$null
            if ($LASTEXITCODE -eq 0 -and $gitTopLevel) {
                return (Resolve-Path -LiteralPath $gitTopLevel.Trim()).Path
            }
        }
        catch {
            # Fall back to walking up the directory tree below
        }
    }

    # Fallback: walk up parent directories looking for a .git entry (directory or file)
    $current = $resolvedPath
    while ($current -and (Test-Path -LiteralPath $current)) {
        $gitPath = Join-Path $current '.git'
        if (Test-Path -LiteralPath $gitPath) {
            return (Resolve-Path -LiteralPath $current).Path
        }

        $parent = Split-Path -Path $current -Parent
        if (-not $parent -or $parent -eq $current) {
            break
        }

        $current = $parent
    }

    throw "No .git directory found under: $Path or its parent directories."
}

function Remove-EmptyDirectoryWithRetry {
    param(
        [string]$Path,
        [int]$Retries,
        [int]$DelayMs
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return 'MISSING'
    }

    for ($attempt = 1; $attempt -le $Retries; $attempt++) {
        try {
            $childCount = (Get-ChildItem -LiteralPath $Path -Force -ErrorAction SilentlyContinue | Measure-Object).Count
            if ($childCount -gt 0) {
                return "NOT_EMPTY:$childCount"
            }

            attrib -R -S -H "$Path" /S /D 2>$null | Out-Null

            if ($PSCmdlet.ShouldProcess($Path, 'Remove empty directory')) {
                Remove-Item -LiteralPath $Path -Force -ErrorAction Stop
            }

            Start-Sleep -Milliseconds 120

            if (-not (Test-Path -LiteralPath $Path)) {
                return 'REMOVED'
            }
        }
        catch {
            Start-Sleep -Milliseconds $DelayMs
        }
    }

    if (Test-Path -LiteralPath $Path) {
        return 'STILL_PRESENT'
    }

    return 'REMOVED'
}

function Remove-ParentDirectoriesIfEmpty {
    param(
        [string]$RepoRoot,
        [string]$RelativePath,
        [int]$Retries,
        [int]$DelayMs
    )

    $segments = $RelativePath -split '/'
    if ($segments.Count -le 1) {
        return
    }

    for ($i = $segments.Count - 1; $i -ge 1; $i--) {
        $parentRel = ($segments[0..($i - 1)] -join '/')
        $parentAbs = Join-Path (Join-Path $RepoRoot '.git') $parentRel

        if (-not (Test-Path -LiteralPath $parentAbs)) {
            continue
        }

        $result = Remove-EmptyDirectoryWithRetry -Path $parentAbs -Retries $Retries -DelayMs $DelayMs
        if ($result -like 'NOT_EMPTY*') {
            break
        }
    }
}

$repoRoot = Resolve-RepoRoot -Path $RepoPath
$gitRoot = Join-Path $repoRoot '.git'

Write-Host "[cleanup-git-refs] Repo: $repoRoot" -ForegroundColor Cyan
Write-Host "[cleanup-git-refs] Namespaces: $($Namespaces.Count)" -ForegroundColor Cyan
Write-Host "[cleanup-git-refs] WorkspaceDirs: $($WorkspaceDirs.Count)" -ForegroundColor Cyan

$results = @()

foreach ($namespace in $Namespaces) {
    $normalized = $namespace.Trim('/')
    $target = Join-Path $gitRoot $normalized
    $result = Remove-EmptyDirectoryWithRetry -Path $target -Retries $MaxRetries -DelayMs $RetryDelayMs

    $results += [pscustomobject]@{
        Namespace = $normalized
        Result = $result
    }

    if ($PruneEmptyParents -and ($result -eq 'REMOVED' -or $result -eq 'MISSING')) {
        Remove-ParentDirectoriesIfEmpty -RepoRoot $repoRoot -RelativePath $normalized -Retries $MaxRetries -DelayMs $RetryDelayMs
    }
}

$results | Sort-Object Namespace | Format-Table -AutoSize

$workspaceResults = @()

foreach ($workspaceDir in $WorkspaceDirs) {
    $normalizedWorkspaceDir = $workspaceDir.Trim('/', '\')
    if ([string]::IsNullOrWhiteSpace($normalizedWorkspaceDir)) {
        continue
    }

    $workspacePath = Join-Path $repoRoot $normalizedWorkspaceDir
    $result = Remove-EmptyDirectoryWithRetry -Path $workspacePath -Retries $MaxRetries -DelayMs $RetryDelayMs

    $workspaceResults += [pscustomobject]@{
        Directory = $normalizedWorkspaceDir
        Result = $result
    }
}

if ($workspaceResults.Count -gt 0) {
    Write-Host "[cleanup-git-refs] Workspace directory cleanup:" -ForegroundColor Cyan
    $workspaceResults | Sort-Object Directory | Format-Table -AutoSize
}

$stillPresent = @(
    $results | Where-Object { $_.Result -eq 'STILL_PRESENT' }
)

$workspaceStillPresent = @(
    $workspaceResults | Where-Object { $_.Result -eq 'STILL_PRESENT' }
)

if ($stillPresent.Count -gt 0 -or $workspaceStillPresent.Count -gt 0) {
    Write-Host "[cleanup-git-refs] WARNING: Some namespaces are still present (likely locked by sync/indexing)." -ForegroundColor Yellow
    exit 1
}

Write-Host "[cleanup-git-refs] Done." -ForegroundColor Green