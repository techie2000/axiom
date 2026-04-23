---
name: github-issues
description: 'Create, update, and manage GitHub issues using MCP tools. Use this skill when users want to create bug reports, feature requests, or task issues, update existing issues, add labels/assignees/milestones, or manage issue workflows. Triggers on requests like "create an issue", "file a bug", "request a feature", "update issue X", or any GitHub issue management task.'
---

# GitHub Issues

Manage GitHub issues using the `@modelcontextprotocol/server-github` MCP server.

## Available MCP Tools

| Tool                             | Purpose                |
| -------------------------------- | ---------------------- |
| `mcp__github__create_issue`      | Create new issues      |
| `mcp__github__update_issue`      | Update existing issues |
| `mcp__github__get_issue`         | Fetch issue details    |
| `mcp__github__search_issues`     | Search issues          |
| `mcp__github__add_issue_comment` | Add comments           |
| `mcp__github__list_issues`       | List repository issues |

## Workflow

1. **Determine action**: Create, update, or query?
2. **Gather context**: Get repo info, existing labels, milestones if needed
3. **Check for duplicates before create**:
  Search recent open issues for the same feature, bug, or wording before opening a new one
4. **Structure content**: Use appropriate template from [references/templates.md](references/templates.md)
5. **Execute**: Call the appropriate MCP tool
6. **Confirm**: Report the issue URL to user

## Duplicate Check

Before creating a new issue:

- Search open issues for the main nouns and verbs from the request
- Compare against issues created earlier in the same session when the topic is closely related
- If a matching issue already exists, prefer updating or referencing it instead of creating a new one
- If you intentionally create a follow-on issue, explicitly reference the parent or predecessor issue in the body

## Creating Issues

### Required Parameters

```text
owner: repository owner (org or user)
repo: repository name
title: clear, actionable title
body: structured markdown content
```

### Optional Parameters

```text
labels: ["bug", "enhancement", "documentation", ...]
assignees: ["username1", "username2"]
milestone: milestone number (integer)
```

### Title Guidelines

- Prefer an action-oriented title that states the change or broken behavior directly
- Keep the title under 72 characters when possible
- Avoid weak starters such as `bug`, `issue`, `problem`, `help`, `feature request`, or `task`
- Do not restate the entire template in the title; keep environment, repro steps, and long context in the body
- Use these preferred patterns:
  - Bug: `Fix <broken behavior> when <condition>`
  - Feature: `Add <capability> for <user or workflow>`
  - Task: `Update <artifact or workflow> to <outcome>`
  - Docs: `Document <topic or workflow>`
- Add a short type prefix only when it improves scanning consistency: `[Bug]`, `[Feature]`, `[Task]`, `[Docs]`
- Examples:
  - `[Bug] Fix SSO login redirect loop after session timeout`
  - `[Feature] Add dark mode preference for admin pages`
  - `[Task] Update auth module tests for token refresh flow`
  - `[Docs] Document LEI import recovery procedure`

### Body Structure

Always use the templates in [references/templates.md](references/templates.md). Choose based on issue type:

| User Request                    | Template        |
| ------------------------------- | --------------- |
| Bug, error, broken, not working | Bug Report      |
| Feature, enhancement, add, new  | Feature Request |
| Task, chore, refactor, update   | Task            |

## Updating Issues

Use `mcp__github__update_issue` with:

```text
owner, repo, issue_number (required)
title, body, state, labels, assignees, milestone (optional - only changed fields)
```

State values: `open`, `closed`

### Label Lifecycle

- New issues should keep one lifecycle label only: `status: triage`
- When work starts on a linked issue, replace `status: triage` with `status: in progress`
- When the linked PR merges, replace `status: in progress` with `status: done`
- If work stops and the linked PR closes without merge, move the issue back to `status: triage`
- Preserve category labels such as `bug`, `enhancement`, `security`, and `performance`
- For documentation-focused work, use `area:docs` instead of adding a duplicate `documentation` label

## Examples

### Example 1: Bug Report

**User**: "Create a bug issue - the login page crashes when using SSO"

**Action**: Call `mcp__github__create_issue` with:

```json
{
  "owner": "github",
  "repo": "awesome-copilot",
  "title": "[Bug] Login page crashes when using SSO",
  "body": "## Description\nThe login page crashes when users attempt to authenticate using SSO.\n\n## Steps to Reproduce\n1. Navigate to login page\n2. Click 'Sign in with SSO'\n3. Page crashes\n\n## Expected Behavior\nSSO authentication should complete and redirect to dashboard.\n\n## Actual Behavior\nPage becomes unresponsive and displays error.\n\n## Environment\n- Browser: [To be filled]\n- OS: [To be filled]\n\n## Additional Context\nReported by user.",
  "labels": ["bug"]
}
```

### Example 2: Feature Request

**User**: "Create a feature request for dark mode with high priority"

**Action**: Call `mcp__github__create_issue` with:

```json
{
  "owner": "github",
  "repo": "awesome-copilot",
  "title": "[Feature] Add dark mode support",
  "body": "## Summary\nAdd dark mode theme option for improved user experience and accessibility.\n\n## Motivation\n- Reduces eye strain in low-light environments\n- Increasingly expected by users\n- Improves accessibility\n\n## Proposed Solution\nImplement theme toggle with system preference detection.\n\n## Acceptance Criteria\n- [ ] Toggle switch in settings\n- [ ] Persists user preference\n- [ ] Respects system preference by default\n- [ ] All UI components support both themes\n\n## Alternatives Considered\nNone specified.\n\n## Additional Context\nHigh priority request.",
  "labels": ["enhancement", "high-priority"]
}
```

## Common Labels

Use these standard labels when applicable:

| Label | Use For |
| --- | --- |
| `bug` | Something isn't working |
| `enhancement` | New feature or improvement |
| `good first issue` | Good for newcomers |
| `help wanted` | Extra attention needed |
| `question` | Further information requested |
| `wontfix` | Will not be addressed |
| `duplicate` | Already exists |
| `high-priority` | Urgent issues |
| `status: triage` | Needs initial review |
| `status: in progress` | Actively being worked on |
| `status: done` | Work completed or merged |

## Area Labels

Exactly one `area:*` label is assigned. The CI workflow infers the primary area automatically
from changed file paths (for PRs) or from the first matching keyword (for issues).
Apply or correct it manually when the inference is wrong.

| Label                  | Assigned to                                     |
| ---------------------- | ----------------------------------------------- |
| `area:backend`         | Go services, handlers, repositories, domain     |
| `area:frontend`        | Next.js pages, React components, hooks          |
| `area:database`        | Migrations, SQL, schema changes                 |
| `area:docs`            | ADRs, READMEs, user-facing guides               |
| `area:infra`           | Docker, Compose, Dockerfile, nginx              |
| `area:ci`              | GitHub Actions workflows, Makefile              |
| `area:lei`             | LEI data pipeline and GLEIF feeds               |
| `area:dependencies`    | Dependency upgrades (Dependabot PRs)            |

## Type Labels

Optional secondary labels to clarify intent beyond the area label.
The CI workflow infers `type:tests` and `type:chore` automatically;
apply others manually.

| Label            | Use For                                              |
| ---------------- | ---------------------------------------------------- |
| `type:tests`     | Adding or fixing test coverage, no product code      |
| `type:refactor`  | Code quality improvement, no behaviour change        |
| `type:chore`     | Maintenance, tooling, config-only updates            |

> **Tests and area together:** A backend change that also ships tests should carry
> `area:backend` as the primary label and optionally `type:tests` as a secondary.
> Use `type:tests` as the *primary* label only when no product code is touched at all.

## PR Issue Link and Override

PRs should reference a linked issue in the PR description. Prefer `Refs #N` by default.
Use closing keywords only when `#N` is confirmed to be an issue (not a pull request).

```text
Refs #7
Closes #123  (issue only)
Fixes #42    (issue only)
```

If no backing issue exists, check the **No linked issue** box in the PR template and
state a brief reason (hotfix, chore, Dependabot, etc.).
Bot-authored PRs (Dependabot, github-actions) are exempt automatically via
the `no-issue-needed` label applied during auto-labeling.

## Status Labels

The CI workflow manages status labels automatically from linked PR state.
Do not apply these manually unless correcting an incorrect state.

| Label                   | Meaning                            |
| ----------------------- | ---------------------------------- |
| `status: triage`        | Needs initial review               |
| `status: in progress`   | Linked PR is open and active       |
| `status: done`          | Linked PR merged                   |

## Comment Body Safety (REQUIRED)

When posting or updating issue/PR comments from terminal commands, always use real
multiline Markdown bodies and verify the stored comment text immediately.

Required workflow:

1. Build body text with real newlines.
2. Prefer writing the body to a UTF-8 markdown file and pass it with `--body-file`.
3. If you must use a variable, use a PowerShell here-string with real newlines.
4. Verify stored body immediately using `gh api ... --jq .body`.
5. If malformed (escaped newlines/control chars), patch the same comment in place.
6. Do not post a replacement duplicate unless explicitly requested.

Preferred PowerShell pattern (most reliable):

```powershell
$commentPath = Join-Path $env:TEMP "gh-comment-body.md"
$body = @'
## Update

- Item one
- Item two
'@

Set-Content -Path $commentPath -Value $body -Encoding utf8
gh issue comment 123 --repo owner/repo --body-file "$commentPath"

# Verify final stored body
gh issue view 123 --repo owner/repo --comments
```

Alternative pattern (allowed):

```powershell
$body = @'
## Update

- Item one
- Item two
'@

gh issue comment 123 --repo owner/repo --body "$body"
gh api repos/owner/repo/issues/comments/<comment_id> --jq .body
```

If verification finds visible escape sequences (for example `\\n`) or control-character artifacts,
patch the same comment immediately using a verified clean body file:

```powershell
gh api repos/owner/repo/issues/comments/<comment_id> --method PATCH -F "body=@$commentPath"
gh api repos/owner/repo/issues/comments/<comment_id> --jq .body
```

Never proceed without verification when posting reviewer-facing summaries or checklists.

Forbid these patterns:

- Inline escaped bodies such as `--body "line1\\nline2"`
- Posting and moving on without verification
- Creating duplicate replacement comments when an in-place patch is possible

Troubleshooting notes:

- If VS Code restarts and context is lost, re-run the verification command for the latest comment
  before posting any follow-up comment.
- Prefer `--body-file` over inline `--body` when content includes checklists, code blocks, or many lines.

## Tips

- Always confirm the repository context before creating issues
- Ask for missing critical information rather than guessing
- Link related issues when known: `Related to #123`
- For updates, fetch current issue first to preserve unchanged fields
