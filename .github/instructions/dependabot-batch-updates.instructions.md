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
5. Keep `.github/security-versions.yml` in step (see `security-versions.instructions.md`). For every bumped
   package or module that already has an entry there (including indirect ones such as `x/mod`, `x/net`,
   `x/tools`), set `version` to the resolved version and `updated` to the bump commit's date, in the same
   commit. Do not add entries for untracked packages.
6. Check the resolved versions in the lockfiles match what you intend to claim in the PR table. Packages that
   ship as a family (e.g. `vue` and `@vue/*`) must be bumped together, otherwise the lockfile keeps the old
   versions.

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
- In the "Linked Work" section, list the refs one per line as a bullet list, not one long comma-separated
  sentence, so they are easy to scan:

  ```markdown
  - Issue(s):
    - Refs #712
    - Refs #713
  ```

- Check "No linked issue" in the PR template with reason "Dependabot".

## Step 6: Copilot Review Loop

Copilot reviews the PR automatically. Handle its feedback without waiting to be asked, following
`copilot-pr-feedback-resolution.instructions.md` (use the `address-pr-comments` skill where available).
Pushing the approved PR and fixing review feedback on it are part of this workflow and need no extra approval.

Fixes and replies can trigger a new Copilot review with new conversations, so treat this as a loop:

1. List unresolved threads:
   `gh api graphql` on `repository.pullRequest.reviewThreads` (`isResolved`, first comment `databaseId`).
2. For each thread, check the claim against the repo before acting. If it is valid, fix it. If it is wrong or
   out of scope, reply with the reason instead of changing code.
3. Re-run the Step 4 validation for anything touched, commit, and push.
4. Reply in each thread (`gh api repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies`), then resolve it
   (`resolveReviewThread` mutation).
5. Post one summary comment per round (`gh pr comment`).
6. Wait for CI and for Copilot to review the new commit (`gh pr checks`, then re-list threads). If new threads
   appeared, go back to step 1.

Stop the loop when any of these is true, then report to the user:

- No unresolved threads remain on the latest commit and CI is green.
- Three rounds have completed and new threads are still appearing. Summarise what keeps recurring.
- A thread asks for something that conflicts with the plan the user approved, or a major bump or scope
  change. Do not apply it; ask the user.
- Two consecutive rounds raise the same issue. The fix is not landing, so stop and ask.

Do not merge the PR while any thread is unresolved or CI is failing. Merging stays with the user.

## Step 7: Pre-Merge Check

Green CI and resolved threads are not enough. Immediately before merging:

1. Confirm the PR contains only what was intended:
   `gh pr view N --json files,commits --jq '[.files[].path], [.commits[].messageHeadline]'`
2. Every file and commit must belong to the batch. If something unexpected is there (for example a commit from
   another session sharing the working directory), stop and ask the user before merging.
3. Before each `git commit`, run `git branch --show-current` to confirm the branch, and use `git show --stat HEAD`
   afterwards to confirm the commit holds only the intended files.

## Step 8: After Merge

Once the PR is merged, close the superseded Dependabot PRs with a comment pointing at the batch PR
(with user approval), then follow `pr-merge-cleanup.instructions.md`.
