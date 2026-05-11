-- Optimize LEI list queries for not-set status + category filter with legal_name ordering.
-- Target query pattern:
-- WHERE (entity_status IS NULL OR TRIM(entity_status) = '' OR UPPER(TRIM(entity_status)) = 'NULL')
--   AND UPPER(BTRIM(entity_category)) = UPPER(BTRIM(?))
--   AND deleted_at IS NULL
-- ORDER BY legal_name ASC LIMIT ?

CREATE INDEX IF NOT EXISTS idx_lei_records_not_set_status_category_name
ON lei_raw.lei_records (UPPER(BTRIM(entity_category)), legal_name)
WHERE deleted_at IS NULL
AND (entity_status IS NULL OR TRIM(entity_status) = '' OR UPPER(TRIM(entity_status)) = 'NULL');

ANALYZE lei_raw.lei_records;
