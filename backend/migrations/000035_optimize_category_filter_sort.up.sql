-- Optimize LEI list query for category filtering with name sorting
-- Target query pattern:
-- WHERE UPPER(BTRIM(entity_category)) = UPPER(BTRIM(?))
--   AND deleted_at IS NULL
-- ORDER BY legal_name ASC LIMIT ?

CREATE INDEX IF NOT EXISTS idx_lei_records_category_normalized_name
ON lei_raw.lei_records (UPPER(BTRIM(entity_category)), legal_name)
WHERE deleted_at IS NULL;

ANALYZE lei_raw.lei_records;
