---
description: 'Automated cleanup workflow for branches and worktrees when PRs are merged to GitHub'
applyTo: '**'
---

# PR Merge Cleanup Workflow

When you announce that a PR has been merged on GitHub, this workflow automatically cleans up associated local resources.

## Trigger Pattern

User announces:
> "PR #XXX has been merged"
> "PRs #123, #456, #789 merged"
> "Merged PR for feature X"

## Automated Cleanup Steps

### Step 1: Identify Associated Branches

For each PR that merged, identify related local branches:

- `pr-{NUMBER}` (e.g., `pr-123`)
- `fix/pr{NUMBER}*` (e.g., `fix/pr108-security-workflow-jobs`)
- Feature/fix branches referenced in PR title or body

### Step 2: Verify Merge Status

```bash
# Check if PR is actually merged on GitHub
gh api repos/techie2000/axiom/pulls/{PR_NUMBER} --jq '{number, state, merged, title}'

# Should show: "merged": true
```

### Step 3: Delete Local Branches

Once merge is confirmed:

```bash
# Delete branch matching PR number
git branch -D pr-{NUMBER}

# OR delete specific fix/feature branches
git branch -D {branch-name}
```

### Step 4: Remove Associated Worktrees (if any)

```bash
# List worktrees
git worktree list

# Remove worktree
git worktree remove {worktree-path} --force

# Delete associated branch
git branch -D {branch-name}
```

### Step 5: Prune Remote Refs

```bash
git fetch origin --prune
```

## Examples

### Single PR Merge

**User announces:**
> "PR #220 merged"

**Cleanup:**

```bash
gh api repos/techie2000/axiom/pulls/220 --jq '{merged}'
# Verify: "merged": true

git branch -D pr-220  # or branch tracking the PR
git fetch origin --prune
```

### Multiple PRs Merged

**User announces:**
> "PRs #155, #220, #272 merged"

**Cleanup:**

```bash
foreach ($pr in @(155, 220, 272)) {
    gh api repos/techie2000/axiom/pulls/$pr --jq '{number, merged}'
}
# Verify all show "merged": true

git branch -D pr-155 pr-220 pr-272
git fetch origin --prune
```

### PR with Associated Worktrees

**User announces:**
> "PR #352 for LEI status badge merged"

**Cleanup:**

```bash
# Confirm merge
gh api repos/techie2000/axiom/pulls/352 --jq '{merged}'

# Remove worktrees
git worktree list | grep -i "lei.*badge"
git worktree remove worktrees/issue-352-lei-status-badge --force

# Delete branches
git branch -D feat/lei-status-badge fix/lei-status-badge-copilot-feedback

# Prune
git fetch origin --prune
```

## Validation Checklist

After cleanup:

- [ ] Check remaining branches: `git branch -v`
- [ ] Verify no orphaned worktree directories in `worktrees/`
- [ ] Confirm remote refs pruned: `git branch -r | wc -l`
- [ ] On main with latest: `git status` should show "up to date with origin/main"

## Notes

- **Always verify PR is merged** before deleting local branches (use `gh api`)
- **Use `--force` flag** only for worktrees; safe for branches
- **Single source of truth**: GitHub is authoritative; local branches are ephemeral
- **Batch deletions** when multiple PRs merge (more efficient)
