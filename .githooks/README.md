# Git Hooks

This directory contains git hooks for automated validation and quality checks.
Hooks run automatically once installed — no manual steps required per commit.

> **Why not Husky?** This project uses native Git hooks via `git config core.hooksPath` rather
> than Husky. This keeps the toolchain lightweight: no Node.js dependency is required for the
> backend or infrastructure workflows, and the same hooks work in any shell environment without
> an `npm install` step.

## Available Hooks

### pre-commit

Runs two checks on every commit attempt:

#### 1. VS Code settings sort (when `pwsh` is available)

If `.vscode/settings.json` exists and PowerShell 7+ (`pwsh`) is on your `PATH`, the hook runs
`scripts/sort-vscode-settings.ps1` to keep the JSON keys alphabetically sorted. If the sorter
modifies the file it is automatically staged so the sorted version is part of the commit.

If `pwsh` is not available the sort step is skipped with a warning — the commit is **not**
blocked.

#### 2. Markdown linting

Runs `markdownlint` against every staged `.md` file using the project rules in
`.markdownlint.yaml`.

**Rules enforced:**

- MD013 — Line length must not exceed 120 characters
- MD040 — Fenced code blocks must declare a language (e.g., ` ```bash`, ` ```json`, ` ```text`)
- MD060 — Table columns must use spaced pipe style
- All other rules enabled in `.markdownlint.yaml`

The hook **fails fast** if `markdownlint-cli` is not installed. This is intentional — markdown
non-compliance is caught before review, not during it.

### pre-push

Validates that `.vscode/settings.json` is sorted before code reaches the remote.

If `pwsh` is not available the push is **blocked** — install PowerShell 7+ or sort the file
from a machine where `pwsh` is available before pushing.

**What it checks:**

- Runs `scripts/sort-vscode-settings.ps1 -CheckOnly` and blocks the push if the file is unsorted.

To fix a blocked push, run `make settings-sort` and commit the result before pushing again.

## Installation

### Automatic (Recommended)

```bash
make install-hooks
```

This configures git to use hooks from this directory and makes both scripts executable.

### Manual

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
chmod +x .githooks/pre-push
```

## Usage

Once installed, hooks run automatically:

```bash
git add docs/README.md
git commit -m "Update docs"
# pre-commit hook runs automatically

git push origin feature/my-branch
# pre-push hook runs automatically
```

### Bypassing Hooks

**Not recommended**, but available if needed:

```bash
# Skip pre-commit checks for a single commit
git commit --no-verify -m "wip: skip checks"

# Skip pre-push checks for a single push
git push --no-verify origin feature/my-branch
```

### Fixing a Failed pre-commit

If the pre-commit hook fails on markdown linting:

1. **Auto-fix (where possible):**

   ```bash
   make lint-docs-fix
   ```

2. **Check manually:**

   ```bash
   make docs-check
   ```

3. **Auto-fix then re-check:**

   ```bash
   make docs-check-fix
   ```

4. **Common manual fixes:**
   - MD013: Break long lines at 120 characters
   - MD040: Add a language tag to fenced code blocks (` ```bash`, ` ```json`, ` ```text`)
   - MD060: Ensure table header/separator rows use spaced pipes (`| col |`)

### Fixing a Blocked pre-push

If the pre-push hook blocks your push because `.vscode/settings.json` is unsorted:

```bash
make settings-sort
git add .vscode/settings.json
git commit -m "chore: sort vscode settings"
git push origin feature/my-branch
```

## Disabling Hooks

```bash
git config --unset core.hooksPath
```

## Requirements

| Tool | Purpose | Install |
| ---- | ------- | ------- |
| `markdownlint-cli` | Markdown linting (pre-commit) | `make install-tools` or `npm install -g markdownlint-cli` |
| `pwsh` (PowerShell 7+) | VS Code settings sort (pre-commit, pre-push) | [Install PowerShell](https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell) |
