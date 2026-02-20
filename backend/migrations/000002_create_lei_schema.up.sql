-- Create schema for LEI (Legal Entity Identifier) data from GLEIF
-- This is a separate schema for raw LEI data, distinct from master data

-- Create lei_raw schema
CREATE SCHEMA IF NOT EXISTS lei_raw;

-- Create source_files table first (referenced by lei_records)
CREATE TABLE IF NOT EXISTS lei_raw.source_files (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(20) NOT NULL,  -- FULL, DELTA
    file_url VARCHAR(1000) NOT NULL,
    file_size BIGINT,
    file_hash VARCHAR(64),  -- SHA-256 hash
    downloaded_at TIMESTAMP,
    publication_date TIMESTAMP,

    -- Processing status
    processing_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING, IN_PROGRESS, COMPLETED, FAILED
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    last_processed_lei VARCHAR(20),  -- For resumption

    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    processing_error TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Create indexes for source_files
CREATE INDEX idx_source_files_file_type ON lei_raw.source_files (file_type);
CREATE INDEX idx_source_files_processing_status ON lei_raw.source_files (processing_status);
CREATE INDEX idx_source_files_publication_date ON lei_raw.source_files (publication_date);
CREATE INDEX idx_source_files_downloaded_at ON lei_raw.source_files (downloaded_at);
CREATE INDEX idx_source_files_deleted_at ON lei_raw.source_files (deleted_at);

-- Create lei_records table
CREATE TABLE IF NOT EXISTS lei_raw.lei_records (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    lei VARCHAR(20) NOT NULL UNIQUE,

    -- Entity information
    legal_name VARCHAR(500) NOT NULL,
    transliterated_legal_name VARCHAR(500),
    other_names JSONB,

    -- Legal address
    legal_address_line_1 VARCHAR(500),
    legal_address_line_2 VARCHAR(500),
    legal_address_line_3 VARCHAR(500),
    legal_address_line_4 VARCHAR(500),
    legal_address_city VARCHAR(100),
    legal_address_region VARCHAR(100),
    legal_address_country VARCHAR(2),  -- ISO 3166-1 alpha-2
    legal_address_postal_code VARCHAR(50),  -- Increased from 20 to accommodate longer postal codes

    -- Headquarters address
    hq_address_line_1 VARCHAR(500),
    hq_address_line_2 VARCHAR(500),
    hq_address_line_3 VARCHAR(500),
    hq_address_line_4 VARCHAR(500),
    hq_address_city VARCHAR(100),
    hq_address_region VARCHAR(100),
    hq_address_country VARCHAR(2),  -- ISO 3166-1 alpha-2
    hq_address_postal_code VARCHAR(50),  -- Increased from 20 to accommodate longer postal codes

    -- Registration
    registration_authority VARCHAR(100),
    registration_authority_id VARCHAR(100),
    registration_number VARCHAR(100),
    entity_category VARCHAR(50),
    entity_sub_category VARCHAR(50),
    entity_legal_form VARCHAR(100),
    entity_status VARCHAR(50),

    -- Associated entities
    managing_lou VARCHAR(100),  -- Local Operating Unit
    successor_lei VARCHAR(20),

    -- Dates
    initial_registration_date TIMESTAMP,
    last_update_date TIMESTAMP,
    next_renewal_date TIMESTAMP,

    -- Validation
    validation_sources JSONB,
    validation_authority VARCHAR(100),

    -- Audit and provenance
    source_file_id UUID REFERENCES lei_raw.source_files (id),
    changed_fields JSONB,  -- Last change details: {"field": {"old": "value", "new": "value"}}
    created_by VARCHAR(100) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(100) NOT NULL DEFAULT 'system',

    -- Standard fields
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Create indexes for lei_records
CREATE INDEX idx_lei_records_lei ON lei_raw.lei_records (lei);
CREATE INDEX idx_lei_records_legal_name ON lei_raw.lei_records (legal_name);
CREATE INDEX idx_lei_records_legal_address_country ON lei_raw.lei_records (legal_address_country);
CREATE INDEX idx_lei_records_registration_authority ON lei_raw.lei_records (registration_authority);
CREATE INDEX idx_lei_records_entity_status ON lei_raw.lei_records (entity_status);
CREATE INDEX idx_lei_records_source_file_id ON lei_raw.lei_records (source_file_id);
CREATE INDEX idx_lei_records_deleted_at ON lei_raw.lei_records (deleted_at);
CREATE INDEX idx_lei_records_last_update_date ON lei_raw.lei_records (last_update_date);

-- Create lei_records_audit table for full audit history
CREATE TABLE IF NOT EXISTS lei_raw.lei_records_audit (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    lei_record_id UUID NOT NULL,
    lei VARCHAR(20) NOT NULL,
    "action" VARCHAR(20) NOT NULL,  -- CREATE, UPDATE, DELETE

    -- Complete record snapshot
    record_snapshot JSONB NOT NULL,

    -- Change details
    changed_fields JSONB,  -- {"field": {"old": "value", "new": "value"}}

    -- Source information
    source_file_id UUID REFERENCES lei_raw.source_files (id),
    changed_by VARCHAR(100) NOT NULL DEFAULT 'system',

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for lei_records_audit
CREATE INDEX idx_lei_records_audit_lei_record_id ON lei_raw.lei_records_audit (lei_record_id);
CREATE INDEX idx_lei_records_audit_lei ON lei_raw.lei_records_audit (lei);
CREATE INDEX idx_lei_records_audit_action ON lei_raw.lei_records_audit ("action");
CREATE INDEX idx_lei_records_audit_created_at ON lei_raw.lei_records_audit (created_at);
CREATE INDEX idx_lei_records_audit_source_file_id ON lei_raw.lei_records_audit (source_file_id);

-- Create file_processing_status table
CREATE TABLE IF NOT EXISTS lei_raw.file_processing_status (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    job_type VARCHAR(50) NOT NULL,  -- DAILY_FULL, DAILY_DELTA, MANUAL
    status VARCHAR(20) NOT NULL,  -- IDLE, RUNNING, COMPLETED, FAILED
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    last_success_at TIMESTAMP,

    current_source_file_id UUID REFERENCES lei_raw.source_files (id),

    error_message TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for file_processing_status
CREATE INDEX idx_file_processing_status_job_type ON lei_raw.file_processing_status (job_type);
CREATE INDEX idx_file_processing_status_status ON lei_raw.file_processing_status (status);
CREATE INDEX idx_file_processing_status_next_run_at ON lei_raw.file_processing_status (next_run_at);

-- Create triggers for updated_at
CREATE TRIGGER update_lei_records_updated_at BEFORE UPDATE ON lei_raw.lei_records
FOR EACH ROW EXECUTE FUNCTION UPDATE_UPDATED_AT_COLUMN();

CREATE TRIGGER update_source_files_updated_at BEFORE UPDATE ON lei_raw.source_files
FOR EACH ROW EXECUTE FUNCTION UPDATE_UPDATED_AT_COLUMN();

CREATE TRIGGER update_file_processing_status_updated_at BEFORE UPDATE ON lei_raw.file_processing_status
FOR EACH ROW EXECUTE FUNCTION UPDATE_UPDATED_AT_COLUMN();

-- Insert initial job status records
INSERT INTO lei_raw.file_processing_status (job_type, status, created_at, updated_at)
VALUES
('DAILY_FULL', 'IDLE', NOW(), NOW()),
('DAILY_DELTA', 'IDLE', NOW(), NOW())
ON CONFLICT DO NOTHING;
