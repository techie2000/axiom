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

function Resolve-GitDir {
    # Returns the *actual* git directory (the directory that contains refs/ and logs/).
    # For standard repos this is <root>/.git; for worktrees/submodules it is the real
    # git dir that the .git file points at, e.g. <root>/.git/worktrees/<name>.
    param([string]$Path)

    $resolvedPathObj = Resolve-Path -LiteralPath $Path -ErrorAction SilentlyContinue
    if (-not $resolvedPathObj) {
        throw "Path not found: $Path"
    }
    $resolvedPath = $resolvedPathObj.Path

    # Prefer git itself — handles all repo shapes (standard, worktree, submodule) correctly.
    try {
        $gitCmd = Get-Command git -ErrorAction Stop
        $absoluteGitDir = & $gitCmd.Path -C $resolvedPath rev-parse --absolute-git-dir 2>$null
        if ($LASTEXITCODE -eq 0 -and $absoluteGitDir) {
            return (Resolve-Path -LiteralPath $absoluteGitDir.Trim()).Path
        }
    }
    catch {
        # git not available — fall back to filesystem checks below.
    }

    $gitPath = Join-Path $resolvedPath '.git'

    # Standard case: .git is a directory that already contains refs/ and logs/.
    if (Test-Path -LiteralPath $gitPath -PathType Container) {
        return (Resolve-Path -LiteralPath $gitPath).Path
    }

    # Worktree/submodule case: .git is a file with a gitdir: pointer to the real git directory.
    if (Test-Path -LiteralPath $gitPath -PathType Leaf) {
        $firstLine = Get-Content -LiteralPath $gitPath -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($firstLine -and $firstLine -match '^\s*gitdir:\s*(.+)\s*$') {
            $gitDir = $Matches[1].Trim()
            if (-not [System.IO.Path]::IsPathRooted($gitDir)) {
                $gitDir = Join-Path $resolvedPath $gitDir
            }
            if (Test-Path -LiteralPath $gitDir -PathType Container) {
                return (Resolve-Path -LiteralPath $gitDir).Path
            }
        }
    }

    throw "No .git directory or gitdir file found under: $Path"
}

function Resolve-RepoRoot {
    param([string]$Path)

    $resolvedPathObj = Resolve-Path -LiteralPath $Path -ErrorAction SilentlyContinue
    if (-not $resolvedPathObj) {
        throw "Path not found: $Path"
    }
    $resolvedPath = $resolvedPathObj.Path

    try {
        $gitCmd = Get-Command git -ErrorAction Stop
        $repoRoot = & $gitCmd.Path -C $resolvedPath rev-parse --show-toplevel 2>$null
        if ($LASTEXITCODE -eq 0 -and $repoRoot) {
            return (Resolve-Path -LiteralPath $repoRoot.Trim()).Path
        }
    }
    catch {
        # git not available — fall back to parent traversal below.
    }

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

            if ($IsWindows) {
                attrib -R -S -H "$Path" /S /D 2>$null | Out-Null
            }
            else {
                # On non-Windows platforms, clear ReadOnly, System, and Hidden attributes via
                # PowerShell-native attribute manipulation to mirror what attrib -R -S -H does on Windows.
                try {
                    $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
                    if ($item) {
                        $attrsToRemove = [System.IO.FileAttributes]::ReadOnly -bor
                                         [System.IO.FileAttributes]::System -bor
                                         [System.IO.FileAttributes]::Hidden
                        if ($item.Attributes -band $attrsToRemove) {
                            $item.Attributes = $item.Attributes -band (-bnot $attrsToRemove)
                        }
                    }
                }
                catch {
                    # Attribute clearing is best-effort; ignore errors and attempt removal.
                }
            }

            if ($WhatIfPreference) {
                Write-Host "What if: remove empty directory '$Path'" -ForegroundColor DarkGray
                return 'WHATIF'
            }

            Remove-Item -LiteralPath $Path -Force -ErrorAction Stop

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
        [string]$GitRoot,
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
        $parentAbs = Join-Path $GitRoot $parentRel

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
$gitRoot = Resolve-GitDir -Path $RepoPath

Write-Host "[cleanup-git-refs] Git dir: $gitRoot" -ForegroundColor Cyan
Write-Host "[cleanup-git-refs] Repo root: $repoRoot" -ForegroundColor Cyan
Write-Host "[cleanup-git-refs] Namespaces: $($Namespaces.Count)" -ForegroundColor Cyan
Write-Host "[cleanup-git-refs] WorkspaceDirs: $($WorkspaceDirs.Count)" -ForegroundColor Cyan

$results = @()

# Normalize the git root once with a trailing separator for containment checks.
$normalizedGitRoot = [System.IO.Path]::GetFullPath($gitRoot).TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
) + [System.IO.Path]::DirectorySeparatorChar

foreach ($namespace in $Namespaces) {
    # Guard against null/empty elements in the Namespaces array. Under Set-StrictMode -Version Latest,
    # calling .Trim() on $null throws; treat such entries as unsafe and skip them.
    if ([string]::IsNullOrWhiteSpace($namespace)) {
        Write-Warning "[cleanup-git-refs] Skipping null/empty namespace entry."
        $results += [pscustomobject]@{
            Namespace = ''
            Result    = 'SKIPPED_UNSAFE'
        }
        continue
    }

    $normalized = $namespace.Trim('/')

    # Validate that the namespace is a safe relative path: reject '..' segments, rooted paths,
    # and backslashes. Colons are only rejected on Windows (drive-letter paths).
    $hasUnsafeChars = $normalized -match '[\\]' -or ($IsWindows -and $normalized -match ':')
    if ($normalized -match '(^|/)\.\.(/|$)' -or
        [System.IO.Path]::IsPathRooted($normalized) -or
        $hasUnsafeChars) {
        Write-Warning "[cleanup-git-refs] Skipping unsafe namespace: $namespace"
        $results += [pscustomobject]@{
            Namespace = $normalized
            Result    = 'SKIPPED_UNSAFE'
        }
        continue
    }

    $target = Join-Path $gitRoot $normalized

    # Verify the resolved target path is actually inside the git directory to prevent escapes.
    # Use Ordinal (case-sensitive) on non-Windows filesystems; OrdinalIgnoreCase on Windows.
    $resolvedTargetObj = Resolve-Path -LiteralPath $target -ErrorAction SilentlyContinue
    if ($resolvedTargetObj) {
        $resolvedTarget = $resolvedTargetObj.Path
    }
    else {
        # Path doesn't exist yet; build the canonical form without resolving.
        $resolvedTarget = [System.IO.Path]::GetFullPath($target)
    }
    $normalizedTarget = $resolvedTarget.TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    ) + [System.IO.Path]::DirectorySeparatorChar
    $comparison = if ($IsWindows) { [System.StringComparison]::OrdinalIgnoreCase } else { [System.StringComparison]::Ordinal }
    if (-not $normalizedTarget.StartsWith($normalizedGitRoot, $comparison)) {
        Write-Warning "[cleanup-git-refs] Skipping namespace that escapes git root: $namespace"
        $results += [pscustomobject]@{
            Namespace = $normalized
            Result    = 'SKIPPED_UNSAFE'
        }
        continue
    }

    $result = Remove-EmptyDirectoryWithRetry -Path $target -Retries $MaxRetries -DelayMs $RetryDelayMs

    $results += [pscustomobject]@{
        Namespace = $normalized
        Result = $result
    }

    if ($PruneEmptyParents -and ($result -eq 'REMOVED' -or $result -eq 'MISSING')) {
        Remove-ParentDirectoriesIfEmpty -GitRoot $gitRoot -RelativePath $normalized -Retries $MaxRetries -DelayMs $RetryDelayMs
    }
}

$results | Sort-Object Namespace | Format-Table -AutoSize

$workspaceResults = @()

foreach ($workspaceDir in $WorkspaceDirs) {
    if ([string]::IsNullOrWhiteSpace($workspaceDir)) {
        continue
    }

    $normalizedWorkspaceDir = $workspaceDir.Trim([char]'/', [char]'\')

    $hasUnsafeWorkspaceChars = $normalizedWorkspaceDir -match '[\\]' -or ($IsWindows -and $normalizedWorkspaceDir -match ':')
    if ($normalizedWorkspaceDir -match '(^|/)\.\.(/|$)' -or
        [System.IO.Path]::IsPathRooted($normalizedWorkspaceDir) -or
        $hasUnsafeWorkspaceChars) {
        Write-Warning "[cleanup-git-refs] Skipping unsafe workspace dir: $workspaceDir"
        $workspaceResults += [pscustomobject]@{
            Directory = $normalizedWorkspaceDir
            Result    = 'SKIPPED_UNSAFE'
        }
        continue
    }

    $workspacePath = Join-Path $repoRoot $normalizedWorkspaceDir

    $resolvedWorkspaceObj = Resolve-Path -LiteralPath $workspacePath -ErrorAction SilentlyContinue
    if ($resolvedWorkspaceObj) {
        $resolvedWorkspacePath = $resolvedWorkspaceObj.Path
    }
    else {
        $resolvedWorkspacePath = [System.IO.Path]::GetFullPath($workspacePath)
    }

    $normalizedRepoRoot = [System.IO.Path]::GetFullPath($repoRoot).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    ) + [System.IO.Path]::DirectorySeparatorChar
    $normalizedWorkspace = $resolvedWorkspacePath.TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    ) + [System.IO.Path]::DirectorySeparatorChar
    $workspaceComparison = if ($IsWindows) { [System.StringComparison]::OrdinalIgnoreCase } else { [System.StringComparison]::Ordinal }

    if (-not $normalizedWorkspace.StartsWith($normalizedRepoRoot, $workspaceComparison)) {
        Write-Warning "[cleanup-git-refs] Skipping workspace dir outside repo root: $workspaceDir"
        $workspaceResults += [pscustomobject]@{
            Directory = $normalizedWorkspaceDir
            Result    = 'SKIPPED_UNSAFE'
        }
        continue
    }

    $workspaceResult = Remove-EmptyDirectoryWithRetry -Path $workspacePath -Retries $MaxRetries -DelayMs $RetryDelayMs

    $workspaceResults += [pscustomobject]@{
        Directory = $normalizedWorkspaceDir
        Result    = $workspaceResult
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