-- Migration: 003_add_remarks_and_relax_constraints.up.sql
-- Adds remarks column and relaxes constraints to support all ISO 3166-1 status types
-- See ADR-007: Exclude Formerly Used Country Codes

-- Add remarks column for status-specific notes
ALTER TABLE reference.countries 
    ADD COLUMN remarks TEXT;

-- Make alpha3 nullable (not required for reserved/unassigned statuses)
ALTER TABLE reference.countries 
    ALTER COLUMN alpha3 DROP NOT NULL;

-- Make numeric nullable (not required for reserved/unassigned statuses)
ALTER TABLE reference.countries 
    ALTER COLUMN numeric DROP NOT NULL;

-- Make name_english and name_french nullable (not required for unassigned status)
-- We'll use CHECK constraints for status-specific requirements
ALTER TABLE reference.countries 
    ALTER COLUMN name_english DROP NOT NULL;

ALTER TABLE reference.countries 
    ALTER COLUMN name_french DROP NOT NULL;

-- Drop UNIQUE constraints on alpha3 and numeric
-- Multiple unassigned/reserved codes may share NULL values
-- Note: PostgreSQL considers NULL != NULL, so UNIQUE would allow multiple NULLs anyway,
-- but we're being explicit about the intent
ALTER TABLE reference.countries 
    DROP CONSTRAINT IF EXISTS countries_alpha3_key;

ALTER TABLE reference.countries 
    DROP CONSTRAINT IF EXISTS countries_numeric_key;

-- Add partial UNIQUE indexes (only for non-NULL values)
-- This prevents duplicate alpha3/numeric for officially_assigned codes
-- while allowing multiple NULL values for unassigned codes
CREATE UNIQUE INDEX idx_countries_alpha3_unique 
    ON reference.countries(alpha3) 
    WHERE alpha3 IS NOT NULL;

CREATE UNIQUE INDEX idx_countries_numeric_unique 
    ON reference.countries(numeric) 
    WHERE numeric IS NOT NULL;

-- Add CHECK constraints for status-specific business rules
-- These enforce the validation rules from ADR-007

-- Rule 1: status = 'officially_assigned' requires alpha2, alpha3, name_english, name_french
ALTER TABLE reference.countries 
    ADD CONSTRAINT chk_officially_assigned_fields CHECK (
        status != 'officially_assigned' OR (
            alpha2 IS NOT NULL 
            AND alpha3 IS NOT NULL 
            AND name_english IS NOT NULL 
            AND name_french IS NOT NULL
        )
    );

-- Rule 2: status = 'exceptionally_reserved' OR 'indeterminately_reserved' requires alpha2, name_english, remarks
ALTER TABLE reference.countries 
    ADD CONSTRAINT chk_reserved_fields CHECK (
        status NOT IN ('exceptionally_reserved', 'indeterminately_reserved') OR (
            alpha2 IS NOT NULL 
            AND name_english IS NOT NULL 
            AND remarks IS NOT NULL
        )
    );

-- Rule 3: status = 'transitionally_reserved' requires alpha2, name_english, remarks
ALTER TABLE reference.countries 
    ADD CONSTRAINT chk_transitionally_reserved_fields CHECK (
        status != 'transitionally_reserved' OR (
            alpha2 IS NOT NULL 
            AND name_english IS NOT NULL 
            AND remarks IS NOT NULL
        )
    );

-- Rule 4: status = 'formerly_used' should never exist in database (filtered by canonicalizer)
-- But add constraint as defensive programming
ALTER TABLE reference.countries 
    ADD CONSTRAINT chk_no_formerly_used CHECK (
        status != 'formerly_used'
    );

-- Rule 5: status = 'unassigned' requires only alpha2
ALTER TABLE reference.countries 
    ADD CONSTRAINT chk_unassigned_fields CHECK (
        status != 'unassigned' OR (
            alpha2 IS NOT NULL
        )
    );

-- Update the trigger function to include remarks in change detection
CREATE OR REPLACE FUNCTION reference.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update timestamp if data actually changed
    IF (OLD.alpha3, OLD.alpha4, OLD.numeric, OLD.name_english, 
        OLD.name_french, OLD.status, OLD.start_date, OLD.end_date, OLD.remarks) IS DISTINCT FROM
       (NEW.alpha3, NEW.alpha4, NEW.numeric, NEW.name_english, 
        NEW.name_french, NEW.status, NEW.start_date, NEW.end_date, NEW.remarks) THEN
        NEW.updated_at = NOW();
    ELSE
        NEW.updated_at = OLD.updated_at;  -- Keep original timestamp
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add index on remarks for text search (useful for finding specific reserved codes)
CREATE INDEX idx_countries_remarks_fulltext 
    ON reference.countries USING gin(to_tsvector('english', COALESCE(remarks, '')))
    WHERE remarks IS NOT NULL;

-- Add comment to document the formerly_used exclusion
COMMENT ON TABLE reference.countries IS 
'ISO 3166-1 country codes. Excludes status=formerly_used codes per ADR-007. Historical codes are filtered by canonicalizer to prevent PRIMARY KEY conflicts from reused codes (e.g., GE: Gilbert & Ellice Islands → Georgia).';
