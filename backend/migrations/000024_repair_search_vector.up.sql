-- Repair migration: ensure search_vector full-text search infrastructure exists.
-- This addresses schema drift cases where schema_migrations is up-to-date
-- but search_vector artifacts were not present in the database.

ALTER TABLE lei_raw.lei_records
ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

UPDATE lei_raw.lei_records
SET search_vector =
    SETWEIGHT(TO_TSVECTOR('simple', COALESCE(legal_name, '')), 'A')
    || SETWEIGHT(TO_TSVECTOR('simple', COALESCE(transliterated_legal_name, '')), 'B')
    || SETWEIGHT(TO_TSVECTOR('simple', COALESCE(other_names::TEXT, '')), 'C')
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_lei_records_search_vector
ON lei_raw.lei_records USING gin (search_vector);

CREATE OR REPLACE FUNCTION lei_raw.lei_records_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        SETWEIGHT(TO_TSVECTOR('simple', COALESCE(NEW.legal_name, '')), 'A')
        || SETWEIGHT(TO_TSVECTOR('simple', COALESCE(NEW.transliterated_legal_name, '')), 'B')
        || SETWEIGHT(TO_TSVECTOR('simple', COALESCE(NEW.other_names::TEXT, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lei_records_search_vector_trigger ON lei_raw.lei_records;

CREATE TRIGGER lei_records_search_vector_trigger
BEFORE INSERT OR UPDATE OF legal_name, transliterated_legal_name, other_names
ON lei_raw.lei_records
FOR EACH ROW
EXECUTE FUNCTION lei_raw.lei_records_search_vector_update();

ANALYZE lei_raw.lei_records;
