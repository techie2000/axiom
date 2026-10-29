---
description: 'Workflow for triaging and batching open Dependabot PRs into a single validated PR'
applyTo: '**/package.json,**/package-lock.json,**/go.mod,**/go.sum,.github/dependabot.yml'
---

# Dependabot Batch Update Workflow

When asked to process open Dependabot PRs, triage them and apply the safe ones together in one branch
and one PR, instead of merging each PR separately.

## Approval Gate

- Triage (listing, reading PR bodies) is read-only and can be done freely.
- **Do not create branches, change files, push, or open PRs until the user approves the plan.**
- Do not close the superseded Dependabot PRs without asking first.

## Step 1: Triage

```bash
gh pr list --author "app/dependabot" --state open --json number,title,mergeable,statusCheckRollup
```

Classify each PR:

| Class | Criteria | Action |
| --- | --- | --- |
| Safe | Patch or minor bump, same major version, checks green | Include in the batch |
| Review | Grouped PR, `0.x` version, or security-sensitive library (e.g. `x/crypto`) | Read PR body and release notes |
| Not safe | Major version bump | Exclude; needs its own PR |

Rules of thumb:

- Packages that must move together (e.g. `vitest` and `@vitest/coverage-v8`) are classified together;
  if one is a major bump, both are excluded.
- Read grouped PR bodies (`gh pr view N --json body`) to see every package and version they contain.
- If two PRs touch the same package, keep the newer target version and treat the other as superseded.
- Check the PR targets are still current: other Dependabot PRs may already have merged to `main`.

## Step 2: Present the Plan

Summarise the safe, review, and excluded PRs and ask for approval before changing anything.

## Step 3: Apply in a Single Branch

1. `git fetch` and branch from `origin/main` (not a stale local `main`):
   `git checkout -B deps/safe-bumps-YYYY-MM-DD origin/main --no-track`.
2. Leave unrelated uncommitted changes alone and stage only dependency files.
3. Frontend (`/frontend`, `/docs-user`): use `npm install <pkg>@<version>` for direct dependencies
   and `npm update <pkg>` for transitive ones.
   - Keep exact pins exact (e.g. `next` is pinned without a caret) and do not let npm reorder `package.json`.
4. Backend (`/backend`): `go get <module>@<version>` then `go mod tidy`.

## Step 4: Validate

All of these must pass before opening the PR:

```bash
# backend
cd backend && go build ./... && go vet ./... && go test ./...

# frontend
cd frontend && npx tsc --noEmit && npm run lint && npm test && npm run build
```

If a bump breaks something, drop that bump from the branch, note it in the PR, and leave its Dependabot PR open.

## Step 5: Open One PR

- Title: `build(deps): apply safe dependency updates (YYYY-MM-DD)`
- List every bump (package, old version, new version, originating Dependabot PR) and the validation results.
- Use `Refs #N` for the Dependabot PRs. Never use `Closes`/`Fixes` for PRs (see the PR template).
- Check "No linked issue" in the PR template with reason "Dependabot".

## Step 6: After Merge

Once the PR is merged, close the superseded Dependabot PRs with a comment pointing at the batch PR
(with user approval), then follow `pr-merge-cleanup.instructions.md`.
