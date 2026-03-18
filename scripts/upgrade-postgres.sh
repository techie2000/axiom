#!/usr/bin/env bash
# upgrade-postgres.sh
#
# Safely migrates PostgreSQL data when upgrading between major versions.
# Detects the current data version, backs it up, removes the old volume,
# starts the new PostgreSQL container and restores the backup automatically.
#
# Usage:
#   ./scripts/upgrade-postgres.sh <environment> [--yes]
#
# Arguments:
#   environment   One of: dev | uat | prod | main
#   --yes / -y    Skip the confirmation prompt (for scripted runs)
#
# Examples:
#   ./scripts/upgrade-postgres.sh dev
#   ./scripts/upgrade-postgres.sh prod --yes

set -euo pipefail

# ── Constants ─────────────────────────────────────────────────────────────────
TARGET_PG_VERSION=17
BACKUP_DIR="./backups"

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()    { echo -e "${CYAN}ℹ${NC}  $*"; }
success() { echo -e "${GREEN}✓${NC}  $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
error()   { echo -e "${RED}✗${NC}  $*"; exit 1; }

# ── Usage ─────────────────────────────────────────────────────────────────────
usage() {
    echo "Usage: $0 <environment> [--yes]"
    echo ""
    echo "  environment   One of: dev | uat | prod | main"
    echo "  --yes / -y    Skip confirmation prompt"
    echo ""
    echo "Examples:"
    echo "  $0 dev"
    echo "  $0 prod --yes"
    exit 1
}

# ── Argument parsing ──────────────────────────────────────────────────────────
ENVIRONMENT=""
AUTO_YES=false
for arg in "$@"; do
    case "$arg" in
        dev|uat|prod|main) ENVIRONMENT="$arg" ;;
        --yes|-y)     AUTO_YES=true ;;
        *)            usage ;;
    esac
done
[[ -z "$ENVIRONMENT" ]] && usage

# ── Config ────────────────────────────────────────────────────────────────────
cd "$(dirname "$0")/.."

ENV_FILE=".env.$ENVIRONMENT"
COMPOSE_FILE="docker-compose.$ENVIRONMENT.yml"

[[ ! -f "$ENV_FILE" ]]     && error "Missing env file: $ENV_FILE"
[[ ! -f "$COMPOSE_FILE" ]] && error "Missing compose file: $COMPOSE_FILE"

parse_env() {
    grep -E "^${1}=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed 's/[[:space:]]*#.*//' | tr -d '\r '
}

PROJECT_NAME=$(parse_env "COMPOSE_PROJECT_NAME")
PG_USER=$(parse_env "POSTGRES_USER")
PG_PASSWORD=$(parse_env "POSTGRES_PASSWORD")
PG_DB=$(parse_env "POSTGRES_DB")

[[ -z "$PROJECT_NAME" ]] && error "COMPOSE_PROJECT_NAME not set in $ENV_FILE"
[[ -z "$PG_USER" ]]      && error "POSTGRES_USER not set in $ENV_FILE"
[[ -z "$PG_PASSWORD" ]]  && error "POSTGRES_PASSWORD not set in $ENV_FILE"
[[ -z "$PG_DB" ]]        && error "POSTGRES_DB not set in $ENV_FILE"

CONTAINER_NAME="${PROJECT_NAME}-postgres"
VOLUME_NAME="${PROJECT_NAME}_postgres_data_${ENVIRONMENT}"

POSTGRES_DATA_DIR=$(parse_env "POSTGRES_DATA_DIR")

# Determine storage type: bind mount (main/dev) vs named Docker volume (uat/prod).
# If POSTGRES_DATA_DIR is set in the env file the environment uses a host bind mount.
if [[ -n "$POSTGRES_DATA_DIR" ]]; then
    USE_BIND_MOUNT=true
    DATA_SRC="$POSTGRES_DATA_DIR"
else
    USE_BIND_MOUNT=false
    DATA_SRC="$VOLUME_NAME"
fi

# ── Header ────────────────────────────────────────────────────────────────────
echo ""
echo "======================================"
echo " PostgreSQL Upgrade — $ENVIRONMENT"
echo "======================================"
echo ""
info "Project:   $PROJECT_NAME"
info "Container: $CONTAINER_NAME"
if [[ "$USE_BIND_MOUNT" == true ]]; then
    info "Data:      $DATA_SRC (bind mount)"
else
    info "Volume:    $VOLUME_NAME"
fi
info "Target PG: $TARGET_PG_VERSION"
echo ""

# ── Check data exists ─────────────────────────────────────────────────────────
if [[ "$USE_BIND_MOUNT" == true ]]; then
    if [[ ! -d "$DATA_SRC" ]] || [[ -z "$(ls -A "$DATA_SRC" 2>/dev/null)" ]]; then
        success "Bind-mount directory '$DATA_SRC' does not exist or is empty — no existing data to migrate."
        success "The postgres:${TARGET_PG_VERSION}-alpine container will initialise a fresh database on first start."
        exit 0
    fi
else
    if ! docker volume inspect "$VOLUME_NAME" &>/dev/null; then
        success "Volume '$VOLUME_NAME' does not exist — no existing data to migrate."
        success "The postgres:${TARGET_PG_VERSION}-alpine container will initialise a fresh database on first start."
        exit 0
    fi
fi

# ── Read PG_VERSION ───────────────────────────────────────────────────────────
if [[ "$USE_BIND_MOUNT" == true ]]; then
    # For bind mounts the data directory is on the host, so we can read PG_VERSION directly.
    CURRENT_PG_VERSION=$(cat "${DATA_SRC}/PG_VERSION" 2>/dev/null || echo "unknown")
else
    CURRENT_PG_VERSION=$(docker run --rm \
        -v "${VOLUME_NAME}:/var/lib/postgresql/data" \
        alpine:latest \
        sh -c "cat /var/lib/postgresql/data/PG_VERSION 2>/dev/null || echo 'unknown'")
fi

info "Detected data version: PostgreSQL $CURRENT_PG_VERSION"

if [[ "$CURRENT_PG_VERSION" == "$TARGET_PG_VERSION" ]]; then
    success "Data is already at PostgreSQL $TARGET_PG_VERSION — nothing to do."
    exit 0
fi

if [[ "$CURRENT_PG_VERSION" == "unknown" ]]; then
    if [[ "$USE_BIND_MOUNT" == true ]]; then
        warn "Could not read PG_VERSION from ${DATA_SRC}. The directory may be empty or uninitialised."
        warn "If so, you can remove it safely: rm -rf ${DATA_SRC}"
    else
        warn "Could not read PG_VERSION from volume. The volume may be empty or uninitialised."
        warn "If so, you can remove it safely: docker volume rm $VOLUME_NAME"
    fi
    exit 1
fi

# ── Confirm ───────────────────────────────────────────────────────────────────
echo ""
warn "PostgreSQL data upgrade required: v${CURRENT_PG_VERSION} → v${TARGET_PG_VERSION}"
warn "This will:"
echo "   1. Stop any running environment services"
echo "   2. Back up all databases to ${BACKUP_DIR}/"
if [[ "$USE_BIND_MOUNT" == true ]]; then
    echo "   3. Rename the existing data directory to a timestamped backup"
else
    echo "   3. Remove the existing volume (${VOLUME_NAME})"
fi
echo "   4. Start postgres:${TARGET_PG_VERSION}-alpine and restore the backup"
echo ""

if [[ "$AUTO_YES" == false ]]; then
    read -rp "Continue? [y/N] " confirm
    [[ "$confirm" != "y" && "$confirm" != "Y" ]] && { echo "Aborted."; exit 0; }
fi

TEMP_CONTAINER="axiom-pg-upgrade-$$"
cleanup() {
    docker rm -f "$TEMP_CONTAINER" &>/dev/null || true
}
trap cleanup EXIT

# ── Step 1: Stop running environment ─────────────────────────────────────────
echo ""
info "Step 1/5: Stopping any running services for '$ENVIRONMENT'..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down 2>/dev/null || true

# ── Step 2: Dump via temporary old-version container ─────────────────────────
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/postgres-${ENVIRONMENT}-v${CURRENT_PG_VERSION}-${TIMESTAMP}.sql"

info "Step 2/5: Starting temporary postgres:${CURRENT_PG_VERSION}-alpine container to take backup..."

# For bind mounts docker requires an absolute path; resolve it from the host working directory.
if [[ "$USE_BIND_MOUNT" == true ]]; then
    DATA_ABS="$(cd "$DATA_SRC" 2>/dev/null && pwd)" \
        || error "Cannot resolve bind-mount path: $DATA_SRC"
    MOUNT_ARG="${DATA_ABS}:/var/lib/postgresql/data"
else
    MOUNT_ARG="${VOLUME_NAME}:/var/lib/postgresql/data"
fi

docker run -d \
    --name "$TEMP_CONTAINER" \
    -e POSTGRES_USER="$PG_USER" \
    -e POSTGRES_PASSWORD="$PG_PASSWORD" \
    -e POSTGRES_DB="$PG_DB" \
    -e PGDATA=/var/lib/postgresql/data \
    -v "${MOUNT_ARG}" \
    "postgres:${CURRENT_PG_VERSION}-alpine" >/dev/null

info "Waiting for temporary container to be ready..."
for i in $(seq 1 30); do
    if docker exec "$TEMP_CONTAINER" pg_isready -U "$PG_USER" &>/dev/null 2>&1; then
        break
    fi
    if [[ $i -eq 30 ]]; then
        error "Temporary postgres:${CURRENT_PG_VERSION} container did not become ready. Check: docker logs $TEMP_CONTAINER"
    fi
    sleep 1
done

info "Dumping all databases to ${BACKUP_FILE}..."
PGPASSWORD="$PG_PASSWORD" docker exec "$TEMP_CONTAINER" pg_dumpall -U "$PG_USER" > "$BACKUP_FILE"

docker rm -f "$TEMP_CONTAINER" >/dev/null

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
success "Backup saved: $BACKUP_FILE ($BACKUP_SIZE)"

# ── Step 3: Remove or rename old data ────────────────────────────────────────
if [[ "$USE_BIND_MOUNT" == true ]]; then
    BAK_DIR="${DATA_SRC}.bak.${TIMESTAMP}"
    info "Step 3/5: Renaming data directory to ${BAK_DIR}..."
    mv "$DATA_SRC" "$BAK_DIR" \
        || error "Failed to rename $DATA_SRC to $BAK_DIR — check permissions and disk space, then retry."
    success "Data directory backed up to: $BAK_DIR"
else
    info "Step 3/5: Removing old volume (${VOLUME_NAME})..."
    docker volume rm "$VOLUME_NAME"
    success "Old volume removed."
fi

# ── Step 4: Start new postgres (v17) ─────────────────────────────────────────
info "Step 4/5: Starting postgres:${TARGET_PG_VERSION}-alpine..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d postgres

info "Waiting for postgres:${TARGET_PG_VERSION} to be ready..."
for i in $(seq 1 60); do
    if docker exec "$CONTAINER_NAME" pg_isready -U "$PG_USER" &>/dev/null 2>&1; then
        break
    fi
    if [[ $i -eq 60 ]]; then
        error "New postgres:${TARGET_PG_VERSION} container did not become ready. Check: docker logs $CONTAINER_NAME"
    fi
    sleep 1
done

# ── Step 5: Restore backup ────────────────────────────────────────────────────
info "Step 5/5: Restoring backup into postgres:${TARGET_PG_VERSION}..."
docker cp "$BACKUP_FILE" "${CONTAINER_NAME}:/tmp/restore.sql"
docker exec "$CONTAINER_NAME" sh -c \
    "PGPASSWORD='${PG_PASSWORD}' psql -U '${PG_USER}' -d postgres -f /tmp/restore.sql"
docker exec "$CONTAINER_NAME" rm /tmp/restore.sql

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}======================================"
echo " PostgreSQL upgrade complete!"
echo -e "======================================${NC}"
echo ""
success "Data migrated: v${CURRENT_PG_VERSION} → v${TARGET_PG_VERSION}"
success "SQL backup retained at: ${BACKUP_FILE}"
if [[ "$USE_BIND_MOUNT" == true ]]; then
    success "Old data directory backed up to: ${DATA_SRC}.bak.${TIMESTAMP}"
fi
echo ""
info "Start the full environment with:"
echo "   docker compose --env-file ${ENV_FILE} -f ${COMPOSE_FILE} up -d"
echo "  or:"
echo "   make docker-${ENVIRONMENT}-up"
echo ""
