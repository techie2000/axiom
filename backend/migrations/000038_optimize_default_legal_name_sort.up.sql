-- Optimize default LEI browse query when user sorts by legal_name without additional filters
-- Target query pattern:
-- SELECT ...
-- FROM lei_raw.lei_records
-- WHERE deleted_at IS NULL
-- ORDER BY legal_name ASC|DESC
-- LIMIT ?

CREATE INDEX IF NOT EXISTS idx_lei_records_legal_name_active
ON lei_raw.lei_records (legal_name)
WHERE deleted_at IS NULL;

ANALYZE lei_raw.lei_records;
