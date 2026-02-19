-- Add composite full-text search column for efficient multi-column searching
-- This solves the problem of OR queries across multiple columns causing sequential scans

-- Add tsvector column to store combined search data
ALTER TABLE lei_raw.lei_records ADD COLUMN search_vector tsvector;

-- Populate the search vector with combined data from searchable columns
-- Weight: A (highest) for legal_name, B for transliterated_legal_name, C for other_names
UPDATE lei_raw.lei_records 
SET search_vector = 
    setweight(to_tsvector('simple', COALESCE(legal_name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(transliterated_legal_name, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(other_names::text, '')), 'C');

-- Create GIN index on the search vector for fast full-text search
CREATE INDEX idx_lei_records_search_vector ON lei_raw.lei_records USING gin(search_vector);

-- Create trigger function to automatically update search_vector on INSERT/UPDATE
CREATE OR REPLACE FUNCTION lei_raw.lei_records_search_vector_update()
RETURNS trigger AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('simple', COALESCE(NEW.legal_name, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.transliterated_legal_name, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(NEW.other_names::text, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function before insert or update
CREATE TRIGGER lei_records_search_vector_trigger
BEFORE INSERT OR UPDATE OF legal_name, transliterated_legal_name, other_names
ON lei_raw.lei_records
FOR EACH ROW
EXECUTE FUNCTION lei_raw.lei_records_search_vector_update();

-- Add comment explaining the column
COMMENT ON COLUMN lei_raw.lei_records.search_vector IS 
'Full-text search vector combining legal_name (weight A), transliterated_legal_name (weight B), and other_names (weight C) for efficient multi-column search queries';
