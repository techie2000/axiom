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

    [switch]$PruneEmptyParents
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-RepoRoot {
    param([string]$Path)

    $resolvedPathObj = Resolve-Path -LiteralPath $Path -ErrorAction SilentlyContinue
    if (-not $resolvedPathObj) {
        throw "Path not found: $Path"
    }
    $resolvedPath = $resolvedPathObj.Path

    # First, try to use git itself to determine the repo root. This correctly handles worktrees and submodules.
    try {
        $gitCmd = Get-Command git -ErrorAction Stop
        $gitTopLevel = & $gitCmd.Path -C $resolvedPath rev-parse --show-toplevel 2>$null
        if ($LASTEXITCODE -eq 0 -and $gitTopLevel) {
            return (Resolve-Path -LiteralPath $gitTopLevel.Trim()).Path
        }
    }
    catch {
        # If git is not available or rev-parse fails, fall back to filesystem checks below.
    }

    $gitPath = Join-Path $resolvedPath '.git'

    # Standard case: .git is a directory under the repo root.
    if (Test-Path -LiteralPath $gitPath -PathType Container) {
        return $resolvedPath
    }

    # Worktree/submodule case: .git is a file containing a gitdir: pointer.
    if (Test-Path -LiteralPath $gitPath -PathType Leaf) {
        $firstLine = Get-Content -LiteralPath $gitPath -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($firstLine -and $firstLine -match '^\s*gitdir:\s*(.+)\s*$') {
            $gitDir = $Matches[1]
            if (-not [System.IO.Path]::IsPathRooted($gitDir)) {
                $gitDir = Join-Path $resolvedPath $gitDir
            }

            if (Test-Path -LiteralPath $gitDir -PathType Container) {
                # The working tree root is still $resolvedPath; we only needed to verify it's a valid Git repo.
                return $resolvedPath
            }
        }
    }

    throw "No .git directory or gitdir file found under: $Path"
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
                # On non-Windows platforms, clear attributes using PowerShell-native approach.
                # System and Hidden attributes are Windows concepts not typically set on POSIX filesystems,
                # so only ReadOnly needs clearing here.
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

$results = @()

foreach ($namespace in $Namespaces) {
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

    # Verify the resolved target path is actually inside .git to prevent escapes.
    $resolvedTargetObj = Resolve-Path -LiteralPath $target -ErrorAction SilentlyContinue
    if ($resolvedTargetObj) {
        $resolvedTarget = $resolvedTargetObj.Path
    }
    else {
        # Path doesn't exist yet; build the canonical form without resolving.
        $resolvedTarget = [System.IO.Path]::GetFullPath($target)
    }
    if (-not $resolvedTarget.StartsWith($gitRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Warning "[cleanup-git-refs] Skipping namespace that escapes .git root: $namespace"
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
        Remove-ParentDirectoriesIfEmpty -RepoRoot $repoRoot -RelativePath $normalized -Retries $MaxRetries -DelayMs $RetryDelayMs
    }
}

$results | Sort-Object Namespace | Format-Table -AutoSize

$stillPresent = @(
    $results | Where-Object { $_.Result -eq 'STILL_PRESENT' }
)

if ($stillPresent.Count -gt 0) {
    Write-Host "[cleanup-git-refs] WARNING: Some namespaces are still present (likely locked by sync/indexing)." -ForegroundColor Yellow
    exit 1
}

Write-Host "[cleanup-git-refs] Done." -ForegroundColor Green