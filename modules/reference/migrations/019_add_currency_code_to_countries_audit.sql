-- Migration 019: Add currency_code to countries audit tracking
-- Related to: 017_add_currency_to_countries.sql (added currency_code column)
-- This migration updates the audit trigger to track currency_code changes

-- Step 1: Add currency_code column to countries_audit table
ALTER TABLE reference.countries_audit 
ADD COLUMN IF NOT EXISTS currency_code TEXT;

-- Step 2: Add index on currency_code for audit queries
CREATE INDEX IF NOT EXISTS idx_countries_audit_currency_code 
ON reference.countries_audit(currency_code) 
WHERE currency_code IS NOT NULL;

-- Step 3: Update audit trigger function to track currency_code changes
CREATE OR REPLACE FUNCTION reference.audit_countries_changes()
RETURNS TRIGGER AS $$
DECLARE
    changed_fields_array TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- For UPDATE operations, track which fields changed
    IF TG_OP = 'UPDATE' THEN
        IF OLD.alpha3 IS DISTINCT FROM NEW.alpha3 THEN
            changed_fields_array := array_append(changed_fields_array, 'alpha3');
        END IF;
        IF OLD.numeric IS DISTINCT FROM NEW.numeric THEN
            changed_fields_array := array_append(changed_fields_array, 'numeric');
        END IF;
        IF OLD.name_english IS DISTINCT FROM NEW.name_english THEN
            changed_fields_array := array_append(changed_fields_array, 'name_english');
        END IF;
        IF OLD.name_french IS DISTINCT FROM NEW.name_french THEN
            changed_fields_array := array_append(changed_fields_array, 'name_french');
        END IF;
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            changed_fields_array := array_append(changed_fields_array, 'status');
        END IF;
        IF OLD.start_date IS DISTINCT FROM NEW.start_date THEN
            changed_fields_array := array_append(changed_fields_array, 'start_date');
        END IF;
        IF OLD.end_date IS DISTINCT FROM NEW.end_date THEN
            changed_fields_array := array_append(changed_fields_array, 'end_date');
        END IF;
        IF OLD.remarks IS DISTINCT FROM NEW.remarks THEN
            changed_fields_array := array_append(changed_fields_array, 'remarks');
        END IF;
        IF OLD.currency_code IS DISTINCT FROM NEW.currency_code THEN
            changed_fields_array := array_append(changed_fields_array, 'currency_code');
        END IF;
        
        -- Skip audit record if nothing changed (no-op update from UPSERT)
        IF array_length(changed_fields_array, 1) IS NULL THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Insert audit record based on operation type
    IF TG_OP = 'DELETE' THEN
        INSERT INTO reference.countries_audit (
            operation, source_system, source_user,
            alpha2, alpha3, numeric, name_english, name_french,
            status, start_date, end_date, remarks, currency_code,
            record_created_at, record_updated_at
        ) VALUES (
            'DELETE',
            NULLIF(current_setting('app.source_system', true), ''),
            NULLIF(current_setting('app.source_user', true), ''),
            OLD.alpha2, OLD.alpha3, OLD.numeric,
            OLD.name_english, OLD.name_french, OLD.status,
            OLD.start_date, OLD.end_date, OLD.remarks, OLD.currency_code,
            OLD.created_at, OLD.updated_at
        );
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO reference.countries_audit (
            operation, source_system, source_user,
            alpha2, alpha3, numeric, name_english, name_french,
            status, start_date, end_date, remarks, currency_code,
            record_created_at, record_updated_at, changed_fields
        ) VALUES (
            'UPDATE',
            NULLIF(current_setting('app.source_system', true), ''),
            NULLIF(current_setting('app.source_user', true), ''),
            NEW.alpha2, NEW.alpha3, NEW.numeric,
            NEW.name_english, NEW.name_french, NEW.status,
            NEW.start_date, NEW.end_date, NEW.remarks, NEW.currency_code,
            NEW.created_at, NEW.updated_at, changed_fields_array
        );
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO reference.countries_audit (
            operation, source_system, source_user,
            alpha2, alpha3, numeric, name_english, name_french,
            status, start_date, end_date, remarks, currency_code,
            record_created_at, record_updated_at
        ) VALUES (
            'INSERT',
            NULLIF(current_setting('app.source_system', true), ''),
            NULLIF(current_setting('app.source_user', true), ''),
            NEW.alpha2, NEW.alpha3, NEW.numeric,
            NEW.name_english, NEW.name_french, NEW.status,
            NEW.start_date, NEW.end_date, NEW.remarks, NEW.currency_code,
            NEW.created_at, NEW.updated_at
        );
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Add documentation
COMMENT ON COLUMN reference.countries_audit.currency_code IS 
'ISO 4217 three-letter currency code used by this country at the time of the audit record.';

-- Verify trigger still works
\echo 'Countries audit trigger updated - currency_code tracking added'
