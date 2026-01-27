-- Migration 008: Remove alpha4 references from update_updated_at_column trigger function
-- Rationale: alpha4 column removed in migration 006, but update timestamp trigger still references it
-- This causes "record 'old' has no field 'alpha4'" errors during UPDATE operations
-- This updates the update_updated_at_column() function to remove alpha4 from field comparison

CREATE OR REPLACE FUNCTION reference.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update timestamp if data actually changed (alpha4 removed)
    IF (OLD.alpha3, OLD.numeric, OLD.name_english, OLD.name_french,
        OLD.status, OLD.start_date, OLD.end_date, OLD.remarks) IS DISTINCT FROM
       (NEW.alpha3, NEW.numeric, NEW.name_english, NEW.name_french,
        NEW.status, NEW.start_date, NEW.end_date, NEW.remarks) THEN
        NEW.updated_at = NOW();
    ELSE
        NEW.updated_at = OLD.updated_at;  -- Keep original timestamp
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
