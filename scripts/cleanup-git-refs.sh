#!/usr/bin/env bash
# cleanup-git-refs.sh
# Bash equivalent of scripts/cleanup-git-refs.ps1
#
# Removes empty stale git ref/log namespace directories from the .git directory
# and optionally cleans up empty workspace directories (e.g. backups/).
#
# Usage:
#   bash scripts/cleanup-git-refs.sh [--repo-path PATH]
#       [--namespaces "ns1 ns2 ..."]
#       [--max-retries N]
#       [--prune-empty-parents]
#       [--workspace-dirs "dir1 dir2 ..."]
#
# Defaults match the PS1 script defaults.

set -euo pipefail

REPO_PATH="$(pwd)"
NAMESPACES=(
  "refs/heads/feat"
  "logs/refs/heads/feat"
  "refs/heads/copilot"
  "logs/refs/heads/copilot"
  "refs/heads/perf"
  "logs/refs/heads/perf"
  "refs/remotes/origin/security"
  "refs/remotes/origin/fix"
  "refs/remotes/origin/feat"
  "refs/remotes/origin/copilot"
  "refs/remotes/origin/chore"
)
MAX_RETRIES=8
PRUNE_EMPTY_PARENTS=false
WORKSPACE_DIRS=("backups")

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-path)          REPO_PATH="$2"; shift 2 ;;
    --namespaces)         IFS=' ' read -ra NAMESPACES <<< "$2"; shift 2 ;;
    --max-retries)        MAX_RETRIES="$2"; shift 2 ;;
    --prune-empty-parents) PRUNE_EMPTY_PARENTS=true; shift ;;
    --workspace-dirs)     IFS=' ' read -ra WORKSPACE_DIRS <<< "$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

cd "$REPO_PATH"

# Resolve git root and git dir
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "")"
if [[ -z "$REPO_ROOT" ]]; then
  echo "[cleanup-git-refs] No git repository found at $REPO_PATH"
  exit 1
fi

GIT_DIR="$(git rev-parse --absolute-git-dir 2>/dev/null)"

# Normalise a path (resolve trailing slashes, etc.)
normalize_path() {
  local p="$1"
  # Remove trailing slash
  p="${p%/}"
  echo "$p"
}

remove_empty_dir_with_retry() {
  local target="$1"

  if [[ ! -d "$target" ]]; then
    echo "MISSING"
    return
  fi

  local attempt
  for (( attempt=1; attempt<=MAX_RETRIES; attempt++ )); do
    if [[ -n "$(ls -A "$target" 2>/dev/null)" ]]; then
      echo "NOT_EMPTY"
      return
    fi

    if rmdir "$target" 2>/dev/null; then
      echo "REMOVED"
      return
    fi

    sleep 0.1
  done

  echo "STILL_PRESENT"
}

prune_empty_parents() {
  local git_root="$1"
  local rel_path="$2"

  local parent
  parent="$(dirname "$rel_path")"
  while [[ "$parent" != "." && "$parent" != "/" ]]; do
    local full_parent="${git_root}/${parent}"
    if [[ -d "$full_parent" && -z "$(ls -A "$full_parent" 2>/dev/null)" ]]; then
      rmdir "$full_parent" 2>/dev/null || true
    else
      break
    fi
    parent="$(dirname "$parent")"
  done
}

STILL_PRESENT_COUNT=0
echo "[cleanup-git-refs] Processing git ref namespaces..."
printf '%-50s %s\n' "Namespace" "Result"
printf '%-50s %s\n' "---------" "------"

for ns in "${NAMESPACES[@]}"; do
  # Safety: reject absolute paths, parent traversal, and dangerous characters
  ns_norm="${ns#/}"
  ns_norm="${ns_norm%/}"

  if [[ "$ns_norm" == *".."* ]] || [[ "$ns_norm" =~ ^/ ]]; then
    printf '%-50s %s\n' "$ns_norm" "SKIPPED_UNSAFE"
    continue
  fi

  target="${GIT_DIR}/${ns_norm}"

  result="$(remove_empty_dir_with_retry "$target")"
  printf '%-50s %s\n' "$ns_norm" "$result"

  if [[ "$result" == "STILL_PRESENT" ]]; then
    STILL_PRESENT_COUNT=$((STILL_PRESENT_COUNT + 1))
  fi

  if $PRUNE_EMPTY_PARENTS && [[ "$result" == "REMOVED" || "$result" == "MISSING" ]]; then
    prune_empty_parents "$GIT_DIR" "$ns_norm"
  fi
done

echo ""

if [[ ${#WORKSPACE_DIRS[@]} -gt 0 ]]; then
  echo "[cleanup-git-refs] Workspace directory cleanup:"
  printf '%-40s %s\n' "Directory" "Result"
  printf '%-40s %s\n' "---------" "------"

  for ws_dir in "${WORKSPACE_DIRS[@]}"; do
    [[ -z "$ws_dir" ]] && continue
    ws_norm="${ws_dir#/}"
    ws_norm="${ws_norm%/}"

    if [[ "$ws_norm" == *".."* ]] || [[ "$ws_norm" =~ ^/ ]]; then
      printf '%-40s %s\n' "$ws_norm" "SKIPPED_UNSAFE"
      continue
    fi

    ws_path="${REPO_ROOT}/${ws_norm}"
    result="$(remove_empty_dir_with_retry "$ws_path")"
    printf '%-40s %s\n' "$ws_norm" "$result"

    if [[ "$result" == "STILL_PRESENT" ]]; then
      STILL_PRESENT_COUNT=$((STILL_PRESENT_COUNT + 1))
    fi
  done
fi

if [[ $STILL_PRESENT_COUNT -gt 0 ]]; then
  echo ""
  echo "[cleanup-git-refs] WARNING: Some namespaces are still present (likely locked by sync/indexing)."
  exit 1
fi

echo "[cleanup-git-refs] Done."
