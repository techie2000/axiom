CREATE INDEX IF NOT EXISTS idx_lei_records_legal_region_trimmed_active
ON lei_raw.lei_records (BTRIM(legal_address_region))
WHERE deleted_at IS NULL
AND legal_address_region IS NOT NULL
AND BTRIM(legal_address_region) <> '';

CREATE INDEX IF NOT EXISTS idx_lei_records_hq_region_trimmed_active
ON lei_raw.lei_records (BTRIM(hq_address_region))
WHERE deleted_at IS NULL
AND hq_address_region IS NOT NULL
AND BTRIM(hq_address_region) <> '';

CREATE INDEX IF NOT EXISTS idx_lei_records_legal_form_trimmed_active
ON lei_raw.lei_records (BTRIM(entity_legal_form))
WHERE deleted_at IS NULL
AND entity_legal_form IS NOT NULL
AND BTRIM(entity_legal_form) <> '';
