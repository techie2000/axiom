#!/usr/bin/env bash
# =============================================================================
# scripts/setup-branches.sh
#
# Creates and protects the strategic long-lived branches (dev, uat, prod) for
# the Axiom repository using the GitHub CLI (gh).
#
# Prerequisites:
#   - GitHub CLI installed: https://cli.github.com/
#   - Authenticated: gh auth login
#   - Token needs 'repo' and admin:repo_hook scopes (or owner access)
#
# Usage:
#   bash scripts/setup-branches.sh [--dry-run]
#
# Flags:
#   --dry-run    Print what would happen without making any changes.
#
# See docs/contributing/BRANCHING_STRATEGY.md for full strategy documentation.
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
REPO="${GITHUB_REPOSITORY:-}"         # e.g. techie2000/axiom
SOURCE_BRANCH="main"
BRANCHES=("dev" "uat" "prod")
DRY_RUN=false

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    *)
      echo "Unknown argument: $arg"
      echo "Usage: bash scripts/setup-branches.sh [--dry-run]"
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log()  { echo "  $*"; }
info() { echo "➡  $*"; }
ok()   { echo "✅ $*"; }
warn() { echo "⚠️  $*"; }

run() {
  if $DRY_RUN; then
    echo "[dry-run] $*"
  else
    eval "$@"
  fi
}

# ---------------------------------------------------------------------------
# Detect repository
# ---------------------------------------------------------------------------
if [ -z "$REPO" ]; then
  # Try to detect from git remote
  REMOTE_URL=$(git remote get-url origin 2>/dev/null || true)
  if [[ "$REMOTE_URL" =~ github\.com[:/](.+/.+?)(\.git)?$ ]]; then
    REPO="${BASH_REMATCH[1]}"
  fi
fi

if [ -z "$REPO" ]; then
  echo "❌ Could not detect repository. Set GITHUB_REPOSITORY (owner/repo) or run from inside the repo."
  exit 1
fi

info "Repository : $REPO"
info "Source     : $SOURCE_BRANCH"
info "Dry run    : $DRY_RUN"
echo ""

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
if ! command -v gh &>/dev/null; then
  echo "❌ GitHub CLI (gh) is not installed. Install it from https://cli.github.com/"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "❌ Not authenticated with GitHub CLI. Run: gh auth login"
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 1 – Create branches (skip if they already exist)
# ---------------------------------------------------------------------------
echo "── Step 1: Create branches ─────────────────────────────────────"
EXISTING_BRANCHES=$(gh api "repos/$REPO/branches" --jq '.[].name' 2>/dev/null || true)

for branch in "${BRANCHES[@]}"; do
  if echo "$EXISTING_BRANCHES" | grep -qx "$branch"; then
    warn "Branch '$branch' already exists — skipping creation."
  else
    info "Creating branch '$branch' from '$SOURCE_BRANCH' ..."
    if $DRY_RUN; then
      echo "[dry-run] gh api --method POST repos/$REPO/git/refs -f ref=refs/heads/$branch -f sha=<HEAD sha of $SOURCE_BRANCH>"
    else
      SOURCE_SHA=$(gh api "repos/$REPO/branches/$SOURCE_BRANCH" --jq '.commit.sha')
      gh api \
        --method POST \
        -H "Accept: application/vnd.github+json" \
        "repos/$REPO/git/refs" \
        -f "ref=refs/heads/$branch" \
        -f "sha=$SOURCE_SHA"
    fi
    ok "Created '$branch'."
  fi
done
echo ""

# ---------------------------------------------------------------------------
# Step 2 – Apply branch protection rules
# ---------------------------------------------------------------------------
echo "── Step 2: Apply branch protection ────────────────────────────"

apply_protection() {
  local branch="$1"
  local required_approvals="$2"   # 1 for main/dev/uat, 2 for prod

  info "Protecting '$branch' (required approvals: $required_approvals) ..."

  run gh api \
    --method PUT \
    -H "Accept: application/vnd.github+json" \
    "repos/$REPO/branches/$branch/protection" \
    --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": []
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": $required_approvals
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
EOF

  ok "Protected '$branch'."
}

apply_protection "main" 1
apply_protection "dev"  1
apply_protection "uat"  1
apply_protection "prod" 2

echo ""

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo "══════════════════════════════════════════════════════════════════"
ok "Branch setup complete."
echo ""
echo "Next steps:"
echo "  1. Verify branches in GitHub → Code → Branches."
echo "  2. Confirm protection rules in GitHub → Settings → Branches."
echo "  3. Attach required CI status checks once workflows are named."
echo "     GitHub → Settings → Branches → edit rule → Status checks."
echo ""
echo "  See docs/contributing/BRANCHING_STRATEGY.md for the full guide."
echo "══════════════════════════════════════════════════════════════════"
