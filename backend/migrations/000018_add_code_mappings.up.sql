-- Create generic code mappings table for cross-system code translation
-- Supports mapping codes between external systems (e.g., ALERT) and AXIOM
-- The first 5 fields together form a unique key

CREATE TABLE IF NOT EXISTS code_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_system VARCHAR(100) NOT NULL,
    to_system VARCHAR(100) NOT NULL,
    from_code_type VARCHAR(100) NOT NULL,
    to_code_type VARCHAR(100) NOT NULL,
    from_code VARCHAR(255) NOT NULL,
    to_code VARCHAR(255) NOT NULL,
    description VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Unique constraint on the first 5 fields: the same combination of
-- from_system, to_system, from_code_type, to_code_type, from_code
-- cannot map to more than one to_code
CREATE UNIQUE INDEX uq_code_mappings_key
    ON code_mappings (from_system, to_system, from_code_type, to_code_type, from_code)
    WHERE deleted_at IS NULL;

-- Indexes for common lookup patterns
CREATE INDEX idx_code_mappings_from_system ON code_mappings (from_system);
CREATE INDEX idx_code_mappings_to_system ON code_mappings (to_system);
CREATE INDEX idx_code_mappings_from_code_type ON code_mappings (from_code_type);
CREATE INDEX idx_code_mappings_to_code_type ON code_mappings (to_code_type);
CREATE INDEX idx_code_mappings_from_code ON code_mappings (from_code);
CREATE INDEX idx_code_mappings_active ON code_mappings (active);
CREATE INDEX idx_code_mappings_deleted_at ON code_mappings (deleted_at);

-- Table and column comments
COMMENT ON TABLE code_mappings IS
'Generic cross-system code mapping table. Maps codes from one system (e.g., ALERT CCY codes) '
'to codes in another system (e.g., AXIOM ISO country codes). Supports currencies, countries, '
'entities, and any other reference data types. The combination of from_system, to_system, '
'from_code_type, to_code_type, and from_code must be unique.';

COMMENT ON COLUMN code_mappings.id IS 'Unique identifier (UUID v4)';
COMMENT ON COLUMN code_mappings.from_system IS
'Source system identifier. Example: ALERT, BLOOMBERG, REUTERS, SWIFT';
COMMENT ON COLUMN code_mappings.to_system IS
'Target system identifier. Example: AXIOM, ISO, GLEIF';
COMMENT ON COLUMN code_mappings.from_code_type IS
'Code type in the source system. Example: CCY_ALERT (Alert currency code), '
'COUNTRY_CODE, ENTITY_ID';
COMMENT ON COLUMN code_mappings.to_code_type IS
'Code type in the target system. Example: CCY_CODE (ISO 4217 code), '
'CCY_ID (UUID), COUNTRY_CODE (ISO 3166 alpha-2), COUNTRY_ID (UUID)';
COMMENT ON COLUMN code_mappings.from_code IS
'The code value in the source system. Example: SWE (Alert currency code for Sweden)';
COMMENT ON COLUMN code_mappings.to_code IS
'The corresponding code value in the target system. '
'Example: SE (ISO alpha-2 country code), or a UUID like 0224f98a-a5c2-4b24-b6c6-12925b844684';
COMMENT ON COLUMN code_mappings.description IS
'Optional human-readable explanation of the mapping';
COMMENT ON COLUMN code_mappings.active IS
'Whether this mapping is currently active and should be used for lookups';
COMMENT ON COLUMN code_mappings.created_by IS
'User or system that created this mapping';
COMMENT ON COLUMN code_mappings.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN code_mappings.updated_at IS 'Record last update timestamp';
COMMENT ON COLUMN code_mappings.deleted_at IS
'Soft-delete timestamp (NULL means record is active)';

-- Audit table for code mappings
CREATE TABLE IF NOT EXISTS code_mappings_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_mapping_id UUID NOT NULL,
    from_system VARCHAR(100) NOT NULL,
    to_system VARCHAR(100) NOT NULL,
    from_code_type VARCHAR(100) NOT NULL,
    to_code_type VARCHAR(100) NOT NULL,
    from_code VARCHAR(255) NOT NULL,
    to_code VARCHAR(255) NOT NULL,
    action VARCHAR(20) NOT NULL,
    record_snapshot JSONB NOT NULL,
    changed_fields JSONB,
    changed_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_code_mappings_audit_mapping_id ON code_mappings_audit (code_mapping_id);
CREATE INDEX idx_code_mappings_audit_from_system ON code_mappings_audit (from_system);
CREATE INDEX idx_code_mappings_audit_from_code_type ON code_mappings_audit (from_code_type);

COMMENT ON TABLE code_mappings_audit IS
'Complete audit history of code mapping record changes. '
'Records every CREATE, UPDATE, and DELETE operation with full before/after snapshots.';
COMMENT ON COLUMN code_mappings_audit.action IS
'Audit action type: CREATE, UPDATE, or DELETE';
COMMENT ON COLUMN code_mappings_audit.record_snapshot IS
'Full JSON snapshot of the code mapping record at the time of the action';
COMMENT ON COLUMN code_mappings_audit.changed_fields IS
'JSON object containing only the fields that changed in an UPDATE action';
