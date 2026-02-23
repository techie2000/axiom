-- Rollback repair for search_vector infrastructure

DROP TRIGGER IF EXISTS lei_records_search_vector_trigger ON lei_raw.lei_records;

DROP FUNCTION IF EXISTS lei_raw.lei_records_search_vector_update();

DROP INDEX IF EXISTS lei_raw.idx_lei_records_search_vector;

ALTER TABLE lei_raw.lei_records
DROP COLUMN IF EXISTS search_vector;
