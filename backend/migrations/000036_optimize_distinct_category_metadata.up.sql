-- Optimize distinct category metadata query
-- Target query pattern:
-- SELECT DISTINCT BTRIM(entity_category)
-- FROM lei_raw.lei_records
-- WHERE entity_category IS NOT NULL
--   AND BTRIM(entity_category) <> ''
--   AND UPPER(BTRIM(entity_category)) <> 'NULL'
--   AND deleted_at IS NULL
-- ORDER BY BTRIM(entity_category)

CREATE INDEX IF NOT EXISTS idx_lei_records_category_trimmed_active
ON lei_raw.lei_records (BTRIM(entity_category))
WHERE deleted_at IS NULL
AND entity_category IS NOT NULL
AND BTRIM(entity_category) <> ''
AND UPPER(BTRIM(entity_category)) <> 'NULL';

ANALYZE lei_raw.lei_records;
