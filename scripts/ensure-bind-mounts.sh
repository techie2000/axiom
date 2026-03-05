#!/usr/bin/env bash
# ensure-bind-mounts.sh
#
# Creates local bind-mount directories required by docker-compose for dev/main
# environments and, on Linux hosts, fixes ownership to match the postgres user
# inside postgres:17-alpine (UID 70 / GID 70).
#
# Docker creates missing bind-mount directories as root on Linux, which causes
# Postgres to refuse to start with "data directory has wrong ownership".
# A temporary Alpine container is used for the chown so that no 'sudo' is
# required on the host.
#
# Usage:
#   ./scripts/ensure-bind-mounts.sh <environment>
#
# Arguments:
#   environment   One of: dev | main
#
# Examples:
#   ./scripts/ensure-bind-mounts.sh dev
#   ./scripts/ensure-bind-mounts.sh main

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
NC='\033[0m'

info()    { echo -e "${CYAN}ℹ${NC}  $*"; }
success() { echo -e "${GREEN}✓${NC}  $*"; }

ENV="${1:-}"
if [[ -z "$ENV" || ( "$ENV" != "dev" && "$ENV" != "main" ) ]]; then
    echo "Usage: $0 <dev|main>"
    exit 1
fi

# ── Resolve root dir ──────────────────────────────────────────────────────────
cd "$(dirname "$0")/.."

POSTGRES_DIR="./data/${ENV}/postgres"
LEI_DIR="./data/${ENV}/lei"
LOG_DIR="./log/${ENV}"

# ── Create directories if absent ─────────────────────────────────────────────
mkdir -p "$POSTGRES_DIR" "$LEI_DIR" "$LOG_DIR"
info "Ensured bind-mount directories for '${ENV}':"
info "  postgres data : $POSTGRES_DIR"
info "  LEI data      : $LEI_DIR"
info "  logs          : $LOG_DIR"

# ── Fix postgres ownership on Linux ──────────────────────────────────────────
# On macOS/Windows, Docker Desktop's file-sharing layer translates host-user
# ownership into the container, so no chown is needed.
# On Linux (bare-metal or CI), the bind-mount appears with its host ownership
# (typically root:root when first created by Docker), which prevents the
# postgres process (UID 70 in Alpine) from initialising the data directory.
if [[ "$(uname -s)" == "Linux" ]]; then
    if command -v realpath >/dev/null 2>&1; then
        POSTGRES_DIR_ABS="$(realpath "$POSTGRES_DIR")"
    else
        POSTGRES_DIR_ABS="$(cd "$POSTGRES_DIR" && pwd -P)"
    fi
    info "Linux host detected — setting postgres data dir ownership to UID 70:70 via docker..."
    docker run --rm \
        -v "${POSTGRES_DIR_ABS}:/target" \
        alpine:latest \
        sh -c "chown 70:70 /target && chmod 700 /target"
    success "Ownership of $POSTGRES_DIR set to 70:70 (postgres user in alpine image)"
else
    info "Non-Linux host ($(uname -s)) — Docker Desktop manages permissions, skipping chown."
fi
