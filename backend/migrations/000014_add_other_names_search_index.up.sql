-- Migration: Add GIN index for other_names JSONB search performance
-- This enables efficient text search within the other_names JSONB column
-- which contains arrays of {"name": "...", "type": "...", "language": "..."}

-- Create GIN index on other_names for text search
-- This supports ILIKE queries on other_names::text used in name search
CREATE INDEX IF NOT EXISTS idx_lei_records_other_names_gin 
ON lei_raw.lei_records 
USING gin (other_names);

-- Add comment explaining index purpose
COMMENT ON INDEX lei_raw.idx_lei_records_other_names_gin IS 
'GIN index for efficient text search within other_names JSONB array. Supports queries like: other_names::text ILIKE ''%search%''';
