[CmdletBinding(DefaultParameterSetName = 'IssueByText')]
param(
    [Parameter(Mandatory = $true)]
    [string]$Repo,

    [Parameter(Mandatory = $true, ParameterSetName = 'IssueByText')]
    [Parameter(Mandatory = $true, ParameterSetName = 'IssueByFile')]
    [Parameter(Mandatory = $true, ParameterSetName = 'PrByText')]
    [Parameter(Mandatory = $true, ParameterSetName = 'PrByFile')]
    [ValidateSet('issue', 'pr')]
    [string]$TargetType,

    [Parameter(Mandatory = $true, ParameterSetName = 'IssueByText')]
    [Parameter(Mandatory = $true, ParameterSetName = 'IssueByFile')]
    [int]$IssueNumber,

    [Parameter(Mandatory = $true, ParameterSetName = 'PrByText')]
    [Parameter(Mandatory = $true, ParameterSetName = 'PrByFile')]
    [int]$PrNumber,

    [Parameter(Mandatory = $true, ParameterSetName = 'IssueByText')]
    [Parameter(Mandatory = $true, ParameterSetName = 'PrByText')]
    [string]$Body,

    [Parameter(Mandatory = $true, ParameterSetName = 'IssueByFile')]
    [Parameter(Mandatory = $true, ParameterSetName = 'PrByFile')]
    [string]$BodyFile,

    [switch]$KeepTempFile,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Normalize-Text {
    param([string]$Text)

    if ($null -eq $Text) {
        return ''
    }

    return ($Text -replace "`r`n", "`n").TrimEnd("`n")
}

function Convert-CommandOutputToString {
    param($Value)

    if ($null -eq $Value) {
        return ''
    }

    if ($Value -is [System.Array]) {
        return [string]::Join("`n", @($Value | ForEach-Object { [string]$_ }))
    }

    return [string]$Value
}

function Get-CommentIdFromUrl {
    param([string]$CommentUrl)

    if ([string]::IsNullOrWhiteSpace($CommentUrl)) {
        return $null
    }

    $match = [regex]::Match($CommentUrl, 'issuecomment-(\d+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($match.Success) {
        return [int64]$match.Groups[1].Value
    }

    return $null
}

function Get-LatestIssueComment {
    param(
        [string]$Repository,
        [int]$Number,
        [string]$ViewerLogin
    )

    $raw = gh api "repos/$Repository/issues/$Number/comments" --paginate --slurp --jq 'add'
    $comments = $raw | ConvertFrom-Json
    if ($null -eq $comments) {
        return $null
    }

    $mine = @($comments | Where-Object { $_.user.login -eq $ViewerLogin })
    if ($mine.Count -eq 0) {
        return $null
    }

    return $mine[-1]
}

if ($TargetType -eq 'issue' -and $PSCmdlet.ParameterSetName -like 'Pr*') {
    throw 'Use -IssueNumber with -TargetType issue.'
}

if ($TargetType -eq 'pr' -and $PSCmdlet.ParameterSetName -like 'Issue*') {
    throw 'Use -PrNumber with -TargetType pr.'
}

if ($PSCmdlet.ParameterSetName -like '*ByFile' -and -not (Test-Path -LiteralPath $BodyFile)) {
    throw "Body file not found: $BodyFile"
}

$resolvedBodyFile = if ($PSCmdlet.ParameterSetName -like '*ByFile') {
    (Resolve-Path -LiteralPath $BodyFile).Path
} else {
    Join-Path ([System.IO.Path]::GetTempPath()) ("gh-comment-{0}.md" -f ([Guid]::NewGuid().ToString('N')))
}

$createdTemp = $false
if ($PSCmdlet.ParameterSetName -like '*ByText') {
    [System.IO.File]::WriteAllText($resolvedBodyFile, $Body, [System.Text.UTF8Encoding]::new($false))
    $createdTemp = $true
}

$targetNumber = if ($TargetType -eq 'issue') { $IssueNumber } else { $PrNumber }
$expectedRaw = Get-Content -LiteralPath $resolvedBodyFile -Raw
$expectedNormalized = Normalize-Text -Text $expectedRaw

if ($DryRun) {
    Write-Host "[safe-comment] dry-run target=$TargetType number=$targetNumber repo=$Repo"
    Write-Host "[safe-comment] body_file=$resolvedBodyFile"
    exit 0
}

$viewer = gh api user --jq .login
if ([string]::IsNullOrWhiteSpace($viewer)) {
    throw 'Unable to resolve authenticated GitHub user login via gh api user.'
}

try {
    Write-Host "[safe-comment] posting via --body-file to $TargetType #$targetNumber in $Repo" -ForegroundColor Cyan

    if ($TargetType -eq 'issue') {
        $postOutput = gh issue comment $targetNumber --repo $Repo --body-file $resolvedBodyFile
    } else {
        $postOutput = gh pr comment $targetNumber --repo $Repo --body-file $resolvedBodyFile
    }

    $commentUrl = ($postOutput | Select-Object -Last 1).Trim()
    $commentId = Get-CommentIdFromUrl -CommentUrl $commentUrl

    if ($null -eq $commentId) {
        Write-Host '[safe-comment] comment URL did not include issuecomment id; falling back to latest user comment lookup.' -ForegroundColor Yellow
        $fallback = Get-LatestIssueComment -Repository $Repo -Number $targetNumber -ViewerLogin $viewer
        if ($null -eq $fallback) {
            throw 'Unable to locate newly posted comment for verification.'
        }

        $commentId = [int64]$fallback.id
        $verifiedBody = [string]$fallback.body
    } else {
        $verifiedBodyRaw = gh api "repos/$Repo/issues/comments/$commentId" --jq .body
        $verifiedBody = Convert-CommandOutputToString -Value $verifiedBodyRaw
    }

    $verifiedNormalized = Normalize-Text -Text $verifiedBody

    if ($verifiedNormalized -ne $expectedNormalized) {
        Write-Host '[safe-comment] mismatch detected, patching same comment in place...' -ForegroundColor Yellow
        gh api "repos/$Repo/issues/comments/$commentId" --method PATCH -F "body=@$resolvedBodyFile" | Out-Null
        $patchedBodyRaw = gh api "repos/$Repo/issues/comments/$commentId" --jq .body
        $patchedBody = Convert-CommandOutputToString -Value $patchedBodyRaw
        $patchedNormalized = Normalize-Text -Text $patchedBody

        if ($patchedNormalized -ne $expectedNormalized) {
            throw "Comment body still mismatched after patch. comment_id=$commentId"
        }

        Write-Host "[safe-comment] patch verified. comment_id=$commentId" -ForegroundColor Green
    } else {
        Write-Host "[safe-comment] verified on first post. comment_id=$commentId" -ForegroundColor Green
    }

    $finalUrl = if ($commentUrl) { $commentUrl } else { "https://github.com/$Repo/issues/$targetNumber#issuecomment-$commentId" }
    Write-Output $finalUrl
}
finally {
    if ($createdTemp -and -not $KeepTempFile -and (Test-Path -LiteralPath $resolvedBodyFile)) {
        Remove-Item -LiteralPath $resolvedBodyFile -Force
    }
}
