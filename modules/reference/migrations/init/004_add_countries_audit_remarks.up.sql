-- Migration: 004_add_remarks_to_audit_table.up.sql
-- Adds remarks column to the audit table to match the countries table schema
-- Must be run after 003_add_remarks_and_relax_constraints.up.sql

\echo 'Adding remarks column to reference.countries_audit'
ALTER TABLE reference.countries_audit 
    ADD COLUMN remarks TEXT;

\echo 'Updating function: reference.audit_countries_changes() to include remarks'
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
        IF OLD.remarks IS DISTINCT FROM NEW.remarks THEN
            changed_fields_array := array_append(changed_fields_array, 'remarks');
        END IF;
    END IF;

    -- Insert audit record based on operation type
    IF TG_OP = 'DELETE' THEN
        INSERT INTO reference.countries_audit (
            operation, source_system, source_user,
            alpha2, alpha3, alpha4, numeric, name_english, name_french,
            status, start_date, end_date, remarks,
            record_created_at, record_updated_at
        ) VALUES (
            'DELETE',
            NULLIF(current_setting('app.source_system', true), ''),
            NULLIF(current_setting('app.source_user', true), ''),
            OLD.alpha2, OLD.alpha3, OLD.alpha4, OLD.numeric,
            OLD.name_english, OLD.name_french, OLD.status,
            OLD.start_date, OLD.end_date, OLD.remarks,
            OLD.created_at, OLD.updated_at
        );
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO reference.countries_audit (
            operation, source_system, source_user,
            alpha2, alpha3, alpha4, numeric, name_english, name_french,
            status, start_date, end_date, remarks,
            record_created_at, record_updated_at, changed_fields
        ) VALUES (
            'UPDATE',
            NULLIF(current_setting('app.source_system', true), ''),
            NULLIF(current_setting('app.source_user', true), ''),
            NEW.alpha2, NEW.alpha3, NEW.alpha4, NEW.numeric,
            NEW.name_english, NEW.name_french, NEW.status,
            NEW.start_date, NEW.end_date, NEW.remarks,
            NEW.created_at, NEW.updated_at, changed_fields_array
        );
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO reference.countries_audit (
            operation, source_system, source_user,
            alpha2, alpha3, alpha4, numeric, name_english, name_french,
            status, start_date, end_date, remarks,
            record_created_at, record_updated_at
        ) VALUES (
            'INSERT',
            NULLIF(current_setting('app.source_system', true), ''),
            NULLIF(current_setting('app.source_user', true), ''),
            NEW.alpha2, NEW.alpha3, NEW.alpha4, NEW.numeric,
            NEW.name_english, NEW.name_french, NEW.status,
            NEW.start_date, NEW.end_date, NEW.remarks,
            NEW.created_at, NEW.updated_at
        );
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
