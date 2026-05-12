#!/usr/bin/env bash
# monitor-lei-sync.sh
# Bash equivalent of scripts/monitor-lei-sync.ps1
#
# Monitors the LEI full sync progress against the dev environment.
#
# Usage:
#   bash scripts/monitor-lei-sync.sh

set -euo pipefail

echo ""
echo "=== LEI Full Sync Progress Monitor ==="
echo "Expected: 3,209,464 records (~9-10 hours processing)"
echo ""

echo "Download Status:"
docker logs axiom-dev-backend 2>&1 | grep -E "downloaded successfully|Starting file processing" | tail -1 || true

echo ""
echo "Database Status:"
docker exec axiom-dev-postgres psql -U axiom -d axiom_dev -c "
SELECT
    COUNT(*) AS current_records,
    COALESCE((SELECT total_records FROM lei_raw.source_files WHERE file_type='FULL' ORDER BY downloaded_at DESC LIMIT 1), 0) AS expected_records,
    ROUND((COUNT(*)::numeric / NULLIF((SELECT total_records FROM lei_raw.source_files WHERE file_type='FULL' ORDER BY downloaded_at DESC LIMIT 1), 0)) * 100, 2) AS percent_complete,
    TO_CHAR(NOW(), 'HH24:MI:SS') AS current_time
FROM lei_raw.lei_records;
" 2>&1 || true

echo ""
echo "Latest Processing Log:"
docker logs axiom-dev-backend 2>&1 | grep "Processing progress" | tail -1 || true

echo ""
echo "Source Files:"
docker exec axiom-dev-postgres psql -U axiom -d axiom_dev -c "
SELECT
    file_type,
    total_records,
    processed_records,
    failed_records,
    processing_status,
    TO_CHAR(downloaded_at, 'YYYY-MM-DD HH24:MI:SS') AS downloaded
FROM lei_raw.source_files
ORDER BY downloaded_at DESC
LIMIT 3;
" 2>&1 || true

echo ""
echo "=== End of Report ==="
echo "Run this script again to check progress"
echo ""
