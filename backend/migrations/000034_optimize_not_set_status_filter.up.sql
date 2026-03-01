-- Optimize LEI list query for "Status = Not Set" filter with name sorting
-- Target query pattern:
-- WHERE (entity_status IS NULL OR BTRIM(entity_status) = '' OR UPPER(BTRIM(entity_status)) = 'NULL')
--   AND deleted_at IS NULL
-- ORDER BY legal_name ASC LIMIT ?

CREATE INDEX IF NOT EXISTS idx_lei_records_not_set_status_name
ON lei_raw.lei_records (legal_name)
WHERE deleted_at IS NULL
AND (
    entity_status IS NULL
    OR BTRIM(entity_status) = ''
    OR UPPER(BTRIM(entity_status)) = 'NULL'
);

ANALYZE lei_raw.lei_records;
