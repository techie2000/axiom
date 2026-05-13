#!/usr/bin/env pwsh
# cleanup-lei-link-audit-rows.ps1
# PowerShell equivalent of scripts/cleanup-lei-link-audit-rows.sh
#
# Identifies and removes meaningless audit rows from lei_records_audit that
# were written by the pre-fix LEI link reconciliation pass. Those rows have
# an empty record_snapshot ('{}') and a changed_fields value containing only
# boolean flags ('{"managing_lou": true}' etc.) instead of real before/after
# values.
#
# Usage:
#   .\scripts\cleanup-lei-link-audit-rows.ps1 [-DryRun] [-Env <dev|uat|prod>]
#
# Options:
#   -DryRun    Show the count of rows that would be deleted without deleting
#   -Env       Target environment container name suffix (default: dev)
#
# Examples:
#   .\scripts\cleanup-lei-link-audit-rows.ps1 -DryRun
#   .\scripts\cleanup-lei-link-audit-rows.ps1 -Env dev
#   .\scripts\cleanup-lei-link-audit-rows.ps1 -Env prod

param(
    [switch]$DryRun,
    [string]$Env = "dev"
)

$ErrorActionPreference = "Stop"

$Container = "axiom-${Env}-postgres"
$DbUser = "axiom"
$DbName = "axiom_${Env}"

$VerifySql = @'
SELECT COUNT(*) AS rows_to_delete
FROM lei_raw.lei_records_audit
WHERE record_snapshot = '{}'::JSONB
AND (
    changed_fields = '{"managing_lou": true}'::JSONB
    OR changed_fields = '{"successor_lei": true}'::JSONB
    OR changed_fields = '{"managing_lou": true, "successor_lei": true}'::JSONB
);
'@

$DeleteSql = @'
DELETE FROM lei_raw.lei_records_audit
WHERE record_snapshot = '{}'::JSONB
AND (
    changed_fields = '{"managing_lou": true}'::JSONB
    OR changed_fields = '{"successor_lei": true}'::JSONB
    OR changed_fields = '{"managing_lou": true, "successor_lei": true}'::JSONB
);
'@

$PostDeleteSql = @'
SELECT COUNT(*) AS remaining_empty_snapshot_rows
FROM lei_raw.lei_records_audit
WHERE record_snapshot = '{}'::JSONB;
'@

Write-Host ""
Write-Host "=== LEI Link Reconciliation Audit Row Cleanup ===" -ForegroundColor Cyan
Write-Host "Container : $Container"
Write-Host "Database  : $DbName"
Write-Host "Dry run   : $DryRun"
Write-Host ""

Write-Host "--- Verification: rows matching the bad-audit pattern ---" -ForegroundColor Yellow
docker exec $Container psql -U $DbUser -d $DbName -c $VerifySql

if ($DryRun) {
    Write-Host ""
    Write-Host "Dry run complete. Run without -DryRun to delete these rows." -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

Write-Host ""
Write-Host "--- Deleting bad audit rows ---" -ForegroundColor Yellow
docker exec $Container psql -U $DbUser -d $DbName -c $DeleteSql

Write-Host ""
Write-Host "--- Post-delete verification: rows remaining with empty snapshot ---" -ForegroundColor Yellow
docker exec $Container psql -U $DbUser -d $DbName -c $PostDeleteSql

Write-Host ""
Write-Host "=== Cleanup complete ===" -ForegroundColor Cyan
Write-Host ""
