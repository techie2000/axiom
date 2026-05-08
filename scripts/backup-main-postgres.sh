#!/usr/bin/env bash
# backup-main-postgres.sh
# Bash equivalent of scripts/backup-main-postgres.ps1
#
# Creates a timestamped backup of the running main PostgreSQL database.
# Reads an env file, discovers the postgres container from COMPOSE_PROJECT_NAME,
# and runs pg_dump inside the container.
#
# Usage:
#   bash scripts/backup-main-postgres.sh [--env-file FILE] [--output-dir DIR] [--format custom|plain]
#
# Defaults:
#   --env-file   .env.main
#   --output-dir backups/main/postgres
#   --format     custom

set -euo pipefail

ENV_FILE=".env.main"
OUTPUT_DIR="backups/main/postgres"
FORMAT="custom"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)   ENV_FILE="$2"; shift 2 ;;
    --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
    --format)     FORMAT="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; echo "Usage: $0 [--env-file FILE] [--output-dir DIR] [--format custom|plain]"; exit 1 ;;
  esac
done

if [[ "$FORMAT" != "custom" && "$FORMAT" != "plain" ]]; then
  echo "Invalid --format '$FORMAT'. Use 'custom' or 'plain'."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$WORKSPACE_ROOT"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE"
  exit 1
fi

# Parse env file
declare -A ENV_MAP
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"
  line="${line//[$'\r\n']}"
  [[ -z "$line" ]] && continue
  [[ "$line" != *=* ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  key="${key// /}"
  ENV_MAP["$key"]="$val"
done < "$ENV_FILE"

COMPOSE_PROJECT="${ENV_MAP[COMPOSE_PROJECT_NAME]:-}"
DB_USER="${ENV_MAP[POSTGRES_USER]:-}"
DB_NAME="${ENV_MAP[POSTGRES_DB]:-}"

if [[ -z "$COMPOSE_PROJECT" || -z "$DB_USER" || -z "$DB_NAME" ]]; then
  echo "Missing one or more required settings in ${ENV_FILE}: COMPOSE_PROJECT_NAME, POSTGRES_USER, POSTGRES_DB"
  exit 1
fi

CONTAINER_NAME="${COMPOSE_PROJECT}-postgres"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "Postgres container is not running: $CONTAINER_NAME"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
EXTENSION="dump"
[[ "$FORMAT" == "plain" ]] && EXTENSION="sql"

FILE_NAME="${COMPOSE_PROJECT}-${DB_NAME}-${TIMESTAMP}.${EXTENSION}"
HOST_PATH="${OUTPUT_DIR}/${FILE_NAME}"
CONTAINER_PATH="/tmp/${FILE_NAME}"

if [[ "$FORMAT" == "custom" ]]; then
  docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" -F c -f "$CONTAINER_PATH"
else
  docker exec "$CONTAINER_NAME" sh -c "pg_dump -U \"$DB_USER\" -d \"$DB_NAME\" > \"$CONTAINER_PATH\""
fi

docker cp "${CONTAINER_NAME}:${CONTAINER_PATH}" "$HOST_PATH"
docker exec "$CONTAINER_NAME" rm -f "$CONTAINER_PATH" || true

SIZE="$(wc -c < "$HOST_PATH")"
echo "Backup created: $HOST_PATH"
echo "Size: $SIZE bytes"
echo ""

if [[ "$FORMAT" == "custom" ]]; then
  echo "Restore example:"
  echo "  docker cp $HOST_PATH ${CONTAINER_NAME}:/tmp/${FILE_NAME}"
  echo "  docker exec -it $CONTAINER_NAME pg_restore -U $DB_USER -d $DB_NAME --clean --if-exists /tmp/${FILE_NAME}"
else
  echo "Restore example:"
  echo "  docker cp $HOST_PATH ${CONTAINER_NAME}:/tmp/${FILE_NAME}"
  echo "  docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -f /tmp/${FILE_NAME}"
fi
