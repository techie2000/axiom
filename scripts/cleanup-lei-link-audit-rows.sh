#!/usr/bin/env bash
# cleanup-lei-link-audit-rows.sh
# Bash equivalent of scripts/cleanup-lei-link-audit-rows.ps1
#
# Identifies and removes meaningless audit rows from lei_records_audit that
# were written by the pre-fix LEI link reconciliation pass. Those rows have
# an empty record_snapshot ('{}') and a changed_fields value containing only
# boolean flags ('{"managing_lou": true}' etc.) instead of real before/after
# values.
#
# Usage:
#   bash scripts/cleanup-lei-link-audit-rows.sh [--dry-run] [--env <dev|main|uat|prod>]
#
# Options:
#   --dry-run   Show the count of rows that would be deleted without deleting
#   --env       Target environment container name suffix (default: dev)
#
# Examples:
#   bash scripts/cleanup-lei-link-audit-rows.sh --dry-run
#   bash scripts/cleanup-lei-link-audit-rows.sh --env dev
#   bash scripts/cleanup-lei-link-audit-rows.sh --env main
#   bash scripts/cleanup-lei-link-audit-rows.sh --env prod

set -euo pipefail

DRY_RUN=false
ENV="dev"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=true; shift ;;
        --env)
            if [[ $# -lt 2 ]]; then
                echo "Missing value for --env. Allowed values: dev|main|uat|prod" >&2
                exit 1
            fi
            ENV="$2"
            shift 2
            ;;
        *) echo "Unknown argument: $1" >&2; exit 1 ;;
    esac
done

case "$ENV" in
    dev|main|uat|prod) ;;
    *)
        echo "Invalid --env value: $ENV. Allowed values: dev|main|uat|prod" >&2
        exit 1
        ;;
esac

CONTAINER="axiom-${ENV}-postgres"
DB_USER="axiom"
DB_NAME="axiom_${ENV}"

VERIFY_SQL="
SELECT COUNT(*) AS rows_to_delete
FROM lei_raw.lei_records_audit
WHERE record_snapshot = '{}'::JSONB
AND (
    changed_fields = '{\"managing_lou\": true}'::JSONB
    OR changed_fields = '{\"successor_lei\": true}'::JSONB
    OR changed_fields = '{\"managing_lou\": true, \"successor_lei\": true}'::JSONB
);
"

DELETE_SQL="
DELETE FROM lei_raw.lei_records_audit
WHERE record_snapshot = '{}'::JSONB
AND (
    changed_fields = '{\"managing_lou\": true}'::JSONB
    OR changed_fields = '{\"successor_lei\": true}'::JSONB
    OR changed_fields = '{\"managing_lou\": true, \"successor_lei\": true}'::JSONB
);
"

echo ""
echo "=== LEI Link Reconciliation Audit Row Cleanup ==="
echo "Container : ${CONTAINER}"
echo "Database  : ${DB_NAME}"
echo "Dry run   : ${DRY_RUN}"
echo ""

echo "--- Verification: rows matching the bad-audit pattern ---"
docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -c "${VERIFY_SQL}"

if [ "${DRY_RUN}" = "true" ]; then
    echo ""
    echo "Dry run complete. Run without --dry-run to delete these rows."
    echo ""
    exit 0
fi

echo ""
echo "--- Deleting bad audit rows ---"
docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -c "${DELETE_SQL}"

echo ""
echo "--- Post-delete verification: rows remaining with empty snapshot ---"
docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -c "
SELECT COUNT(*) AS remaining_empty_snapshot_rows
FROM lei_raw.lei_records_audit
WHERE record_snapshot = '{}'::JSONB;
"

echo ""
echo "=== Cleanup complete ==="
echo ""
