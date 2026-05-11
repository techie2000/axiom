---
name: create-pull-request
description: >
  Create a GitHub Pull Request with automatic label application, reviewer
  assignment, and verification checklist. Encodes Axiom-specific PR hygiene:
  three-namespace labels, verification checklists, issue linking, and reviewer
  defaults.
context: fork
argument-hint: >
  Optionally specify a title, base branch, or whether to create as a draft
---

# Create a GitHub Pull Request

Prepare PR metadata, create the pull request, apply project labels and reviewer
defaults, and post verification checklist without asking for confirmation.

## When to Use

- The user wants to open a PR for their current or a specified branch
- The user has finished a feature or fix and wants to submit it for review
- The user wants to create a draft PR to share work in progress
- The user asks to "open a PR", "create a pull request", or "submit for
  review"

## Procedure

### 1. Gather Information

Determine the required parameters before calling the tool:

- **Head branch**: If the user has not specified a branch, use workspace or git
  context to find the current branch name. Do not use `owner:branch`
  format—pass just the branch name (e.g., `my-feature`).
- **Base branch**: If the user has not specified a base branch, omit it and let
  the tool use the repository's default branch.
- **Title**: If the user has not provided a title, derive one from the branch
  name, recent commits, or the user's description of their work.
- **Body**: If the user has not provided a description, prepare a concise
  summary of what changed and why.
- **Draft**: Ask or infer whether the PR should be a draft. Default to
  non-draft unless the user indicates the work is not ready for review.

### 2. Check for Uncommitted or Unpushed Changes

Before creating the PR, inspect the working tree state.

1. **Check for uncommitted changes**: Use git or VS Code SCM to determine
   whether there are staged or unstaged file changes. If yes, ask the user to
   commit them or clarify if there are already commits on the branch ahead of
   base.
2. **Check for unpushed commits**: Determine whether the local branch has
   commits not pushed to remote. If yes, push before calling the tool.
3. **Confirm the branch is on the remote**: The create tool requires the head
   branch to be present on the remote.

If all changes are already committed and pushed, proceed to the next step.

### 3. Prepare PR Details

Write a good title and description if the user has not provided them:

**Title**: Use imperative mood, keep it under 72 characters, describe what the
PR does (e.g., `Add retry logic for failed API requests`).

**Body**: Include:

- A short summary of what changed and why
- Any relevant issue references (e.g., `Fixes #123`, `Refs #123`)
- Notable implementation decisions if useful for the reviewer

### 4. Create the PR

Use the `github-pull-request_create_pull_request` tool with the gathered
parameters. Capture the PR URL and number from the result.

### 5. Apply Project Labels (Automatic)

**DO NOT ask for confirmation.** Apply labels based on changed files and PR
context:

#### Label Taxonomy

Three-namespace system:

1. **Category** (optional, max one): Add only if it conveys information not
   already implied by Area
   - `bug` — defect fix
   - `enhancement` — new feature or capability
   - `security` — security issue or fix
   - `performance` — performance improvement
   - `question` — unclear or needs clarification

2. **Area** (required, exactly one): Inferred from changed files or let CI
   auto-detect
   - `area:backend` — Go backend code changes
   - `area:frontend` — React/Next.js frontend changes
   - `area:database` — migrations, schema, or DB-related
   - `area:docs` — documentation and guides
   - `area:infra` — Docker, Docker Compose, infrastructure
   - `area:ci` — GitHub Actions workflows
   - `area:lei` — LEI-specific features
   - `area:dependencies` — dependency updates

3. **Type** (optional secondary, one or two):
   - `type:tests` — test additions or modifications
   - `type:refactor` — code restructuring without behavior change
   - `type:chore` — maintenance, tooling

#### Special Labels

- `automated` — mark AI-created items
- `no-issue-needed` — for PRs with no backing issue
- `hotfix` — for replacement promotion branches (e.g.,
  `fix/sync-dev-from-main-*` targeting `dev` without correct source). Combine
  with `no-issue-needed` **immediately at PR creation** before CI checks run.

#### Application Logic

1. Determine Area from changed files:
   - `backend/**/*.go` → `area:backend`
   - `frontend/**/*.{ts,tsx,js,jsx}` → `area:frontend`
   - `backend/migrations/**` → `area:database`
   - `docs/**/*.md` → `area:docs`
   - `docker/**` or `docker-compose*.yml` → `area:infra`
   - `.github/workflows/**` → `area:ci`
   - Files containing `lei` or `LEI` → `area:lei`
   - `go.mod`, `package.json`, `package-lock.json`, `go.sum` →
     `area:dependencies`

2. Infer Category from PR context:
   - PR title or body contains "security" or "vulnerability" → add `security`
   - PR title or body contains "performance" or "optimize" → add `performance`
   - PR title or body contains "bug" or "fix" → add `bug`
   - PR title or body contains "feature" or "add" → add `enhancement`

3. Infer Type from changed files:
   - `*_test.go` or `*.test.ts` or `*.test.tsx` → add `type:tests`
   - Only non-functional file changes (config, comments, formatting) →
     add `type:chore`

4. Add `automated` if this skill created the PR.

5. Avoid duplicate semantics: Do not add `documentation` when `area:docs` is present.

#### Label Application

```bash
gh pr edit <pr-number> --repo techie2000/axiom --add-label "label1,label2,label3"
```

### 6. Request Reviewer (Automatic)

**DO NOT ask for confirmation.** Request the default reviewer:

```bash
gh pr edit <pr-number> --repo techie2000/axiom --add-reviewer copilot-pull-request-reviewer
```

If the reviewer handle is unavailable, note it but proceed.

### 7. Post Verification Checklist (Automatic)

**DO NOT ask for confirmation.** Post a concise checklist comment relevant to the changed files.

Examples by area:

**Backend (`area:backend`)**:

```text
✅ Verification Checklist

- [ ] Tests added/updated (`go test ./... -v`)
- [ ] Build passes (`make build`)
- [ ] No SQL injection or security issues
- [ ] Transaction safety verified
- [ ] Error handling complete
```

**Frontend (`area:frontend`)**:

```text
✅ Verification Checklist

- [ ] UI renders correctly in light/dark mode
- [ ] i18n keys added (no hardcoded text)
- [ ] Tested in Chrome, Firefox, Safari
- [ ] Mobile responsive verified
- [ ] Accessibility (ARIA, keyboard navigation) checked
```

**Database (`area:database`)**:

```text
✅ Verification Checklist

- [ ] `.up.sql` migration present
- [ ] `.down.sql` rollback migration present
- [ ] Naming follows `XXXXXX_description` pattern
- [ ] Tested locally with `make migrate-up` / `make migrate-down`
```

**Infrastructure (`area:infra`)**:

```text
✅ Verification Checklist

- [ ] Docker image builds: `docker build -f Dockerfile.backend`
- [ ] docker-compose starts without errors
- [ ] Health checks configured
- [ ] Environment variables documented
```

Use `gh pr comment <pr-number> --body "..."` or the safe comment helper if available.

### 8. Post to Linked Issues (Automatic)

If the PR body references linked issues (e.g., `Refs #123`, `Fixes #456`):

For each linked issue that is confirmed to be an **issue** (not a PR):

```bash
gh issue comment <issue-number> --repo techie2000/axiom --body "..."
```

Issue update body template:

```markdown
**PR Status**: Implementation started

- PR: [#<pr-number>](https://github.com/techie2000/axiom/pull/<pr-number>)
- Branch: `<branch-name>`
- Validation: Pending

**For Testing**: See PR description for test commands and validation steps.
```

---

## Best Practices

1. **Imperative title**: "Add X", "Fix Y", "Update Z"
2. **Link issues early**: Use `Fixes #123` or `Refs #123` in the body
3. **Explain the why**: Not just what changed, but why
4. **No asking**: Label, review, and checklist are automatic

---

## See Also

- `copilot-instructions.md` - PR finalization defaults
- `code-review-generic.instructions.md` - Review standards
