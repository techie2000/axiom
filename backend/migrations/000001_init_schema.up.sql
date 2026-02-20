-- Create UUID extension (pgcrypto provides gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create countries table
CREATE TABLE IF NOT EXISTS countries (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    code VARCHAR(2) NOT NULL UNIQUE,
    "name" VARCHAR(255) NOT NULL,
    alpha3_code VARCHAR(3),
    region VARCHAR(255),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_countries_code ON countries (code);
CREATE INDEX idx_countries_deleted_at ON countries (deleted_at);

-- Create currencies table
CREATE TABLE IF NOT EXISTS currencies (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    code VARCHAR(3) NOT NULL UNIQUE,
    "name" VARCHAR(255) NOT NULL,
    symbol VARCHAR(10),
    decimal_places INTEGER DEFAULT 2,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_currencies_code ON currencies (code);
CREATE INDEX idx_currencies_deleted_at ON currencies (deleted_at);

-- Create addresses table (ISO20022 compliant)
CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    -- Structured address fields (ISO20022)
    address_type VARCHAR(50),                -- Type of address (e.g., ADDR, PBOX, HOME, BIZZ)
    department VARCHAR(70),                  -- Department
    sub_department VARCHAR(70),              -- Sub-department
    street_name VARCHAR(70),                 -- Street name
    building_number VARCHAR(16),             -- Building number
    building_name VARCHAR(35),               -- Building name
    floor VARCHAR(70),                       -- Floor
    post_box VARCHAR(16),                    -- Post office box number
    room VARCHAR(70),                        -- Room
    postal_code VARCHAR(16),                 -- Postal code/ZIP code
    town_name VARCHAR(35),                   -- Town/city name
    town_location_name VARCHAR(35),          -- Town location name
    district_name VARCHAR(35),               -- District name
    country_sub_division VARCHAR(35),        -- State/province/region
    country_id UUID REFERENCES countries (id), -- Country reference
    -- Unstructured address lines (ISO20022 allows up to 7 lines)
    address_line_1 VARCHAR(70),
    address_line_2 VARCHAR(70),
    address_line_3 VARCHAR(70),
    address_line_4 VARCHAR(70),
    address_line_5 VARCHAR(70),
    address_line_6 VARCHAR(70),
    address_line_7 VARCHAR(70),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_addresses_country_id ON addresses (country_id);
CREATE INDEX idx_addresses_postal_code ON addresses (postal_code);
CREATE INDEX idx_addresses_town_name ON addresses (town_name);
CREATE INDEX idx_addresses_deleted_at ON addresses (deleted_at);

-- Create entities table
CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    "name" VARCHAR(255) NOT NULL,
    registration_number VARCHAR(255) UNIQUE,
    "type" VARCHAR(50),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_entities_registration_number ON entities (registration_number);
CREATE INDEX idx_entities_type ON entities ("type");
CREATE INDEX idx_entities_deleted_at ON entities (deleted_at);

-- Create entity_addresses junction table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS entity_addresses (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    entity_id UUID NOT NULL REFERENCES entities (id) ON DELETE CASCADE,
    address_id UUID NOT NULL REFERENCES addresses (id) ON DELETE CASCADE,
    address_type VARCHAR(50),  -- e.g., 'REGISTERED', 'TRADING', 'BILLING', 'CORRESPONDENCE'
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    UNIQUE (entity_id, address_id)
);

CREATE INDEX idx_entity_addresses_entity_id ON entity_addresses (entity_id);
CREATE INDEX idx_entity_addresses_address_id ON entity_addresses (address_id);
CREATE INDEX idx_entity_addresses_deleted_at ON entity_addresses (deleted_at);

-- Create instruments table
CREATE TABLE IF NOT EXISTS instruments (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50),
    issue_currency_id UUID REFERENCES currencies (id),  -- Currency in which the instrument is issued
    primary_exchange VARCHAR(100),  -- Primary exchange where instrument trades (can trade on multiple)
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_instruments_type ON instruments ("type");
CREATE INDEX idx_instruments_issue_currency_id ON instruments (issue_currency_id);
CREATE INDEX idx_instruments_deleted_at ON instruments (deleted_at);

-- Create instrument_codes table for managing multiple identifier types
CREATE TABLE IF NOT EXISTS instrument_codes (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    instrument_id UUID NOT NULL REFERENCES instruments (id) ON DELETE CASCADE,
    code_type VARCHAR(50) NOT NULL,  -- e.g., 'ISIN', 'FIGI', 'CUSIP', 'WKN', 'SEDOL', 'RIC', 'TICKER'
    code_value VARCHAR(100) NOT NULL,
    identifier_level VARCHAR(50),  -- 'INTERNATIONAL', 'REGIONAL', 'LOCAL'
    market_identifier_code VARCHAR(10),  -- MIC code for local identifiers (e.g., 'XNAS', 'XFRA')
    region VARCHAR(50),  -- For regional identifiers (e.g., 'US', 'DE')
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    UNIQUE (instrument_id, code_type, code_value, market_identifier_code),
    CONSTRAINT check_mic_only_for_local CHECK (
        (identifier_level = 'LOCAL' AND market_identifier_code IS NOT NULL)
        OR (identifier_level != 'LOCAL' AND market_identifier_code IS NULL)
        OR (identifier_level IS NULL AND market_identifier_code IS NULL)
    ),
    CONSTRAINT check_region_only_for_regional CHECK (
        (identifier_level = 'REGIONAL' AND region IS NOT NULL)
        OR (identifier_level != 'REGIONAL' AND region IS NULL)
        OR (identifier_level IS NULL AND region IS NULL)
    )
);

CREATE INDEX idx_instrument_codes_instrument_id ON instrument_codes (instrument_id);
CREATE INDEX idx_instrument_codes_code_type ON instrument_codes (code_type);
CREATE INDEX idx_instrument_codes_code_value ON instrument_codes (code_value);
CREATE INDEX idx_instrument_codes_identifier_level ON instrument_codes (identifier_level);
CREATE INDEX idx_instrument_codes_market_identifier_code ON instrument_codes (market_identifier_code);
CREATE INDEX idx_instrument_codes_deleted_at ON instrument_codes (deleted_at);

-- Create accounts table
CREATE TABLE IF NOT EXISTS "accounts" ( -- noqa: RF06
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    account_number VARCHAR(255) NOT NULL UNIQUE,
    entity_id UUID REFERENCES entities (id),
    account_currency_id UUID REFERENCES currencies (id),  -- Currency of the account
    "type" VARCHAR(50),
    balance DECIMAL(19, 4) DEFAULT 0,
    opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_accounts_account_number ON "accounts" (account_number); -- noqa: RF06
CREATE INDEX idx_accounts_entity_id ON "accounts" (entity_id); -- noqa: RF06
CREATE INDEX idx_accounts_account_currency_id ON "accounts" (account_currency_id); -- noqa: RF06
CREATE INDEX idx_accounts_type ON "accounts" ("type"); -- noqa: RF06
CREATE INDEX idx_accounts_deleted_at ON "accounts" (deleted_at); -- noqa: RF06

-- Create SSIs table
CREATE TABLE IF NOT EXISTS ssis (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    entity_id UUID REFERENCES entities (id),
    settlement_currency_id UUID REFERENCES currencies (id),  -- Currency for settlement
    instrument_id UUID REFERENCES instruments (id),
    beneficiary_name VARCHAR(255) NOT NULL,
    beneficiary_account VARCHAR(255) NOT NULL,
    beneficiary_bank VARCHAR(255) NOT NULL,
    beneficiary_bank_bic VARCHAR(11),
    intermediary_bank VARCHAR(255),
    intermediary_bank_bic VARCHAR(11),
    settlement_type VARCHAR(50),
    valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMP,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_ssis_entity_id ON ssis (entity_id);
CREATE INDEX idx_ssis_settlement_currency_id ON ssis (settlement_currency_id);
CREATE INDEX idx_ssis_instrument_id ON ssis (instrument_id);
CREATE INDEX idx_ssis_deleted_at ON ssis (deleted_at);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    user_id UUID,
    changed_data JSONB,
    previous_data JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_audit_logs_entity_type ON audit_logs (entity_type);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs (entity_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs ("action");
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at);

-- Create standardized audit tables for each entity (following LEI audit pattern)

-- Countries audit table
CREATE TABLE IF NOT EXISTS countries_audit (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    country_id UUID NOT NULL,
    code VARCHAR(2) NOT NULL,
    "action" VARCHAR(20) NOT NULL,  -- CREATE, UPDATE, DELETE
    record_snapshot JSONB NOT NULL,
    changed_fields JSONB,
    changed_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_countries_audit_country_id ON countries_audit (country_id);
CREATE INDEX idx_countries_audit_code ON countries_audit (code);
CREATE INDEX idx_countries_audit_action ON countries_audit ("action");
CREATE INDEX idx_countries_audit_created_at ON countries_audit (created_at);

-- Currencies audit table
CREATE TABLE IF NOT EXISTS currencies_audit (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    currency_id UUID NOT NULL,
    code VARCHAR(3) NOT NULL,
    "action" VARCHAR(20) NOT NULL,  -- CREATE, UPDATE, DELETE
    record_snapshot JSONB NOT NULL,
    changed_fields JSONB,
    changed_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_currencies_audit_currency_id ON currencies_audit (currency_id);
CREATE INDEX idx_currencies_audit_code ON currencies_audit (code);
CREATE INDEX idx_currencies_audit_action ON currencies_audit ("action");
CREATE INDEX idx_currencies_audit_created_at ON currencies_audit (created_at);

-- Addresses audit table
CREATE TABLE IF NOT EXISTS addresses_audit (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    address_id UUID NOT NULL,
    "action" VARCHAR(20) NOT NULL,  -- CREATE, UPDATE, DELETE
    record_snapshot JSONB NOT NULL,
    changed_fields JSONB,
    changed_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_addresses_audit_address_id ON addresses_audit (address_id);
CREATE INDEX idx_addresses_audit_action ON addresses_audit ("action");
CREATE INDEX idx_addresses_audit_created_at ON addresses_audit (created_at);

-- Entities audit table
CREATE TABLE IF NOT EXISTS entities_audit (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    entity_id UUID NOT NULL,
    registration_number VARCHAR(255),
    "action" VARCHAR(20) NOT NULL,  -- CREATE, UPDATE, DELETE
    record_snapshot JSONB NOT NULL,
    changed_fields JSONB,
    changed_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entities_audit_entity_id ON entities_audit (entity_id);
CREATE INDEX idx_entities_audit_registration_number ON entities_audit (registration_number);
CREATE INDEX idx_entities_audit_action ON entities_audit ("action");
CREATE INDEX idx_entities_audit_created_at ON entities_audit (created_at);

-- Entity addresses audit table
CREATE TABLE IF NOT EXISTS entity_addresses_audit (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    entity_address_id UUID NOT NULL,
    entity_id UUID NOT NULL,
    address_id UUID NOT NULL,
    "action" VARCHAR(20) NOT NULL,  -- CREATE, UPDATE, DELETE
    record_snapshot JSONB NOT NULL,
    changed_fields JSONB,
    changed_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entity_addresses_audit_entity_address_id ON entity_addresses_audit (entity_address_id);
CREATE INDEX idx_entity_addresses_audit_entity_id ON entity_addresses_audit (entity_id);
CREATE INDEX idx_entity_addresses_audit_address_id ON entity_addresses_audit (address_id);
CREATE INDEX idx_entity_addresses_audit_action ON entity_addresses_audit ("action");
CREATE INDEX idx_entity_addresses_audit_created_at ON entity_addresses_audit (created_at);

-- Instruments audit table
CREATE TABLE IF NOT EXISTS instruments_audit (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    instrument_id UUID NOT NULL,
    "name" VARCHAR(255),
    "action" VARCHAR(20) NOT NULL,  -- CREATE, UPDATE, DELETE
    record_snapshot JSONB NOT NULL,
    changed_fields JSONB,
    changed_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_instruments_audit_instrument_id ON instruments_audit (instrument_id);
CREATE INDEX idx_instruments_audit_action ON instruments_audit ("action");
CREATE INDEX idx_instruments_audit_created_at ON instruments_audit (created_at);

-- Instrument codes audit table
CREATE TABLE IF NOT EXISTS instrument_codes_audit (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    instrument_code_id UUID NOT NULL,
    instrument_id UUID NOT NULL,
    code_type VARCHAR(50),
    code_value VARCHAR(100),
    "action" VARCHAR(20) NOT NULL,  -- CREATE, UPDATE, DELETE
    record_snapshot JSONB NOT NULL,
    changed_fields JSONB,
    changed_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_instrument_codes_audit_instrument_code_id ON instrument_codes_audit (instrument_code_id);
CREATE INDEX idx_instrument_codes_audit_instrument_id ON instrument_codes_audit (instrument_id);
CREATE INDEX idx_instrument_codes_audit_action ON instrument_codes_audit ("action");
CREATE INDEX idx_instrument_codes_audit_created_at ON instrument_codes_audit (created_at);

-- Accounts audit table
CREATE TABLE IF NOT EXISTS accounts_audit (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    account_id UUID NOT NULL,
    account_number VARCHAR(255),
    "action" VARCHAR(20) NOT NULL,  -- CREATE, UPDATE, DELETE
    record_snapshot JSONB NOT NULL,
    changed_fields JSONB,
    changed_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounts_audit_account_id ON accounts_audit (account_id);
CREATE INDEX idx_accounts_audit_account_number ON accounts_audit (account_number);
CREATE INDEX idx_accounts_audit_action ON accounts_audit ("action");
CREATE INDEX idx_accounts_audit_created_at ON accounts_audit (created_at);

-- SSIs audit table
CREATE TABLE IF NOT EXISTS ssis_audit (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    ssi_id UUID NOT NULL,
    beneficiary_account VARCHAR(255),
    "action" VARCHAR(20) NOT NULL,  -- CREATE, UPDATE, DELETE
    record_snapshot JSONB NOT NULL,
    changed_fields JSONB,
    changed_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ssis_audit_ssi_id ON ssis_audit (ssi_id);
CREATE INDEX idx_ssis_audit_action ON ssis_audit ("action");
CREATE INDEX idx_ssis_audit_created_at ON ssis_audit (created_at);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION UPDATE_UPDATED_AT_COLUMN()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables
CREATE TRIGGER update_countries_updated_at BEFORE UPDATE ON countries
FOR EACH ROW EXECUTE FUNCTION UPDATE_UPDATED_AT_COLUMN();

CREATE TRIGGER update_currencies_updated_at BEFORE UPDATE ON currencies
FOR EACH ROW EXECUTE FUNCTION UPDATE_UPDATED_AT_COLUMN();

CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON addresses
FOR EACH ROW EXECUTE FUNCTION UPDATE_UPDATED_AT_COLUMN();

CREATE TRIGGER update_entities_updated_at BEFORE UPDATE ON entities
FOR EACH ROW EXECUTE FUNCTION UPDATE_UPDATED_AT_COLUMN();

CREATE TRIGGER update_entity_addresses_updated_at BEFORE UPDATE ON entity_addresses
FOR EACH ROW EXECUTE FUNCTION UPDATE_UPDATED_AT_COLUMN();

CREATE TRIGGER update_instruments_updated_at BEFORE UPDATE ON instruments
FOR EACH ROW EXECUTE FUNCTION UPDATE_UPDATED_AT_COLUMN();

CREATE TRIGGER update_instrument_codes_updated_at BEFORE UPDATE ON instrument_codes
FOR EACH ROW EXECUTE FUNCTION UPDATE_UPDATED_AT_COLUMN();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON "accounts" -- noqa: RF06
FOR EACH ROW EXECUTE FUNCTION UPDATE_UPDATED_AT_COLUMN();

CREATE TRIGGER update_ssis_updated_at BEFORE UPDATE ON ssis
FOR EACH ROW EXECUTE FUNCTION UPDATE_UPDATED_AT_COLUMN();

CREATE TRIGGER update_audit_logs_updated_at BEFORE UPDATE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION UPDATE_UPDATED_AT_COLUMN();
