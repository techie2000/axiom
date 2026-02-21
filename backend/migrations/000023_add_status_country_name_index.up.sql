-- Optimize LEI summary filters that include status + country with name sorting
-- Target query pattern:
-- WHERE entity_status = ? AND legal_address_country = ? AND deleted_at IS NULL
-- ORDER BY legal_name ASC LIMIT ?

CREATE INDEX IF NOT EXISTS idx_lei_records_status_country_name_active
ON lei_raw.lei_records (entity_status, legal_address_country, legal_name)
WHERE deleted_at IS NULL;

ANALYZE lei_raw.lei_records;
