-- Migration 015: Restructure currencies_audit table
-- Standardize on the countries audit pattern: snapshot of all fields + audit metadata
-- Previous design: old_* vs new_* fields (more complex, harder to query)
-- New design: Single snapshot with operation type (simpler, consistent with countries)

-- Drop existing currencies_audit table and trigger
DROP TRIGGER IF EXISTS trg_currencies_audit ON reference.currencies;
DROP FUNCTION IF EXISTS reference.audit_currencies_changes();
DROP TABLE IF EXISTS reference.currencies_audit;

-- Create currencies_audit table following countries pattern
CREATE TABLE reference.currencies_audit (
    audit_id BIGSERIAL PRIMARY KEY,
    operation reference.audit_operation NOT NULL,
    operated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Source tracking
    source_system VARCHAR(50),  -- e.g., 'csv2json', 'canonicalizer', 'api', 'manual'
    source_user VARCHAR(100),   -- User or service account that made the change
    
    -- Record snapshot (all fields from currencies table)
    code TEXT NOT NULL,
    number TEXT,
    name TEXT NOT NULL,
    alpha2 TEXT,
    minor_units INTEGER,
    start_date TEXT,
    end_date TEXT,
    remarks TEXT,
    status TEXT,
    
    -- Timestamps from original record
    record_created_at TIMESTAMP NOT NULL,
    record_updated_at TIMESTAMP NOT NULL,
    
    -- Change tracking (for UPDATE operations)
    changed_fields TEXT[]  -- Array of field names that changed
);

-- Create indexes
CREATE INDEX idx_currencies_audit_code ON reference.currencies_audit(code);
CREATE INDEX idx_currencies_audit_operated_at ON reference.currencies_audit(operated_at DESC);
CREATE INDEX idx_currencies_audit_operation ON reference.currencies_audit(operation);
CREATE INDEX idx_currencies_audit_source ON reference.currencies_audit(source_system, source_user);

-- Create audit trigger function
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
        IF OLD.alpha2 IS DISTINCT FROM NEW.alpha2 THEN
            changed_fields_array := array_append(changed_fields_array, 'alpha2');
        END IF;
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
        
        -- Insert UPDATE audit record
        INSERT INTO reference.currencies_audit (
            operation, source_system, source_user,
            code, number, name, alpha2, minor_units, start_date, end_date, remarks, status,
            record_created_at, record_updated_at, changed_fields
        ) VALUES (
            'UPDATE', v_source_system, v_source_user,
            NEW.code, NEW.number, NEW.name, NEW.alpha2, NEW.minor_units, 
            NEW.start_date, NEW.end_date, NEW.remarks, NEW.status,
            NEW.created_at, NEW.updated_at, changed_fields_array
        );
        
        RETURN NEW;
    
    ELSIF TG_OP = 'INSERT' THEN
        -- Insert INSERT audit record
        INSERT INTO reference.currencies_audit (
            operation, source_system, source_user,
            code, number, name, alpha2, minor_units, start_date, end_date, remarks, status,
            record_created_at, record_updated_at, changed_fields
        ) VALUES (
            'INSERT', v_source_system, v_source_user,
            NEW.code, NEW.number, NEW.name, NEW.alpha2, NEW.minor_units, 
            NEW.start_date, NEW.end_date, NEW.remarks, NEW.status,
            NEW.created_at, NEW.updated_at, NULL
        );
        
        RETURN NEW;
    
    ELSIF TG_OP = 'DELETE' THEN
        -- Insert DELETE audit record (snapshot OLD values)
        INSERT INTO reference.currencies_audit (
            operation, source_system, source_user,
            code, number, name, alpha2, minor_units, start_date, end_date, remarks, status,
            record_created_at, record_updated_at, changed_fields
        ) VALUES (
            'DELETE', v_source_system, v_source_user,
            OLD.code, OLD.number, OLD.name, OLD.alpha2, OLD.minor_units, 
            OLD.start_date, OLD.end_date, OLD.remarks, OLD.status,
            OLD.created_at, OLD.updated_at, NULL
        );
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trg_currencies_audit
    AFTER INSERT OR UPDATE OR DELETE ON reference.currencies
    FOR EACH ROW
    EXECUTE FUNCTION reference.audit_currencies_changes();

-- Verify audit table structure
\echo 'Currencies audit table restructured successfully'
SELECT COUNT(*) as audit_records FROM reference.currencies_audit;
