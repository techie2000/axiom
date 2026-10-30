---
description: 'How to resolve merge conflicts on main->dev, dev->uat and uat->prod promotion PRs'
applyTo: '.github/workflows/promote-*.yml'
---

# Resolving Conflicted Promotion PRs

Promotion PRs (`main -> dev`, `dev -> uat`, `uat -> prod`) use a long-lived branch as the
PR head, so you cannot push a fix to the head. Instead, open a **replacement PR** from a
`resolve/*` branch. Worked examples: #697 (replaced by #791) and #699 (replaced by #794).

## Procedure

1. Fetch, then branch from the **base** of the conflicted PR:
   `git checkout -b resolve/pr<N>-<head>-into-<base> origin/<base>`
2. Merge the PR's head in: `git merge --no-commit --no-ff origin/<head>`
3. Resolve the conflicts (see below), then commit with a message ending in
   `(replaces #<N>)`.
4. Push and open a PR to `<base>` titled `chore: resolve conflicts for <head> -> <base>
   promotion (replaces #<N>)`.
5. Add the labels `automated`, `no-issue-needed` and `type:chore`. The promotion
   workflows add these to their own PRs; a hand-opened PR does not get them.
6. Merge with a **merge commit** (not squash), so promoted history is preserved.
7. Close the superseded PR with a comment pointing to the replacement.

The `resolve/` prefix matters: `enforce-branch-flow` only allows non-promotion heads that
start with `resolve/` (same repo only). Any other name is blocked unless the PR carries the
`hotfix`/`emergency` exception, which also triggers the backport gate.

## Deciding which side wins

The side that is **ahead** usually wins; check which one that is rather than assuming.
`main -> dev` and `dev -> uat` conflicts have both gone to the head branch.

- Dependency manifests, lockfiles, `go.mod`/`go.sum`, `security-versions.yml`, and
  `actions/github-script` versions: take the newer side.
- Code conflicts (for example swagger host handling, LEI entity-status validation): read
  both sides; the newer side has included follow-up review fixes.
- Modify/delete conflicts: find out why the file was deleted (`git log` on the deleting
  side) and accept the deletion if it was merged or renamed, not silently dropped.
- Word lists such as `.vscode/axiom-words.txt`: keep both sides; the pre-commit hook
  sorts and de-duplicates.
- `git checkout --theirs` is `<head>` during `git merge origin/<head>`; `--ours` is `<base>`.

## Verify before pushing

- `cd backend && go build ./... && go vet ./cmd/api ./internal/service && go mod verify`
- If a lockfile or `package.json` changed, run `npm ci` and the build in `frontend/` and
  `docs-user/`.
- Search for leftover markers in source files (exclude `.venv`, `node_modules`, `data/`).

## Gotchas

- `pull_request_target` workflows read their definition from `main`, not the PR base. A
  change to a branch-flow or backport check must land on `main` (and `dev`) to affect
  replacement PRs; re-running a job reuses the old workflow, so edit the PR (title or
  label) to trigger a fresh run.
- Do not copy a whole file from another branch to resolve a workflow change; apply the
  patch instead, or you will revert unrelated newer changes such as action version bumps.
