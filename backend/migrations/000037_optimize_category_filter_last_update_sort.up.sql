-- Optimize LEI list query for category filtering with last_update_date sorting
-- Target query pattern:
-- WHERE UPPER(BTRIM(entity_category)) = UPPER(BTRIM(?))
--   AND deleted_at IS NULL
-- ORDER BY last_update_date ASC|DESC LIMIT ?

CREATE INDEX IF NOT EXISTS idx_lei_records_category_normalized_last_update
ON lei_raw.lei_records (UPPER(BTRIM(entity_category)), last_update_date)
WHERE deleted_at IS NULL;

ANALYZE lei_raw.lei_records;
