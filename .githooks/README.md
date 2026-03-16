# Git Hooks

This directory contains git hooks for automated validation and quality checks.

## Available Hooks

### pre-commit

Runs markdown linting on all staged `.md` files before allowing a commit.

**What it checks:**

- Line length (max 120 characters) - MD013
- Fenced code blocks have language specifiers - MD040
- Table column formatting - MD060
- All other rules in `.markdownlint.yaml`

## Installation

### Automatic (Recommended)

```bash
make install-hooks
```

This configures git to use hooks from this directory.

### Manual

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
```

## Usage

Once installed, hooks run automatically:

```bash
git add docs/README.md
git commit -m "Update docs"
# Pre-commit hook runs automatically
```

The hook fails fast if `markdownlint-cli` is not installed. This is intentional so markdown
non-compliance is caught before review, not during review.

### Bypassing Hooks

**Not recommended**, but if you need to skip validation:

```bash
git commit --no-verify
```

### Fixing Issues

If the pre-commit hook fails:

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

4. **Common fixes:**
   - MD013: Break long lines at 120 characters
   - MD040: Add language to code blocks (e.g., ` ```bash`, ` ```json`, ` ```text`)
   - MD060: Ensure table columns have proper spacing

## Disabling Hooks

```bash
git config --unset core.hooksPath
```

## Requirements

- **markdownlint-cli** (installed via `make install-tools` or `npm install -g markdownlint-cli`)
