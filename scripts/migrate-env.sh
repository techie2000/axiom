#!/usr/bin/env bash
# migrate-env.sh
# Bash equivalent of scripts/migrate-env.ps1
#
# Runs golang-migrate against the target environment's database inside the
# running backend container.
#
# Usage:
#   bash scripts/migrate-env.sh --environment <main|dev|uat|prod> \
#       [--direction up|down|force] [--force-version N]

set -euo pipefail

ENVIRONMENT=""
DIRECTION="up"
FORCE_VERSION=-1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --environment|-e) ENVIRONMENT="$2"; shift 2 ;;
    --direction)      DIRECTION="$2"; shift 2 ;;
    --force-version)  FORCE_VERSION="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; echo "Usage: $0 --environment <main|dev|uat|prod> [--direction up|down|force] [--force-version N]"; exit 1 ;;
  esac
done

if [[ -z "$ENVIRONMENT" ]]; then
  echo "--environment is required. Valid values: main, dev, uat, prod"
  exit 1
fi

case "$ENVIRONMENT" in
  main|dev|uat|prod) ;;
  *) echo "Invalid environment '$ENVIRONMENT'. Valid values: main, dev, uat, prod"; exit 1 ;;
esac

case "$DIRECTION" in
  up|down|force) ;;
  *) echo "Invalid direction '$DIRECTION'. Valid values: up, down, force"; exit 1 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
cd "$ROOT"

ENV_FILE=".env.${ENVIRONMENT}"
COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Missing compose file: $COMPOSE_FILE"
  exit 1
fi

# Parse env file
declare -A ENV_MAP
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"
  [[ -z "${line// }" ]] && continue
  [[ "$line" != *=* ]] && continue
  key="${line%%=*}"; val="${line#*=}"
  key="${key// /}"
  ENV_MAP["$key"]="$val"
done < "$ENV_FILE"

DB_USER="${ENV_MAP[DATABASE_USER]:-}"
DB_PASSWORD="${ENV_MAP[DATABASE_PASSWORD]:-}"
DB_NAME="${ENV_MAP[DATABASE_NAME]:-}"

if [[ -z "$DB_USER" || -z "$DB_PASSWORD" || -z "$DB_NAME" ]]; then
  echo "DATABASE_USER, DATABASE_PASSWORD, and DATABASE_NAME must be set in $ENV_FILE"
  exit 1
fi

DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}?sslmode=disable"

case "$DIRECTION" in
  up)    CMD_SUFFIX="up" ;;
  down)  CMD_SUFFIX="down 1" ;;
  force)
    if [[ "$FORCE_VERSION" -lt 0 ]]; then
      echo "--force-version is required when --direction force"
      exit 1
    fi
    CMD_SUFFIX="force $FORCE_VERSION"
    ;;
esac

CONTAINER_SCRIPT='rm -f /tmp/migrate /tmp/migrate.tar.gz && apk add --no-cache wget tar >/dev/null && wget --no-check-certificate -q -O /tmp/migrate.tar.gz https://github.com/golang-migrate/migrate/releases/download/v4.18.1/migrate.linux-amd64.tar.gz && tar -xzf /tmp/migrate.tar.gz -C /tmp && chmod +x /tmp/migrate && /tmp/migrate -path /root/migrations -database '"'"''"$DATABASE_URL"''"'"' -verbose '"$CMD_SUFFIX"

echo "Starting dependencies for $ENVIRONMENT..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d postgres rabbitmq backend

echo "Running migration '$DIRECTION' for $ENVIRONMENT..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend sh -lc "$CONTAINER_SCRIPT"

echo "Done."
