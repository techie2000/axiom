-- Migration 000: Create migration tracking table
-- Rationale: Track which migrations have been applied to the database
-- This should be run before all other migrations

-- Create schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS reference;

-- Create migration tracking table
CREATE TABLE IF NOT EXISTS reference.schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    installed_by VARCHAR(100) DEFAULT CURRENT_USER,
    installed_on TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    execution_time_ms INTEGER,
    checksum VARCHAR(64),
    CONSTRAINT chk_version_format CHECK (version ~ '^[0-9]{3}_.+$')
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_schema_migrations_installed_on 
    ON reference.schema_migrations(installed_on DESC);

-- Add comment
COMMENT ON TABLE reference.schema_migrations IS 
    'Tracks database migrations applied to the reference schema';

COMMENT ON COLUMN reference.schema_migrations.version IS 
    'Migration version in format NNN_description (e.g., 001_initial_schema)';

COMMENT ON COLUMN reference.schema_migrations.checksum IS 
    'SHA-256 checksum of migration file for integrity verification';
