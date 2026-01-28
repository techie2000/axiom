-- Migration 013: Create currencies table
-- ISO 4217 currency codes with temporal tracking and audit trail
--
-- Design decisions:
-- 1. code (3-letter ISO 4217) is PRIMARY KEY (e.g., 'USD', 'EUR', 'XAU')
-- 2. alpha2 FK to countries is NULLABLE - some currencies don't map to countries (XAU Gold, XBA EURCO)
-- 3. One-to-many relationship: multiple countries can use same currency (e.g., EUR)
-- 4. start_date/end_date are TEXT to handle imprecise dates ("2003-01", "1989 to 1990")
-- 5. Full audit trail following migration 011 pattern (skip no-op UPDATEs)

-- Create currencies table
CREATE TABLE IF NOT EXISTS reference.currencies (
    code TEXT PRIMARY KEY,                    -- ISO 4217 3-letter code (e.g., 'USD', 'EUR', 'XAU')
    number TEXT,                              -- ISO 4217 3-digit numeric code (e.g., '840' for USD)
    name TEXT NOT NULL,                       -- Currency name (e.g., 'US Dollar')
    alpha2 TEXT,                              -- FK to countries.alpha2 (NULLABLE for XAU, XBA, etc.)
    minor_units INTEGER,                      -- Decimal places (2 for USD, 0 for JPY, NULL if N/A)
    start_date TEXT,                          -- Flexible format: '2003-01', '1989', '1989 to 1990'
    end_date TEXT,                            -- NULL for active currencies
    remarks TEXT,                             -- Additional context
    status TEXT,                              -- Status (values TBD: 'active', 'historical', etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key to countries (NULLABLE, no CASCADE to preserve history)
    CONSTRAINT fk_currencies_alpha2 FOREIGN KEY (alpha2) 
        REFERENCES reference.countries(alpha2)
);

-- Create audit table for currencies
CREATE TABLE IF NOT EXISTS reference.currencies_audit (
    audit_id SERIAL PRIMARY KEY,
    code TEXT NOT NULL,                       -- Currency code being audited
    operation TEXT NOT NULL,                  -- 'INSERT', 'UPDATE', 'DELETE'
    changed_fields TEXT[],                    -- Array of field names that changed (NULL for INSERT/DELETE)
    old_number TEXT,
    new_number TEXT,
    old_name TEXT,
    new_name TEXT,
    old_alpha2 TEXT,
    new_alpha2 TEXT,
    old_minor_units INTEGER,
    new_minor_units INTEGER,
    old_start_date TEXT,
    new_start_date TEXT,
    old_end_date TEXT,
    new_end_date TEXT,
    old_remarks TEXT,
    new_remarks TEXT,
    old_status TEXT,
    new_status TEXT,
    old_created_at TIMESTAMP,
    new_created_at TIMESTAMP,
    old_updated_at TIMESTAMP,
    new_updated_at TIMESTAMP,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by TEXT DEFAULT CURRENT_USER
);

-- NO foreign key constraint on audit table (principle: audit must be independent)
-- Rationale: Must preserve audit history even after currency deleted from main table

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_currencies_alpha2 ON reference.currencies(alpha2);
CREATE INDEX IF NOT EXISTS idx_currencies_status ON reference.currencies(status);
CREATE INDEX IF NOT EXISTS idx_currencies_audit_code ON reference.currencies_audit(code);
CREATE INDEX IF NOT EXISTS idx_currencies_audit_operation ON reference.currencies_audit(operation);

-- Trigger function to audit currencies changes
CREATE OR REPLACE FUNCTION reference.audit_currencies_changes()
RETURNS TRIGGER AS $$
DECLARE
    changed_fields_array TEXT[] := '{}';
BEGIN
    -- INSERT operation
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO reference.currencies_audit (
            code, operation, changed_fields,
            new_number, new_name, new_alpha2, new_minor_units,
            new_start_date, new_end_date, new_remarks, new_status,
            new_created_at, new_updated_at
        ) VALUES (
            NEW.code, 'INSERT', NULL,
            NEW.number, NEW.name, NEW.alpha2, NEW.minor_units,
            NEW.start_date, NEW.end_date, NEW.remarks, NEW.status,
            NEW.created_at, NEW.updated_at
        );
        RETURN NEW;
    END IF;

    -- UPDATE operation
    IF (TG_OP = 'UPDATE') THEN
        -- Detect which fields changed
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

        -- Skip audit if no fields actually changed (migration 011 pattern)
        IF array_length(changed_fields_array, 1) IS NULL THEN
            RETURN NEW;
        END IF;

        -- Update the updated_at timestamp
        NEW.updated_at := CURRENT_TIMESTAMP;

        INSERT INTO reference.currencies_audit (
            code, operation, changed_fields,
            old_number, new_number,
            old_name, new_name,
            old_alpha2, new_alpha2,
            old_minor_units, new_minor_units,
            old_start_date, new_start_date,
            old_end_date, new_end_date,
            old_remarks, new_remarks,
            old_status, new_status,
            old_created_at, new_created_at,
            old_updated_at, new_updated_at
        ) VALUES (
            NEW.code, 'UPDATE', changed_fields_array,
            OLD.number, NEW.number,
            OLD.name, NEW.name,
            OLD.alpha2, NEW.alpha2,
            OLD.minor_units, NEW.minor_units,
            OLD.start_date, NEW.start_date,
            OLD.end_date, NEW.end_date,
            OLD.remarks, NEW.remarks,
            OLD.status, NEW.status,
            OLD.created_at, NEW.created_at,
            OLD.updated_at, NEW.updated_at
        );
        RETURN NEW;
    END IF;

    -- DELETE operation
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO reference.currencies_audit (
            code, operation, changed_fields,
            old_number, old_name, old_alpha2, old_minor_units,
            old_start_date, old_end_date, old_remarks, old_status,
            old_created_at, old_updated_at
        ) VALUES (
            OLD.code, 'DELETE', NULL,
            OLD.number, OLD.name, OLD.alpha2, OLD.minor_units,
            OLD.start_date, OLD.end_date, OLD.remarks, OLD.status,
            OLD.created_at, OLD.updated_at
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for INSERT, UPDATE, DELETE
CREATE TRIGGER currencies_audit_insert
    AFTER INSERT ON reference.currencies
    FOR EACH ROW
    EXECUTE FUNCTION reference.audit_currencies_changes();

CREATE TRIGGER currencies_audit_update
    AFTER UPDATE ON reference.currencies
    FOR EACH ROW
    EXECUTE FUNCTION reference.audit_currencies_changes();

CREATE TRIGGER currencies_audit_delete
    AFTER DELETE ON reference.currencies
    FOR EACH ROW
    EXECUTE FUNCTION reference.audit_currencies_changes();
