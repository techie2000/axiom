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
4. Prefer constructing bodies with actual newlines before sending to CLI/API.
5. Immediately verify rendered/stored body after posting:
   - `gh api ... --jq .body` or
   - `gh pr view --comments`
6. If formatting is garbled, patch the same comment in place immediately.

## Safe Posting Patterns

### PowerShell (preferred)
Use here-strings with real newlines:

```powershell
$body = @'
Verification checklist:
- [ ] Item one
- [ ] Item two
'@

gh pr comment <pr-number> --body "$body"
```

### `gh api` patch/post
Use a body variable that already contains real newlines:

```powershell
gh api repos/<owner>/<repo>/issues/comments/<id> --method PATCH -f "body=$body"
```

## Anti-Patterns (forbidden)

- Posting `\n` as visible text in comments.
- Building checklists as single-line escaped strings.
- Skipping verification after posting.
