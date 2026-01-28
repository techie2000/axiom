-- Migration 018: Remove alpha2 references from currencies audit
-- Related to: 017_add_currency_to_countries.sql (removed alpha2 column)
-- This migration updates the audit trigger function to remove alpha2 field tracking

-- Step 1: Drop the alpha2 column from currencies_audit table
ALTER TABLE reference.currencies_audit 
DROP COLUMN IF EXISTS alpha2;

-- Step 2: Recreate audit trigger function without alpha2 references
CREATE OR REPLACE FUNCTION reference.audit_currencies_changes()
RETURNS TRIGGER AS $$
DECLARE
    changed_fields_array TEXT[] := ARRAY[]::TEXT[];
    v_source_system VARCHAR(50);
    v_source_user VARCHAR(100);
BEGIN
    -- Get source context from session variables (set by application)
    v_source_system := COALESCE(current_setting('app.source_system', true), 'unknown');
    v_source_user := COALESCE(current_setting('app.source_user', true), CURRENT_USER);
    
    -- For UPDATE operations, track which fields changed
    IF TG_OP = 'UPDATE' THEN
        IF OLD.number IS DISTINCT FROM NEW.number THEN
            changed_fields_array := array_append(changed_fields_array, 'number');
        END IF;
        IF OLD.name IS DISTINCT FROM NEW.name THEN
            changed_fields_array := array_append(changed_fields_array, 'name');
        END IF;
        -- alpha2 tracking removed - column no longer exists
        IF OLD.minor_units IS DISTINCT FROM NEW.minor_units THEN
            changed_fields_array := array_append(changed_fields_array, 'minor_units');
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
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            changed_fields_array := array_append(changed_fields_array, 'status');
        END IF;
        
        -- If no fields changed, skip audit (no-op UPDATE optimization)
        IF array_length(changed_fields_array, 1) IS NULL THEN
            RETURN NEW;
        END IF;
        
        -- Insert UPDATE audit record (alpha2 removed from INSERT)
        INSERT INTO reference.currencies_audit (
            operation, source_system, source_user,
            code, number, name, minor_units, start_date, end_date, remarks, status,
            record_created_at, record_updated_at, changed_fields
        ) VALUES (
            'UPDATE', v_source_system, v_source_user,
            NEW.code, NEW.number, NEW.name, NEW.minor_units, 
            NEW.start_date, NEW.end_date, NEW.remarks, NEW.status,
            NEW.created_at, NEW.updated_at, changed_fields_array
        );
        
        RETURN NEW;
    
    ELSIF TG_OP = 'INSERT' THEN
        -- Insert INSERT audit record (alpha2 removed from INSERT)
        INSERT INTO reference.currencies_audit (
            operation, source_system, source_user,
            code, number, name, minor_units, start_date, end_date, remarks, status,
            record_created_at, record_updated_at, changed_fields
        ) VALUES (
            'INSERT', v_source_system, v_source_user,
            NEW.code, NEW.number, NEW.name, NEW.minor_units, 
            NEW.start_date, NEW.end_date, NEW.remarks, NEW.status,
            NEW.created_at, NEW.updated_at, NULL
        );
        
        RETURN NEW;
    
    ELSIF TG_OP = 'DELETE' THEN
        -- Insert DELETE audit record (alpha2 removed - snapshot OLD values)
        INSERT INTO reference.currencies_audit (
            operation, source_system, source_user,
            code, number, name, minor_units, start_date, end_date, remarks, status,
            record_created_at, record_updated_at, changed_fields
        ) VALUES (
            'DELETE', v_source_system, v_source_user,
            OLD.code, OLD.number, OLD.name, OLD.minor_units, 
            OLD.start_date, OLD.end_date, OLD.remarks, OLD.status,
            OLD.created_at, OLD.updated_at, NULL
        );
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Add documentation
COMMENT ON COLUMN reference.currencies_audit.code IS 
'ISO 4217 three-letter currency code (e.g., USD, EUR, JPY)';

COMMENT ON COLUMN reference.currencies_audit.changed_fields IS 
'Array of field names that changed in UPDATE operations. NULL for INSERT/DELETE.';

-- Verify trigger still works
\echo 'Currencies audit trigger updated - alpha2 references removed'
