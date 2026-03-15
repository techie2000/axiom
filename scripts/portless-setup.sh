#!/usr/bin/env bash
# =============================================================================
# portless-setup.sh
#
# Registers human-friendly .localhost URL aliases for all Axiom environments
# using the portless proxy (https://github.com/vercel-labs/portless).
#
# Usage:
#   bash scripts/portless-setup.sh [ENV...]
#
# Arguments:
#   ENV   One or more environments to register: main dev uat prod
#         Defaults to all four environments when omitted.
#
# Examples:
#   bash scripts/portless-setup.sh           # register all environments
#   bash scripts/portless-setup.sh dev       # register dev only
#   bash scripts/portless-setup.sh dev uat   # register dev and uat
#
# Prerequisites:
#   npm install -g portless
#   portless proxy start   (HTTP, port 1355)
#   # or: portless proxy start --https  (HTTPS, port 443)
#
# Resulting URLs (HTTP proxy on port 1355):
#   axiom-main.localhost:1355           Frontend  :43000
#   api.axiom-main.localhost:1355       Backend   :48080
#   rabbitmq.axiom-main.localhost:1355  RabbitMQ  :45673
#   axiom-dev.localhost:1355            Frontend  :13000
#   api.axiom-dev.localhost:1355        Backend   :18080
#   rabbitmq.axiom-dev.localhost:1355   RabbitMQ  :15673
#   axiom-uat.localhost:1355            Frontend  :23000
#   api.axiom-uat.localhost:1355        Backend   :28080
#   rabbitmq.axiom-uat.localhost:1355   RabbitMQ  :25673
#   axiom-prod.localhost:1355           Frontend  :33000
#   api.axiom-prod.localhost:1355       Backend   :38080
#   rabbitmq.axiom-prod.localhost:1355  RabbitMQ  :35673
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info()    { echo "  ℹ️  $*"; }
success() { echo "  ✅ $*"; }
warn()    { echo "  ⚠️  $*" >&2; }
error()   { echo "  ❌ $*" >&2; }

# ---------------------------------------------------------------------------
# Prerequisite check
# ---------------------------------------------------------------------------
if ! command -v portless &>/dev/null; then
  error "portless is not installed."
  echo ""
  echo "  Install it with:"
  echo "    npm install -g portless"
  echo ""
  echo "  Then start the proxy:"
  echo "    portless proxy start"
  echo "  or for HTTPS:"
  echo "    portless proxy start --https"
  exit 1
fi

# ---------------------------------------------------------------------------
# Environment definitions: name  frontend_port  api_port  rabbitmq_mgmt_port
# ---------------------------------------------------------------------------
declare -A FRONTEND_PORT=([main]=43000 [dev]=13000 [uat]=23000 [prod]=33000)
declare -A API_PORT=(     [main]=48080 [dev]=18080 [uat]=28080 [prod]=38080)
declare -A RABBITMQ_PORT=([main]=45673 [dev]=15673 [uat]=25673 [prod]=35673)

ALL_ENVS=(main dev uat prod)

# ---------------------------------------------------------------------------
# Determine which environments to register
# ---------------------------------------------------------------------------
if [[ $# -eq 0 ]]; then
  ENVS=("${ALL_ENVS[@]}")
else
  ENVS=("$@")
fi

# Validate requested environments
for env in "${ENVS[@]}"; do
  if [[ -z "${FRONTEND_PORT[$env]+x}" ]]; then
    error "Unknown environment: '$env'. Valid values: ${ALL_ENVS[*]}"
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# Register aliases
# ---------------------------------------------------------------------------
echo ""
echo "🔗 Registering portless aliases..."
echo ""

for env in "${ENVS[@]}"; do
  fe_port="${FRONTEND_PORT[$env]}"
  api_port="${API_PORT[$env]}"
  rmq_port="${RABBITMQ_PORT[$env]}"

  echo "  📦 Environment: $env"

  if portless alias "axiom-${env}" "$fe_port" --force 2>/dev/null; then
    success "axiom-${env} → :${fe_port}  (frontend)"
  else
    warn "Failed to register axiom-${env} → :${fe_port}"
  fi

  if portless alias "api.axiom-${env}" "$api_port" --force 2>/dev/null; then
    success "api.axiom-${env} → :${api_port}  (backend API)"
  else
    warn "Failed to register api.axiom-${env} → :${api_port}"
  fi

  if portless alias "rabbitmq.axiom-${env}" "$rmq_port" --force 2>/dev/null; then
    success "rabbitmq.axiom-${env} → :${rmq_port}  (RabbitMQ management)"
  else
    warn "Failed to register rabbitmq.axiom-${env} → :${rmq_port}"
  fi

  echo ""
done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo "🌐 Active routes:"
portless list 2>/dev/null || true
echo ""
echo "💡 Tip: Use 'portless proxy start --https' for portless HTTPS URLs (no :1355 suffix)."
echo "💡 Tip: Safari users should also run 'portless hosts sync' once."
echo ""
echo "✅ Portless setup complete."
