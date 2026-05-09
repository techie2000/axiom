#!/usr/bin/env bash
# new-main-test-env.sh
# Bash equivalent of scripts/new-main-test-env.ps1
#
# Creates an isolated .env file for a temporary main-like test stack by copying
# .env.main and rewriting project/port/database fields.
#
# Usage:
#   bash scripts/new-main-test-env.sh --name <NAME> \
#       [--source-env-file .env.main] \
#       [--output-env-file .env.main.<NAME>] \
#       [--port-offset 100]

set -euo pipefail

NAME=""
SOURCE_ENV_FILE=".env.main"
OUTPUT_ENV_FILE=""
PORT_OFFSET=100

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name|-n)           NAME="$2"; shift 2 ;;
    --source-env-file)   SOURCE_ENV_FILE="$2"; shift 2 ;;
    --output-env-file)   OUTPUT_ENV_FILE="$2"; shift 2 ;;
    --port-offset)       PORT_OFFSET="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; echo "Usage: $0 --name <NAME> [--source-env-file FILE] [--output-env-file FILE] [--port-offset N]"; exit 1 ;;
  esac
done

if [[ -z "$NAME" ]]; then
  echo "--name is required (e.g. --name pr107)"
  exit 1
fi

if [[ ! "$NAME" =~ ^[a-zA-Z0-9-]+$ ]]; then
  echo "--name must contain only alphanumeric characters and hyphens"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$WORKSPACE_ROOT"

if [[ ! -f "$SOURCE_ENV_FILE" ]]; then
  echo "Source env file not found: $SOURCE_ENV_FILE"
  exit 1
fi

[[ -z "$OUTPUT_ENV_FILE" ]] && OUTPUT_ENV_FILE=".env.main.${NAME}"

COMPOSE_NAME="axiom-main-${NAME}"
ENV_NAME="main-${NAME}"
DB_NAME="axiom_main_$(echo "$NAME" | tr '-' '_')"
LOG_DIR="./log/main-${NAME}"

PORT_KEYS=("POSTGRES_PORT" "RABBITMQ_PORT" "RABBITMQ_MGMT_PORT" "BACKEND_PORT" "FRONTEND_PORT")

# Helper: get value of a key from a file
get_env_value() {
  local file="$1" key="$2"
  grep -E "^\s*${key}=" "$file" | head -1 | cut -d= -f2- | tr -d '[:space:]' || true
}

# Helper: set or add a key=value in a file (edits in place)
set_env_value() {
  local file="$1" key="$2" value="$3"
  if grep -qE "^\s*${key}=" "$file"; then
    sed -i "s|^\s*${key}=.*|${key}=${value}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

# Start from a copy of the source file
cp "$SOURCE_ENV_FILE" "$OUTPUT_ENV_FILE"

set_env_value "$OUTPUT_ENV_FILE" "COMPOSE_PROJECT_NAME" "$COMPOSE_NAME"
set_env_value "$OUTPUT_ENV_FILE" "ENVIRONMENT" "$ENV_NAME"
set_env_value "$OUTPUT_ENV_FILE" "POSTGRES_DB" "$DB_NAME"
set_env_value "$OUTPUT_ENV_FILE" "DATABASE_NAME" "$DB_NAME"
set_env_value "$OUTPUT_ENV_FILE" "NEXT_PUBLIC_ENVIRONMENT" "$ENV_NAME"
set_env_value "$OUTPUT_ENV_FILE" "LOG_MAIN_DIR" "$LOG_DIR"

for key in "${PORT_KEYS[@]}"; do
  current="$(get_env_value "$OUTPUT_ENV_FILE" "$key")"
  if [[ -n "$current" && "$current" =~ ^[0-9]+$ ]]; then
    new_port=$((current + PORT_OFFSET))
    set_env_value "$OUTPUT_ENV_FILE" "$key" "$new_port"
  fi
done

BACKEND_PORT="$(get_env_value "$OUTPUT_ENV_FILE" "BACKEND_PORT")"
if [[ -n "$BACKEND_PORT" && "$BACKEND_PORT" =~ ^[0-9]+$ ]]; then
  set_env_value "$OUTPUT_ENV_FILE" "NEXT_PUBLIC_API_URL" "http://localhost:${BACKEND_PORT}"
fi

echo "Created isolated env file: $OUTPUT_ENV_FILE"
echo "COMPOSE_PROJECT_NAME=$COMPOSE_NAME"
echo "POSTGRES_DB=$DB_NAME"
echo "LOG_MAIN_DIR=$LOG_DIR"
echo "Port offset applied: +$PORT_OFFSET"
echo ""
echo "Use it with:"
echo "  docker compose --env-file $OUTPUT_ENV_FILE -f docker-compose.main.yml up -d --build"
echo "  docker compose --env-file $OUTPUT_ENV_FILE -f docker-compose.main.yml down"
echo ""
echo "Avoid using '-v' unless you intentionally want to destroy this test stack's data."
