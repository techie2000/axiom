---
post_title: "Git Branching Strategy"
author1: "techie2000"
post_slug: "branching-strategy"
microsoft_alias: "techie2000"
featured_image: "https://placehold.co/1200x630.png"
categories: ["devops"]
tags: ["git", "branching", "workflow", "contributing"]
ai_note: "AI-assisted draft based on repository state and user request."
summary: "Day-to-day guide for working with Axiom's trunk-based branching strategy and environment
  promotion branches."
post_date: "2026-02-24"
---

## Overview

Axiom uses a **trunk-based strategy with environment promotion branches**. The short version:

- `main` is where you branch from and merge back to — it is always the integration baseline.
- `dev`, `uat`, and `prod` are long-lived promotion gates that track what is deployed in each
  environment.
- Short-lived branches (`feature/*`, `bugfix/*`, `hotfix/*`, `chore/*`) live only as long as
  the work they carry.

For the architectural rationale see
[ADR-0009](../adr/adr-0009-git-branching-strategy.md).

---

## Branch Reference

| Branch | Role | Protected | Who merges |
| ------ | ---- | --------- | ---------- |
| `main` | Active development integration (trunk) | ✅ Yes | PR only |
| `dev` | Mirrors the dev environment | ✅ Yes | PR from `main` |
| `uat` | Mirrors the UAT environment | ✅ Yes | PR from `dev` |
| `prod` | Mirrors the production environment | ✅ Yes | PR from `uat` |
| `feature/*` | New feature work | ❌ No | Deleted after merge |
| `bugfix/*` | Non-urgent bug fixes | ❌ No | Deleted after merge |
| `hotfix/*` | Urgent production fixes | ❌ No | Deleted after merge |
| `chore/*` | Maintenance, deps, docs, refactor | ❌ No | Deleted after merge |

---

## Day-to-Day Workflows

### Starting new work

Always branch from `main`:

```bash
git checkout main
git pull origin main
git checkout -b feature/my-new-feature   # or bugfix/..., chore/..., etc.
```

### Submitting work

Push your branch and open a pull request targeting **`main`**:

```bash
git push origin feature/my-new-feature
# Open PR: feature/my-new-feature → main
```

Delete the branch after merge (GitHub does this automatically when the "Delete branch" button is
clicked or the repository setting is enabled).

### Promoting to dev

`main` → `dev` promotions happen **automatically every night** via the
[`promote-main-to-dev` workflow](../../.github/workflows/promote-main-to-dev.yml).

The workflow runs at **01:00 UTC daily** — deliberately scheduled one hour *before* the GLEIF
LEI full-sync job (02:00 UTC) so that if new code on `main` introduces any issues, they are
caught immediately when the importer runs against the freshly promoted `dev` environment. The
00:00 slot (LEI cleanup default) and 03:00 slot (`LEI_CLEANUP_TIME` override) are already taken
by application scheduler jobs. When `main` is ahead of `dev`, it opens a pull request titled
`chore: nightly promotion main → dev (YYYY-MM-DD)`. Review the diff, confirm CI passes,
and merge to deploy to the dev environment. If no promotion is needed that day, the workflow exits
without creating a PR. If a promotion PR is already open, no duplicate is created.

You can also trigger the workflow manually from **Actions → Nightly Promote main → dev →
Run workflow**. A `dry_run` option is available to see whether a PR _would_ be created without
actually creating one.

To promote immediately outside the nightly window, open a PR manually:

```text
main → dev
```

### Promoting to UAT

`dev` → `uat` promotions happen **automatically every Monday** via the
[`promote-dev-to-uat` workflow](../../.github/workflows/promote-dev-to-uat.yml).

The workflow runs at **01:00 UTC every Monday**. When `dev` is ahead of `uat`, it opens a pull
request titled `chore: weekly promotion dev → uat (YYYY-MM-DD)`. Obtain **at least one review**
before merging. If `uat` is already up to date, or a promotion PR is already open, no action is
taken.

You can also trigger the workflow manually from **Actions → Weekly Promote dev → uat →
Run workflow**. A `dry_run` option is available.

To promote immediately outside the weekly window, open a PR manually:

```text
dev → uat
```

### Promoting to production

`uat` → `prod` promotions happen **automatically on the 1st of each month** via the
[`promote-uat-to-prod` workflow](../../.github/workflows/promote-uat-to-prod.yml).

The workflow runs at **01:00 UTC on the 1st of every month**. When `uat` is ahead of `prod`, it
opens a pull request titled `chore: monthly promotion uat → prod (YYYY-MM-DD)`. Require **at
least two reviews** before merging. Coordinate with the team before merging — production
deployments should be planned and communicated in advance. Tag the merge commit with a version
number following the conventions in [`VERSION`](../../VERSION) and the version management
instructions.

You can also trigger the workflow manually from **Actions → Monthly Promote uat → prod →
Run workflow**. A `dry_run` option is available.

To promote immediately outside the monthly window, open a PR manually:

```text
uat → prod
```

---

## Hotfix Workflow

Use this when a critical issue must be fixed in production without waiting for the normal
`main → dev → uat → prod` pipeline.

```bash
# 1. Branch from prod
git checkout prod
git pull origin prod
git checkout -b hotfix/short-description

# 2. Fix, test, commit
# ...

# 3. PR: hotfix/short-description → prod
#    (requires at least one review)

# 4. After merging to prod, back-merge to main so the fix is not lost
git checkout main
git pull origin main
git merge --no-ff hotfix/short-description
git push origin main

# 5. Delete the hotfix branch
git push origin --delete hotfix/short-description
```

> **Important:** Always back-merge a hotfix into `main` immediately after it lands in `prod`.
> Skipping this step causes the fix to be overwritten during the next normal promotion.

---

## Branch Naming

| Prefix | When to use | Examples |
| ------ | ----------- | -------- |
| `feature/` | New functionality | `feature/lei-search-filter` |
| `bugfix/` | Non-urgent bug fixes | `bugfix/lei-status-badge` |
| `hotfix/` | Urgent production fixes | `hotfix/jwt-expiry-crash` |
| `chore/` | Maintenance, deps, docs, refactor | `chore/bump-go-dependencies` |

Use `kebab-case`, keep names concise, and include the issue number where applicable:
`feature/123-add-account-pagination`.

---

## Branch Protection Settings

The following settings should be applied to `main`, `dev`, `uat`, and `prod` via
**GitHub → Settings → Branches → Branch protection rules**.

### Recommended settings for all four branches

- [ ] **Require a pull request before merging** — prevents direct pushes.
- [ ] **Require approvals** — at least 1 reviewer for `main`, `dev`, and `uat`; at least 2 for `prod`.
- [ ] **Dismiss stale pull request approvals when new commits are pushed** — keeps reviews fresh.
- [ ] **Require status checks to pass before merging** — attach CI jobs (lint, test, build).
- [ ] **Require branches to be up to date before merging** — prevents "works on my machine" merges.
- [ ] **Do not allow bypassing the above settings** — even admins go through PRs.
- [ ] **Restrict who can push to matching branches** — limit to maintainers.
- [ ] **Allow force pushes** — **disabled** on all four branches.
- [ ] **Allow deletions** — **disabled** on all four branches.

### Additional recommended settings for `prod`

- [ ] **Require conversation resolution before merging**.
- [ ] **Require deployments to succeed before merging** (if deployment environments are configured
  in GitHub Actions).

---

## Setting Up Branches

### Automated setup (recommended)

Run the provided script. It requires the [GitHub CLI (`gh`)](https://cli.github.com/) and a token
with `repo` and `admin:repo_hook` scopes:

```bash
bash scripts/setup-branches.sh
```

The script creates `dev`, `uat`, and `prod` from the current `main` HEAD and applies the branch
protection rules listed above.

### Manual setup via GitHub UI

1. Navigate to **GitHub → Your repo → Code → branches**.
2. Click **"New branch"**, name it `dev`, source from `main`. Repeat for `uat` and `prod`.
3. Navigate to **Settings → Branches → Add branch protection rule** and configure each branch
   using the settings listed in the section above.

---

## Frequently Asked Questions

**Q: Can I push directly to `main`?**
No. Branch protection requires a pull request. Use a `chore/` or `feature/` branch even for small
changes.

**Q: Do I need to keep `dev`, `uat`, and `prod` in sync manually?**
No. Promote via PRs on a schedule that matches your release cadence. Frequent small promotions are
better than large batches.

**Q: What if my feature branch is out of date with `main`?**
Rebase or merge `main` into your branch before opening or updating a PR:

```bash
git fetch origin
git rebase origin/main
# or: git merge origin/main
```

**Q: Who can approve promotion PRs?**
Any repository collaborator with write access can approve. For `prod` promotions, aim for
sign-off from at least one other team member.
