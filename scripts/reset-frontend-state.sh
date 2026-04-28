#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <main|dev|uat|prod>" >&2
  exit 1
fi

environment="$1"

if ! git_common_dir="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"; then
  echo "Unable to resolve git common dir. Run this script inside the repository or one of its worktrees." >&2
  exit 1
fi

repo_root="$(dirname "$git_common_dir")"

project_name=""
env_file=""
compose_file=""
has_frontend_volumes="false"
use_main_wrapper="false"
node_modules_volume=""
next_volume=""

case "$environment" in
  main)
    project_name="axiom-main"
    env_file="$repo_root/.env.main"
    compose_file="$repo_root/docker-compose.main.yml"
    has_frontend_volumes="true"
    use_main_wrapper="true"
    node_modules_volume="axiom-main_frontend_node_modules_main"
    next_volume="axiom-main_frontend_next_main"
    ;;
  dev)
    project_name="axiom-dev"
    env_file="$repo_root/.env.dev"
    compose_file="$repo_root/docker-compose.dev.yml"
    has_frontend_volumes="true"
    use_main_wrapper="false"
    node_modules_volume="axiom-dev_frontend_node_modules_dev"
    next_volume="axiom-dev_frontend_next_dev"
    ;;
  uat)
    project_name="axiom-uat"
    env_file="$repo_root/.env.uat"
    compose_file="$repo_root/docker-compose.uat.yml"
    ;;
  prod)
    project_name="axiom-prod"
    env_file="$repo_root/.env.prod"
    compose_file="$repo_root/docker-compose.prod.yml"
    ;;
  *)
    echo "Unsupported environment '$environment'. Use one of: main, dev, uat, prod." >&2
    exit 1
    ;;
esac

if [[ ! -f "$env_file" ]]; then
  echo "Missing env file: $env_file" >&2
  exit 1
fi
if [[ ! -f "$compose_file" ]]; then
  echo "Missing compose file: $compose_file" >&2
  exit 1
fi

frontend_container="$project_name-frontend"
run_main_compose="$repo_root/scripts/run-main-compose.sh"

compose_args=(
  --project-directory "$repo_root"
  --env-file "$env_file"
  -f "$compose_file"
)

echo "Stopping $environment frontend service..."
if [[ "$use_main_wrapper" == "true" ]]; then
  "$run_main_compose" stop -t 45 frontend
else
  docker compose "${compose_args[@]}" stop -t 45 frontend
fi

echo "Removing frontend container to release volumes..."
docker rm -f "$frontend_container" >/dev/null 2>&1 || true

if [[ "$has_frontend_volumes" == "true" ]]; then
  echo "Removing stale frontend volumes..."
  docker volume rm "$node_modules_volume" "$next_volume" >/dev/null 2>&1 || true
else
  echo "No dedicated frontend node_modules/.next volumes defined for '$environment'; skipping volume removal."
fi

echo "Rebuilding and recreating $environment frontend service..."
if [[ "$use_main_wrapper" == "true" ]]; then
  "$run_main_compose" up -d --build frontend
else
  docker compose "${compose_args[@]}" up -d --build frontend
fi

echo "$environment frontend state reset complete."