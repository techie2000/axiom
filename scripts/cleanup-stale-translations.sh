#!/usr/bin/env bash
# cleanup-stale-translations.sh
# Bash equivalent of scripts/cleanup-stale-translations.ps1
#
# Fetches all translation rows from the admin API, compares them against the
# locale JSON file, and deletes any rows whose key is no longer present.
#
# Requires: curl, jq
#
# Usage:
#   bash scripts/cleanup-stale-translations.sh \
#     --api-base-url http://localhost:18080 \
#     --bearer-token <token> \
#     [--locale-file frontend/public/locales/en/common.json] \
#     [--what-if]

set -euo pipefail

API_BASE_URL=""
BEARER_TOKEN=""
LOCALE_FILE="frontend/public/locales/en/common.json"
WHAT_IF=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-base-url)  API_BASE_URL="$2"; shift 2 ;;
    --bearer-token)  BEARER_TOKEN="$2"; shift 2 ;;
    --locale-file)   LOCALE_FILE="$2"; shift 2 ;;
    --what-if)       WHAT_IF=true; shift ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

if [[ -z "$API_BASE_URL" ]]; then
  echo "--api-base-url is required"
  exit 1
fi

if [[ ! -f "$LOCALE_FILE" ]]; then
  echo "Locale file not found: $LOCALE_FILE"
  exit 1
fi

# Flatten all leaf keys from the JSON locale file using jq
# Produces output like: "key.subkey.leaf"
VALID_KEYS="$(jq -r '[paths(type == "string") | join(".")] | .[]' "$LOCALE_FILE")"

# Paginate through all translation rows
PAGE_SIZE=200
OFFSET=0
PAGE_COUNT=0
ALL_RECORDS="[]"

while true; do
  URI="${API_BASE_URL}/api/v1/admin/translations?limit=${PAGE_SIZE}&offset=${OFFSET}"

  RESPONSE="$(curl -sf -H "Authorization: Bearer ${BEARER_TOKEN}" "$URI")"
  PAGE_RECORDS="$(echo "$RESPONSE" | jq '.records // []')"
  COUNT="$(echo "$PAGE_RECORDS" | jq 'length')"
  PAGE_COUNT=$((PAGE_COUNT + 1))

  echo "Fetched translation page $PAGE_COUNT (offset=$OFFSET, rows=$COUNT)"

  if [[ "$COUNT" -eq 0 ]]; then
    break
  fi

  ALL_RECORDS="$(echo "${ALL_RECORDS} ${PAGE_RECORDS}" | jq -s '.[0] + .[1]')"

  if [[ "$COUNT" -lt "$PAGE_SIZE" ]]; then
    break
  fi

  OFFSET=$((OFFSET + PAGE_SIZE))
done

echo "Translation pages fetched: $PAGE_COUNT"

TOTAL="$(echo "$ALL_RECORDS" | jq 'length')"

# Find stale rows: those whose translation_key is not in the valid key set
STALE="$(echo "$ALL_RECORDS" | jq --argjson valid "$(echo "$VALID_KEYS" | jq -Rs '[split("\n")[] | select(length>0)]')" \
  '[.[] | select(.translation_key as $k | ($valid | index($k)) == null)]')"
STALE_COUNT="$(echo "$STALE" | jq 'length')"

echo "Total translation rows: $TOTAL"
echo "Stale rows detected: $STALE_COUNT"

if [[ "$STALE_COUNT" -eq 0 ]]; then
  echo "No stale translations to delete."
  exit 0
fi

if $WHAT_IF; then
  echo "WhatIf enabled. Stale rows:"
  echo "$STALE" | jq -r '.[] | "  id=\(.id) key=\(.translation_key) lang=\(.language_code // "?") status=\(.status // "?")'
  exit 0
fi

if [[ -z "$BEARER_TOKEN" ]]; then
  echo "BearerToken is required for delete mode. Use --what-if for dry-run without auth."
  exit 1
fi

DELETED=0
FAILED=0

while IFS= read -r row; do
  id="$(echo "$row" | jq -r '.id')"
  key="$(echo "$row" | jq -r '.translation_key')"

  if curl -sf -X DELETE -H "Authorization: Bearer ${BEARER_TOKEN}" \
       "${API_BASE_URL}/api/v1/translations/${id}" > /dev/null; then
    DELETED=$((DELETED + 1))
  else
    FAILED=$((FAILED + 1))
    echo "WARNING: Failed to delete translation id=${id} key=${key}" >&2
  fi
done < <(echo "$STALE" | jq -c '.[]')

echo "Deleted stale translations: $DELETED"
echo "Failed deletions: $FAILED"

if [[ "$FAILED" -gt 0 ]]; then
  exit 1
fi
