---
description: 'Required formatting rules for GitHub PR/issue comments and checklists posted by AI agents'
applyTo: '**'
---

# GitHub Comment Formatting Instructions

## Goal

Ensure PR/issue comments are human-readable Markdown on first post, especially checklists.

## Required Rules

1. Use real multiline Markdown in final comments.
2. Do not post literal escape sequences like `\\n`, `\\t`, or JSON-escaped text in comment bodies.
3. For checklists, each item must be on its own line using `- [ ]` syntax.
4. Prefer writing comment bodies to UTF-8 `.md` files and posting with `--body-file`.
5. Immediately verify rendered/stored body after posting:
   - `gh api ... --jq .body` or
   - `gh pr view --comments`
6. If formatting is garbled, patch the same comment in place immediately.

## Safe Posting Patterns

### Reusable script (preferred for this repo)

Use the repository helper to post, verify, and patch in-place automatically:

```powershell
pwsh ./scripts/post-gh-comment-safe.ps1 \
   -Repo <owner>/<repo> \
   -TargetType pr \
   -PrNumber <pr-number> \
   -BodyFile <path-to-markdown-body>
```

For issue comments:

```powershell
pwsh ./scripts/post-gh-comment-safe.ps1 \
   -Repo <owner>/<repo> \
   -TargetType issue \
   -IssueNumber <issue-number> \
   -BodyFile <path-to-markdown-body>
```

### PowerShell with `--body-file` (preferred)

```powershell
$commentPath = Join-Path $env:TEMP "pr-comment.md"
$body = @'
Verification checklist:
- [ ] Item one
- [ ] Item two
'@

Set-Content -Path $commentPath -Value $body -Encoding utf8
gh pr comment <pr-number> --body-file "$commentPath"

# Verify after posting
gh pr view <pr-number> --comments
```

### PowerShell here-string (allowed fallback)

```powershell
$body = @'
Verification checklist:
- [ ] Item one
- [ ] Item two
'@

gh pr comment <pr-number> --body "$body"
```

### `gh api` patch/post

Use file upload for patching when possible:

```powershell
gh api repos/<owner>/<repo>/issues/comments/<id> --method PATCH -F "body=@$commentPath"
```

Alternative with variable:

```powershell
gh api repos/<owner>/<repo>/issues/comments/<id> --method PATCH -f "body=$body"
```

## Anti-Patterns (forbidden)

- Posting `\n` as visible text in comments.
- Building checklists as single-line escaped strings.
- Using `--body "...\\n..."` for multiline comments when `--body-file` is available.
- Skipping verification after posting.
