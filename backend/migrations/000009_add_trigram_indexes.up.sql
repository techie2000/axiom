-- Add pg_trgm extension for efficient ILIKE searches with wildcards
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Drop existing B-tree index on legal_name (not efficient for ILIKE '%search%')
DROP INDEX IF EXISTS lei_raw.idx_lei_records_legal_name;

-- Create GIN trigram index on legal_name for fast ILIKE '%search%' queries
CREATE INDEX idx_lei_records_legal_name_trgm ON lei_raw.lei_records USING GIN (legal_name gin_trgm_ops);

-- Also create trigram index on transliterated_legal_name
CREATE INDEX idx_lei_records_transliterated_legal_name_trgm ON lei_raw.lei_records USING GIN (transliterated_legal_name gin_trgm_ops);

-- Create composite index for LEI prefix searches (lei ILIKE 'ABC%')
CREATE INDEX idx_lei_records_lei_prefix ON lei_raw.lei_records (lei varchar_pattern_ops);

-- Add index on entity_category for filtering
CREATE INDEX idx_lei_records_entity_category ON lei_raw.lei_records (entity_category);

-- Add composite index for common filter combinations
CREATE INDEX idx_lei_records_status_country ON lei_raw.lei_records (entity_status, legal_address_country);

-- Analyze tables to update query planner statistics
ANALYZE lei_raw.lei_records;
