-- Rollback full-text search vector optimization

-- Drop the trigger
DROP TRIGGER IF EXISTS lei_records_search_vector_trigger ON lei_raw.lei_records;

-- Drop the trigger function
DROP FUNCTION IF EXISTS lei_raw.lei_records_search_vector_update();

-- Drop the index
DROP INDEX IF EXISTS lei_raw.idx_lei_records_search_vector;

-- Drop the column
ALTER TABLE lei_raw.lei_records DROP COLUMN IF EXISTS search_vector;
