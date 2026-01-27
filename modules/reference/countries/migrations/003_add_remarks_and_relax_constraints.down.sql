-- Migration: 003_add_remarks_and_relax_constraints.down.sql
-- Rollback migration 003

-- Drop the full-text search index
DROP INDEX IF EXISTS reference.idx_countries_remarks_fulltext;

-- Restore the trigger function to original version (without remarks)
CREATE OR REPLACE FUNCTION reference.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update timestamp if data actually changed
    IF (OLD.alpha3, OLD.alpha4, OLD.numeric, OLD.name_english, 
        OLD.name_french, OLD.status, OLD.start_date, OLD.end_date) IS DISTINCT FROM
       (NEW.alpha3, NEW.alpha4, NEW.numeric, NEW.name_english, 
        NEW.name_french, NEW.status, NEW.start_date, NEW.end_date) THEN
        NEW.updated_at = NOW();
    ELSE
        NEW.updated_at = OLD.updated_at;  -- Keep original timestamp
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop status-specific CHECK constraints
ALTER TABLE reference.countries DROP CONSTRAINT IF EXISTS chk_unassigned_fields;
ALTER TABLE reference.countries DROP CONSTRAINT IF EXISTS chk_no_formerly_used;
ALTER TABLE reference.countries DROP CONSTRAINT IF EXISTS chk_transitionally_reserved_fields;
ALTER TABLE reference.countries DROP CONSTRAINT IF EXISTS chk_reserved_fields;
ALTER TABLE reference.countries DROP CONSTRAINT IF EXISTS chk_officially_assigned_fields;

-- Drop partial UNIQUE indexes
DROP INDEX IF EXISTS reference.idx_countries_numeric_unique;
DROP INDEX IF EXISTS reference.idx_countries_alpha3_unique;

-- Restore UNIQUE constraints on alpha3 and numeric
-- Note: This will fail if data exists with duplicate/NULL values
-- Manual cleanup required before rollback
ALTER TABLE reference.countries 
    ADD CONSTRAINT countries_alpha3_key UNIQUE (alpha3);

ALTER TABLE reference.countries 
    ADD CONSTRAINT countries_numeric_key UNIQUE (numeric);

-- Restore NOT NULL constraints
-- Note: This will fail if NULL values exist in these columns
-- Manual cleanup required before rollback
ALTER TABLE reference.countries 
    ALTER COLUMN name_french SET NOT NULL;

ALTER TABLE reference.countries 
    ALTER COLUMN name_english SET NOT NULL;

ALTER TABLE reference.countries 
    ALTER COLUMN numeric SET NOT NULL;

ALTER TABLE reference.countries 
    ALTER COLUMN alpha3 SET NOT NULL;

-- Drop remarks column
ALTER TABLE reference.countries 
    DROP COLUMN IF EXISTS remarks;

-- Remove table comment
COMMENT ON TABLE reference.countries IS NULL;
