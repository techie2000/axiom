#!/usr/bin/env bash
# smoke-ssi.sh
# Bash equivalent of scripts/smoke-ssi.ps1
#
# Runs SSI smoke tests against the specified environment.
# Optionally seeds temporary rows before the test and cleans them up after.
#
# Requires: curl, jq, python3 (for JWT), docker
#
# Usage:
#   bash scripts/smoke-ssi.sh [--environment main|dev|uat|prod]
#       [--api-base-url URL]
#       [--seed-smoke-data]
#       [--cleanup-smoke-data]
#       [--timeout-sec 25]

set -euo pipefail

ENVIRONMENT="dev"
API_BASE_URL=""
SEED_SMOKE_DATA=false
CLEANUP_SMOKE_DATA=false
TIMEOUT_SEC=25

while [[ $# -gt 0 ]]; do
  case "$1" in
    --environment|-e)    ENVIRONMENT="$2"; shift 2 ;;
    --api-base-url)      API_BASE_URL="$2"; shift 2 ;;
    --seed-smoke-data)   SEED_SMOKE_DATA=true; shift ;;
    --cleanup-smoke-data) CLEANUP_SMOKE_DATA=true; shift ;;
    --timeout-sec)       TIMEOUT_SEC="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

case "$ENVIRONMENT" in
  main|dev|uat|prod) ;;
  *) echo "Invalid environment '$ENVIRONMENT'. Valid values: main, dev, uat, prod"; exit 1 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(dirname "$SCRIPT_DIR")"

# ---------------------------------------------------------------------------
# Environment config
# ---------------------------------------------------------------------------
case "$ENVIRONMENT" in
  main) ENV_FILE=".env.main"; COMPOSE_FILE="docker-compose.main.yml"; DEFAULT_URL="http://localhost:48080"; DATABASE="axiom_main" ;;
  dev)  ENV_FILE=".env.dev";  COMPOSE_FILE="docker-compose.dev.yml";  DEFAULT_URL="http://localhost:18080"; DATABASE="axiom_dev"  ;;
  uat)  ENV_FILE=".env.uat";  COMPOSE_FILE="docker-compose.uat.yml";  DEFAULT_URL="http://localhost:28080"; DATABASE="axiom_uat"  ;;
  prod) ENV_FILE=".env.prod"; COMPOSE_FILE="docker-compose.prod.yml"; DEFAULT_URL="http://localhost:38080"; DATABASE="axiom_prod" ;;
esac

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file not found: $ENV_FILE"
  exit 1
fi

RESOLVED_URL="${API_BASE_URL:-$DEFAULT_URL}"
RESOLVED_URL="${RESOLVED_URL%/}"

# ---------------------------------------------------------------------------
# JWT generation via python3 (mirrors PS1 implementation)
# ---------------------------------------------------------------------------
make_jwt() {
  local secret="$1"
  python3 - "$secret" <<'PYEOF'
import sys, base64, json, hmac, hashlib

secret = sys.argv[1]
header_json  = '{"alg":"HS256","typ":"JWT"}'
payload_json = '{"user_id":"00000000-0000-0000-0000-000000000001","email":"smoke@test.local"}'

def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

h = b64url(header_json.encode())
p = b64url(payload_json.encode())
unsigned = f"{h}.{p}"
sig = b64url(hmac.new(secret.encode(), unsigned.encode(), hashlib.sha256).digest())
print(f"{unsigned}.{sig}")
PYEOF
}

# ---------------------------------------------------------------------------
# SQL helper
# ---------------------------------------------------------------------------
invoke_sql() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
    psql -U axiom -d "$DATABASE" -c "$1" > /dev/null
}

# ---------------------------------------------------------------------------
# Resolve JWT secret
# ---------------------------------------------------------------------------
SECRET_LINE="$(grep -E '^JWT_SECRET=' "$ENV_FILE" | head -1 || true)"
if [[ -z "$SECRET_LINE" ]]; then
  echo "JWT_SECRET missing in $ENV_FILE"
  exit 1
fi
JWT_SECRET="${SECRET_LINE#JWT_SECRET=}"
JWT_SECRET="${JWT_SECRET// /}"

TOKEN="$(make_jwt "$JWT_SECRET")"

# ---------------------------------------------------------------------------
# Optional seed
# ---------------------------------------------------------------------------
if $SEED_SMOKE_DATA; then
  echo "[SSI Smoke] Seeding 2 temporary rows..."
  invoke_sql "DELETE FROM ssis WHERE beneficiary_name IN ('SSI Smoke CP 1','SSI Smoke CP 2');"
  invoke_sql "INSERT INTO ssis (beneficiary_name, beneficiary_account, beneficiary_bank, beneficiary_bank_bic, intermediary_bank, intermediary_bank_bic, settlement_type, active, valid_from) VALUES ('SSI Smoke CP 1','GB29NWBK60161331926819','Smoke Bank UK','NWBKGB2L','Intermediary One','IRVTUS3N','DAP',TRUE,NOW()),('SSI Smoke CP 2','SE4550000000058398257466','Smoke Bank SE','ESSESESS','Intermediary Two','CHASUS33','FOP',TRUE,NOW());"
fi

REQUIRED_FIELDS=("id" "ssi_reference" "counterparty_name" "account_name" "country_code" "currency" "bic" "iban" "settlement_method" "status" "updated_at")

# ---------------------------------------------------------------------------
# Call SSI endpoint
# ---------------------------------------------------------------------------
echo "[SSI Smoke] Calling ${RESOLVED_URL}/api/v1/ssis ..."

RESPONSE="$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT_SEC" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Accept: application/json" \
  "${RESOLVED_URL}/api/v1/ssis?limit=500&offset=0")"

HTTP_CODE="$(echo "$RESPONSE" | tail -1)"
BODY="$(echo "$RESPONSE" | head -n -1)"

RECORDS_COUNT="$(echo "$BODY" | jq '[.[] // empty] | length' 2>/dev/null || echo 0)"

# Check missing fields against first record
MISSING_FIELDS=()
if [[ "$RECORDS_COUNT" -gt 0 ]]; then
  for field in "${REQUIRED_FIELDS[@]}"; do
    if ! echo "$BODY" | jq -e ".[0] | has(\"$field\")" > /dev/null 2>&1; then
      MISSING_FIELDS+=("$field")
    fi
  done
fi

SMOKE_ROWS_COUNT="$(echo "$BODY" | jq '[.[] | select(.counterparty_name == "SSI Smoke CP 1" or .counterparty_name == "SSI Smoke CP 2")] | length' 2>/dev/null || echo 0)"
BGC_MATCHES="$(echo "$BODY" | jq '[.[] | select((.counterparty_name // "" | test("BGC")) or (.account_name // "" | test("BGC")))] | length' 2>/dev/null || echo 0)"

MISSING_FIELDS_STR="none"
[[ ${#MISSING_FIELDS[@]} -gt 0 ]] && MISSING_FIELDS_STR="$(IFS=','; echo "${MISSING_FIELDS[*]}")"

echo "[SSI Smoke] http_status=${HTTP_CODE}"
echo "[SSI Smoke] records=${RECORDS_COUNT}"
echo "[SSI Smoke] missing_fields=${MISSING_FIELDS_STR}"
echo "[SSI Smoke] smoke_rows=${SMOKE_ROWS_COUNT}"
echo "[SSI Smoke] bgc_matches=${BGC_MATCHES}"

# ---------------------------------------------------------------------------
# Optional cleanup
# ---------------------------------------------------------------------------
if $CLEANUP_SMOKE_DATA; then
  echo "[SSI Smoke] Cleaning temporary rows..."
  invoke_sql "DELETE FROM ssis WHERE beneficiary_name IN ('SSI Smoke CP 1','SSI Smoke CP 2');"
fi

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------
IS_PASS=true
[[ "$HTTP_CODE" != "200" ]] && IS_PASS=false
[[ ${#MISSING_FIELDS[@]} -gt 0 ]] && IS_PASS=false
[[ "$BGC_MATCHES" -gt 0 ]] && IS_PASS=false

if $IS_PASS; then
  echo "[SSI Smoke] result=PASS"
  exit 0
else
  echo "[SSI Smoke] result=FAIL"
  exit 1
fi
