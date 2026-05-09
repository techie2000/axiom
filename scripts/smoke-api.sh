#!/usr/bin/env bash
# smoke-api.sh
# Bash equivalent of scripts/smoke-api.ps1
#
# Runs API smoke tests for main, dev, UAT, and/or prod environments.
#
# Checks per environment:
#   - GET /health returns HTTP 200 and body contains "healthy"
#   - GET /version returns HTTP 200
#   - GET /api/v1/entities without auth returns HTTP 401
#   - GET /api/v1/entities with a generated HS256 JWT is accepted (not 401/403)
#   - (optional) POST /api/v1/auth/login returns HTTP 200 (informational)
#
# Requires: curl, openssl (or python3 for HMAC), jq
#
# Usage:
#   bash scripts/smoke-api.sh [--environment main|dev|uat|prod|all]
#       [--timeout-sec 20] [--startup-wait-sec 90] [--check-login]

set -euo pipefail

ENVIRONMENT="all"
TIMEOUT_SEC=20
STARTUP_WAIT_SEC=90
CHECK_LOGIN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --environment|-e) ENVIRONMENT="$2"; shift 2 ;;
    --timeout-sec)    TIMEOUT_SEC="$2"; shift 2 ;;
    --startup-wait-sec) STARTUP_WAIT_SEC="$2"; shift 2 ;;
    --check-login)    CHECK_LOGIN=true; shift ;;
    *) echo "Unknown argument: $1"; echo "Usage: $0 [--environment main|dev|uat|prod|all] [--timeout-sec N] [--startup-wait-sec N] [--check-login]"; exit 1 ;;
  esac
done

case "$ENVIRONMENT" in
  main|dev|uat|prod|all) ;;
  *) echo "Invalid environment '$ENVIRONMENT'. Valid values: main, dev, uat, prod, all"; exit 1 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$WORKSPACE_ROOT"

# ---------------------------------------------------------------------------
# JWT generation: pure bash using python3 (available on all CI runners)
# ---------------------------------------------------------------------------
make_hs256_jwt() {
  local secret="$1" user_id="$2" email="$3"

  python3 - "$secret" "$user_id" "$email" <<'PYEOF'
import sys, base64, json, hmac, hashlib

secret, user_id, email = sys.argv[1], sys.argv[2], sys.argv[3]

def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

header  = b64url(json.dumps({"alg":"HS256","typ":"JWT"}, separators=(',',':')).encode())
payload = b64url(json.dumps({"user_id": user_id, "email": email}, separators=(',',':')).encode())
unsigned = f"{header}.{payload}"
sig = b64url(hmac.new(secret.encode(), unsigned.encode(), hashlib.sha256).digest())
print(f"{unsigned}.{sig}")
PYEOF
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
parse_env_value() {
  local file="$1" key="$2"
  grep -E "^[[:space:]]*${key}=" "$file" | head -1 | cut -d= -f2- | tr -d '[:space:]' || true
}

http_get() {
  local url="$1" timeout="$2"
  shift 2
  curl -so /dev/null -w "%{http_code}" --max-time "$timeout" "$@" "$url" 2>/dev/null || true
}

wait_api_ready() {
  local base_url="$1" max_sec="$2"
  [[ "$max_sec" -le 0 ]] && return 0

  local deadline=$((SECONDS + max_sec))
  while [[ $SECONDS -lt $deadline ]]; do
    local code
    code="$(http_get "${base_url}/health" 5)"
    if [[ "$code" == "200" ]]; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# ---------------------------------------------------------------------------
# Build target list
# ---------------------------------------------------------------------------
if [[ "$ENVIRONMENT" == "all" ]]; then
  TARGETS=("main" "dev" "uat" "prod")
else
  TARGETS=("$ENVIRONMENT")
fi

FAILED=0

echo ""
echo "=== Axiom API Smoke Test ==="
echo "Workspace: $WORKSPACE_ROOT"
echo "Targets: ${TARGETS[*]}"
echo "Timeout: ${TIMEOUT_SEC}s"
echo "Startup wait: ${STARTUP_WAIT_SEC}s max"
echo ""

declare -A RESULT_HEALTH RESULT_VERSION RESULT_UNAUTH RESULT_AUTH RESULT_LOGIN RESULT_PASS

for env_name in "${TARGETS[@]}"; do
  env_file="${WORKSPACE_ROOT}/.env.${env_name}"
  backend_port="$(parse_env_value "$env_file" "BACKEND_PORT")"
  jwt_secret="$(parse_env_value "$env_file" "JWT_SECRET")"

  if [[ -z "$backend_port" ]]; then
    echo "BACKEND_PORT missing in $env_file"
    FAILED=$((FAILED + 1))
    continue
  fi
  if [[ -z "$jwt_secret" ]]; then
    echo "JWT_SECRET missing in $env_file"
    FAILED=$((FAILED + 1))
    continue
  fi

  BASE_URL="http://localhost:${backend_port}"
  echo "[${env_name^^}] Base URL: $BASE_URL"

  if ! wait_api_ready "$BASE_URL" "$STARTUP_WAIT_SEC"; then
    echo "  readiness=TIMEOUT after ${STARTUP_WAIT_SEC}s; continuing with checks"
  fi

  health_code="$(http_get "${BASE_URL}/health" "$TIMEOUT_SEC")"
  health_body="$(curl -sf --max-time "$TIMEOUT_SEC" "${BASE_URL}/health" 2>/dev/null || true)"
  version_code="$(http_get "${BASE_URL}/version" "$TIMEOUT_SEC")"
  unauth_code="$(http_get "${BASE_URL}/api/v1/entities?limit=1&offset=0" "$TIMEOUT_SEC")"

  jwt="$(make_hs256_jwt "$jwt_secret" "00000000-0000-0000-0000-000000000001" "smoke@test.local")"
  auth_code="$(http_get "${BASE_URL}/api/v1/entities?limit=1&offset=0" "$TIMEOUT_SEC" -H "Authorization: Bearer ${jwt}")"

  login_code=""
  if $CHECK_LOGIN; then
    login_code="$(curl -so /dev/null -w "%{http_code}" --max-time "$TIMEOUT_SEC" \
      -X POST -H "Content-Type: application/json" -d '{"email":"x","password":"y"}' \
      "${BASE_URL}/api/v1/auth/login" 2>/dev/null || true)"
  fi

  health_ok=false
  [[ "$health_code" == "200" && "$health_body" == *"healthy"* ]] && health_ok=true
  version_ok=false; [[ "$version_code" == "200" ]] && version_ok=true
  unauth_ok=false; [[ "$unauth_code" == "401" ]] && unauth_ok=true
  auth_accepted=false
  [[ -n "$auth_code" && "$auth_code" != "401" && "$auth_code" != "403" ]] && auth_accepted=true

  all_passed=false
  $health_ok && $version_ok && $unauth_ok && $auth_accepted && all_passed=true

  RESULT_HEALTH[$env_name]="$health_code"
  RESULT_VERSION[$env_name]="$version_code"
  RESULT_UNAUTH[$env_name]="$unauth_code"
  RESULT_AUTH[$env_name]="$auth_code"
  RESULT_LOGIN[$env_name]="${login_code:-n/a}"
  RESULT_PASS[$env_name]="$($all_passed && echo PASS || echo FAIL)"

  $all_passed || FAILED=$((FAILED + 1))

  echo "  health=${health_code} version=${version_code} unauth=${unauth_code} auth=${auth_code}"
  $CHECK_LOGIN && echo "  login=${login_code} (informational)"
  echo "  result=$($all_passed && echo PASS || echo FAIL)"
  echo ""
done

echo "=== Summary ==="
printf '%-10s %-8s %-8s %-8s %-8s %-8s %s\n' "Env" "Health" "Version" "Unauth" "Auth" "Login" "Passed"
for env_name in "${TARGETS[@]}"; do
  printf '%-10s %-8s %-8s %-8s %-8s %-8s %s\n' \
    "$env_name" \
    "${RESULT_HEALTH[$env_name]:-?}" \
    "${RESULT_VERSION[$env_name]:-?}" \
    "${RESULT_UNAUTH[$env_name]:-?}" \
    "${RESULT_AUTH[$env_name]:-?}" \
    "${RESULT_LOGIN[$env_name]:-?}" \
    "${RESULT_PASS[$env_name]:-?}"
done

if [[ "$FAILED" -gt 0 ]]; then
  echo ""
  echo "One or more environments failed smoke checks."
  exit 1
fi

echo ""
echo "All smoke checks passed."
exit 0
