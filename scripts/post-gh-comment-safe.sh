#!/usr/bin/env bash
# post-gh-comment-safe.sh
# Bash equivalent of scripts/post-gh-comment-safe.ps1
#
# Posts a GitHub PR or issue comment via the gh CLI, then immediately verifies
# the stored body matches what was sent. If there is a mismatch it patches the
# comment in-place and re-verifies.
#
# Requires: gh (authenticated), jq
#
# Usage:
#   bash scripts/post-gh-comment-safe.sh \
#     --repo <owner/repo> \
#     --target-type pr|issue \
#     --number <N> \
#     --body-file <path> \
#     [--dry-run]

set -euo pipefail

REPO=""
TARGET_TYPE=""
NUMBER=""
BODY_FILE=""
DRY_RUN=false
KEEP_TEMP=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)         REPO="$2"; shift 2 ;;
    --target-type)  TARGET_TYPE="$2"; shift 2 ;;
    --number)       NUMBER="$2"; shift 2 ;;
    --body-file)    BODY_FILE="$2"; shift 2 ;;
    --dry-run)      DRY_RUN=true; shift ;;
    --keep-temp)    KEEP_TEMP=true; shift ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

if [[ -z "$REPO" || -z "$TARGET_TYPE" || -z "$NUMBER" || -z "$BODY_FILE" ]]; then
  echo "Usage: $0 --repo <owner/repo> --target-type pr|issue --number <N> --body-file <path> [--dry-run]"
  exit 1
fi

if [[ "$TARGET_TYPE" != "pr" && "$TARGET_TYPE" != "issue" ]]; then
  echo "--target-type must be 'pr' or 'issue'"
  exit 1
fi

if [[ ! -f "$BODY_FILE" ]]; then
  echo "Body file not found: $BODY_FILE"
  exit 1
fi

if $DRY_RUN; then
  echo "[safe-comment] dry-run target=$TARGET_TYPE number=$NUMBER repo=$REPO"
  echo "[safe-comment] body_file=$BODY_FILE"
  exit 0
fi

VIEWER="$(gh api user --jq .login)"
if [[ -z "$VIEWER" ]]; then
  echo "Unable to resolve authenticated GitHub user login via gh api user."
  exit 1
fi

EXPECTED="$(cat "$BODY_FILE")"

echo "[safe-comment] posting via --body-file to $TARGET_TYPE #$NUMBER in $REPO"

if [[ "$TARGET_TYPE" == "issue" ]]; then
  COMMENT_URL="$(gh issue comment "$NUMBER" --repo "$REPO" --body-file "$BODY_FILE" 2>&1 | tail -1 || true)"
else
  COMMENT_URL="$(gh pr comment "$NUMBER" --repo "$REPO" --body-file "$BODY_FILE" 2>&1 | tail -1 || true)"
fi

# Extract comment id from URL (issuecomment-NNNNN)
COMMENT_ID="$(echo "$COMMENT_URL" | grep -oE 'issuecomment-[0-9]+' | grep -oE '[0-9]+' || true)"

if [[ -z "$COMMENT_ID" ]]; then
  echo "[safe-comment] comment URL did not include issuecomment id; falling back to latest user comment lookup."
  COMMENT_ID="$(gh api "repos/$REPO/issues/$NUMBER/comments" --paginate \
    --jq "[.[] | select(.user.login == \"$VIEWER\")] | last | .id // empty")"
  if [[ -z "$COMMENT_ID" ]]; then
    echo "Unable to locate newly posted comment for verification."
    exit 1
  fi
fi

STORED_BODY="$(gh api "repos/$REPO/issues/comments/$COMMENT_ID" --jq .body)"

# Normalise line endings for comparison
EXPECTED_NORM="$(printf '%s' "$EXPECTED" | tr -d '\r' | sed 's/[[:space:]]*$//')"
STORED_NORM="$(printf '%s' "$STORED_BODY" | tr -d '\r' | sed 's/[[:space:]]*$//')"

if [[ "$STORED_NORM" != "$EXPECTED_NORM" ]]; then
  echo "[safe-comment] mismatch detected, patching same comment in place..."
  gh api "repos/$REPO/issues/comments/$COMMENT_ID" --method PATCH -F "body=@$BODY_FILE" > /dev/null

  PATCHED_BODY="$(gh api "repos/$REPO/issues/comments/$COMMENT_ID" --jq .body)"
  PATCHED_NORM="$(printf '%s' "$PATCHED_BODY" | tr -d '\r' | sed 's/[[:space:]]*$//')"

  if [[ "$PATCHED_NORM" != "$EXPECTED_NORM" ]]; then
    echo "Comment body still mismatched after patch. comment_id=$COMMENT_ID"
    exit 1
  fi

  echo "[safe-comment] patch verified. comment_id=$COMMENT_ID"
else
  echo "[safe-comment] verified on first post. comment_id=$COMMENT_ID"
fi

FINAL_URL="${COMMENT_URL:-https://github.com/$REPO/issues/$NUMBER#issuecomment-$COMMENT_ID}"
echo "$FINAL_URL"
