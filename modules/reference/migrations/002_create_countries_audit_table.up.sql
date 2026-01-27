-- Migration: 002_create_countries_audit_table.up.sql
-- Creates audit table for tracking all changes to reference.countries
-- Provides complete provenance and compliance trail

-- Create audit operation enum
CREATE TYPE reference.audit_operation AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE'
);

-- Create audit table (write-only, no updates or deletes)
CREATE TABLE IF NOT EXISTS reference.countries_audit (
    audit_id BIGSERIAL PRIMARY KEY,
    operation reference.audit_operation NOT NULL,
    operated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Source tracking
    source_system VARCHAR(50),  -- e.g., 'csv2json', 'api', 'manual'
    source_user VARCHAR(100),   -- User or service account that made the change
    
    -- Record snapshot (all fields from countries table)
    alpha2 CHAR(2) NOT NULL,
    alpha3 CHAR(3) NOT NULL,
    alpha4 CHAR(4),
    numeric CHAR(3) NOT NULL,
    name_english VARCHAR(255) NOT NULL,
    name_french VARCHAR(255) NOT NULL,
    status reference.country_code_status NOT NULL,
    start_date DATE,
    end_date DATE,
    
    -- Timestamps from original record
    record_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    record_updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Change tracking (for UPDATE operations)
    changed_fields TEXT[],  -- Array of field names that changed
    
    CONSTRAINT fk_countries_alpha2 FOREIGN KEY (alpha2) 
        REFERENCES reference.countries(alpha2) 
        ON DELETE CASCADE
);

-- Indexes for common audit queries
CREATE INDEX idx_countries_audit_alpha2 ON reference.countries_audit(alpha2);
CREATE INDEX idx_countries_audit_operated_at ON reference.countries_audit(operated_at DESC);
CREATE INDEX idx_countries_audit_operation ON reference.countries_audit(operation);
CREATE INDEX idx_countries_audit_source ON reference.countries_audit(source_system, source_user);

-- Function to capture changes and write to audit table
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
        IF OLD.alpha4 IS DISTINCT FROM NEW.alpha4 THEN
            changed_fields_array := array_append(changed_fields_array, 'alpha4');
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
        
        -- Insert audit record with NEW values (after update)
        INSERT INTO reference.countries_audit (
            operation, source_system, source_user,
            alpha2, alpha3, alpha4, numeric,
            name_english, name_french, status,
            start_date, end_date,
            record_created_at, record_updated_at,
            changed_fields
        ) VALUES (
            TG_OP::reference.audit_operation,
            current_setting('app.source_system', TRUE),
            current_setting('app.source_user', TRUE),
            NEW.alpha2, NEW.alpha3, NEW.alpha4, NEW.numeric,
            NEW.name_english, NEW.name_french, NEW.status,
            NEW.start_date, NEW.end_date,
            NEW.created_at, NEW.updated_at,
            changed_fields_array
        );
        
    ELSIF TG_OP = 'INSERT' THEN
        -- Insert audit record for new country
        INSERT INTO reference.countries_audit (
            operation, source_system, source_user,
            alpha2, alpha3, alpha4, numeric,
            name_english, name_french, status,
            start_date, end_date,
            record_created_at, record_updated_at,
            changed_fields
        ) VALUES (
            TG_OP::reference.audit_operation,
            current_setting('app.source_system', TRUE),
            current_setting('app.source_user', TRUE),
            NEW.alpha2, NEW.alpha3, NEW.alpha4, NEW.numeric,
            NEW.name_english, NEW.name_french, NEW.status,
            NEW.start_date, NEW.end_date,
            NEW.created_at, NEW.updated_at,
            NULL  -- No changed fields for INSERT
        );
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Insert audit record with OLD values (before delete)
        INSERT INTO reference.countries_audit (
            operation, source_system, source_user,
            alpha2, alpha3, alpha4, numeric,
            name_english, name_french, status,
            start_date, end_date,
            record_created_at, record_updated_at,
            changed_fields
        ) VALUES (
            TG_OP::reference.audit_operation,
            current_setting('app.source_system', TRUE),
            current_setting('app.source_user', TRUE),
            OLD.alpha2, OLD.alpha3, OLD.alpha4, OLD.numeric,
            OLD.name_english, OLD.name_french, OLD.status,
            OLD.start_date, OLD.end_date,
            OLD.created_at, OLD.updated_at,
            NULL  -- No changed fields for DELETE
        );
    END IF;
    
    -- Return appropriate value based on operation
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to capture all changes (INSERT, UPDATE, DELETE)
CREATE TRIGGER audit_countries_changes
    AFTER INSERT OR UPDATE OR DELETE ON reference.countries
    FOR EACH ROW
    EXECUTE FUNCTION reference.audit_countries_changes();

-- Comments for documentation
COMMENT ON TABLE reference.countries_audit IS 'Complete audit trail for all changes to reference.countries - write-only for compliance';
COMMENT ON COLUMN reference.countries_audit.audit_id IS 'Unique sequential audit record identifier';
COMMENT ON COLUMN reference.countries_audit.operation IS 'Type of database operation performed';
COMMENT ON COLUMN reference.countries_audit.operated_at IS 'Timestamp when the operation occurred';
COMMENT ON COLUMN reference.countries_audit.source_system IS 'System that made the change (e.g., csv2json, api, manual)';
COMMENT ON COLUMN reference.countries_audit.source_user IS 'User or service account that performed the operation';
COMMENT ON COLUMN reference.countries_audit.changed_fields IS 'Array of field names that changed (UPDATE only)';
COMMENT ON COLUMN reference.countries_audit.record_created_at IS 'Original created_at from the countries record';
COMMENT ON COLUMN reference.countries_audit.record_updated_at IS 'Original updated_at from the countries record';

-- Grant appropriate permissions (read-only for most users)
-- GRANT SELECT ON reference.countries_audit TO axiom_readonly;
-- Only triggers can INSERT (no direct INSERT/UPDATE/DELETE for users)
