#!/usr/bin/env bash
set -euo pipefail

# Run docker compose for the main environment against the canonical repository
# root even when invoked from a git worktree.

if [[ $# -eq 0 ]]; then
  set -- ps
fi

git_common_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
if [[ -z "$git_common_dir" ]]; then
  echo "Unable to resolve git common dir. Run this script inside the repository or one of its worktrees." >&2
  exit 1
fi

repo_root="$(dirname "$git_common_dir")"
env_file="$repo_root/.env.main"
compose_file="$repo_root/docker-compose.main.yml"

if [[ ! -f "$env_file" ]]; then
  echo "Missing env file: $env_file" >&2
  exit 1
fi
if [[ ! -f "$compose_file" ]]; then
  echo "Missing compose file: $compose_file" >&2
  exit 1
fi

export POSTGRES_DATA_DIR="$repo_root/data/main/postgres"
export LOG_MAIN_DIR="$repo_root/log/main"

"$repo_root/scripts/ensure-bind-mounts.sh" main

docker compose \
  --project-directory "$repo_root" \
  --env-file "$env_file" \
  -f "$compose_file" \
  "$@"
