-- Migration: 001_create_countries_table.up.sql
-- Creates the reference.countries table following ISO 3166-1 standard
-- See: https://www.iso.org/glossary-for-iso-3166.html

-- Ensure schema exists
CREATE SCHEMA IF NOT EXISTS reference;

-- Create enum type for country code status (namespaced to avoid conflicts with other reference tables)
CREATE TYPE reference.country_code_status AS ENUM (
    'officially_assigned',
    'exceptionally_reserved',
    'transitionally_reserved',
    'indeterminately_reserved',
    'formerly_used',
    'unassigned'
);

-- Create countries table
CREATE TABLE IF NOT EXISTS reference.countries (
    alpha2 CHAR(2) PRIMARY KEY,                          -- ISO 3166-1 alpha-2 (e.g., "US")
    alpha3 CHAR(3) NOT NULL UNIQUE,                      -- ISO 3166-1 alpha-3 (e.g., "USA")
    alpha4 CHAR(4),                                      -- ISO 3166-1 alpha-4 (rare, for former codes)
    numeric CHAR(3) NOT NULL UNIQUE,                     -- ISO 3166-1 numeric (e.g., "840") - must be 3 digits with leading zeros
    name_english VARCHAR(255) NOT NULL,                  -- Official English name
    name_french VARCHAR(255) NOT NULL,                   -- Official French name (ISO requirement)
    status reference.country_code_status NOT NULL DEFAULT 'officially_assigned',
    start_date DATE,                                     -- When code came into use
    end_date DATE,                                       -- When code ceased (NULL if still active)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT alpha2_uppercase CHECK (alpha2 = UPPER(alpha2)),
    CONSTRAINT alpha3_uppercase CHECK (alpha3 = UPPER(alpha3)),
    CONSTRAINT alpha4_uppercase CHECK (alpha4 IS NULL OR alpha4 = UPPER(alpha4)),
    CONSTRAINT numeric_format CHECK (numeric ~ '^[0-9]{3}$')  -- Exactly 3 digits
);

-- Indexes for common queries
-- Note: alpha2 is PRIMARY KEY, so it's automatically indexed (most common lookup)
CREATE INDEX idx_countries_alpha3 ON reference.countries(alpha3);  -- Secondary lookup by alpha3
CREATE INDEX idx_countries_numeric ON reference.countries(numeric); -- Numeric code lookups
CREATE INDEX idx_countries_status ON reference.countries(status);   -- Filter by status
CREATE INDEX idx_countries_name_english ON reference.countries(name_english); -- Search by name
CREATE INDEX idx_countries_active ON reference.countries(status, end_date)    -- Active countries filter
    WHERE status = 'officially_assigned' AND end_date IS NULL;

-- Function to automatically update updated_at timestamp (only when data actually changes)
CREATE OR REPLACE FUNCTION reference.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update timestamp if data actually changed
    IF (OLD.alpha3, OLD.alpha4, OLD.numeric, OLD.name_english, 
        OLD.name_french, OLD.status, OLD.start_date, OLD.end_date) IS DISTINCT FROM
       (NEW.alpha3, NEW.alpha4, NEW.numeric, NEW.name_english, 
        NEW.name_french, NEW.status, NEW.start_date, NEW.end_date) THEN
        NEW.updated_at = NOW();
    ELSE
        NEW.updated_at = OLD.updated_at;  -- Keep original timestamp
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_countries_updated_at
    BEFORE UPDATE ON reference.countries
    FOR EACH ROW
    EXECUTE FUNCTION reference.update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE reference.countries IS 'ISO 3166-1 country codes - single source of truth for country reference data';
COMMENT ON COLUMN reference.countries.alpha2 IS 'Two-letter country code (primary identifier)';
COMMENT ON COLUMN reference.countries.alpha3 IS 'Three-letter country code';
COMMENT ON COLUMN reference.countries.alpha4 IS 'Four-letter code (rare, used for former codes)';
COMMENT ON COLUMN reference.countries.numeric IS 'Three-digit numeric country code';
COMMENT ON COLUMN reference.countries.name_english IS 'Official English short name from ISO 3166-1';
COMMENT ON COLUMN reference.countries.name_french IS 'Official French short name from ISO 3166-1';
COMMENT ON COLUMN reference.countries.status IS 'ISO 3166-1 assignment status of the code';
COMMENT ON COLUMN reference.countries.start_date IS 'Date when this country code came into official use';
COMMENT ON COLUMN reference.countries.end_date IS 'Date when this country code ceased to be used (NULL if still active)';
