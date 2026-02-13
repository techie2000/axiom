-- Remove trigram indexes
DROP INDEX IF EXISTS lei_raw.idx_lei_records_legal_name_trgm;
DROP INDEX IF EXISTS lei_raw.idx_lei_records_transliterated_legal_name_trgm;
DROP INDEX IF EXISTS lei_raw.idx_lei_records_lei_prefix;
DROP INDEX IF EXISTS lei_raw.idx_lei_records_entity_category;
DROP INDEX IF EXISTS lei_raw.idx_lei_records_status_country;

-- Restore original B-tree index on legal_name
CREATE INDEX idx_lei_records_legal_name ON lei_raw.lei_records (legal_name);

-- Note: pg_trgm extension is not dropped as other schemas might use it
