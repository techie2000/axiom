-- Optimize LEI list query for country filtering with last_update_date sorting
-- Target query pattern:
-- WHERE legal_address_country = ?
--   AND deleted_at IS NULL
-- ORDER BY last_update_date ASC|DESC LIMIT ?

CREATE INDEX IF NOT EXISTS idx_lei_records_country_last_update_active
ON lei_raw.lei_records (legal_address_country, last_update_date)
WHERE deleted_at IS NULL;

-- Optimize LEI list query for "Status = Not Set" filter with last_update_date sorting
-- Target query pattern:
-- WHERE (entity_status IS NULL OR TRIM(entity_status) = '' OR UPPER(TRIM(entity_status)) = 'NULL')
--   AND deleted_at IS NULL
-- ORDER BY last_update_date ASC|DESC LIMIT ? OFFSET ?

CREATE INDEX IF NOT EXISTS idx_lei_records_not_set_status_last_update
ON lei_raw.lei_records (last_update_date)
WHERE deleted_at IS NULL
AND (
    entity_status IS NULL
    OR TRIM(entity_status) = ''
    OR UPPER(TRIM(entity_status)) = 'NULL'
);

-- Optimize LEI list query for category + country filtering with last_update_date sorting
-- Target query pattern:
-- WHERE UPPER(BTRIM(entity_category)) = UPPER(BTRIM(?))
--   AND legal_address_country = ?
--   AND deleted_at IS NULL
-- ORDER BY last_update_date ASC|DESC LIMIT ?

CREATE INDEX IF NOT EXISTS idx_lei_records_category_country_last_update_active
ON lei_raw.lei_records (UPPER(BTRIM(entity_category)), legal_address_country, last_update_date)
WHERE deleted_at IS NULL;

ANALYZE lei_raw.lei_records;
