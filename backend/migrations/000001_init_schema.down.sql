-- Drop triggers
DROP TRIGGER IF EXISTS update_audit_logs_updated_at ON audit_logs;
DROP TRIGGER IF EXISTS update_ssis_updated_at ON ssis;
DROP TRIGGER IF EXISTS update_accounts_updated_at ON "accounts"; -- noqa: RF06
DROP TRIGGER IF EXISTS update_instrument_codes_updated_at ON instrument_codes;
DROP TRIGGER IF EXISTS update_instruments_updated_at ON instruments;
DROP TRIGGER IF EXISTS update_entity_addresses_updated_at ON entity_addresses;
DROP TRIGGER IF EXISTS update_entities_updated_at ON entities;
DROP TRIGGER IF EXISTS update_addresses_updated_at ON addresses;
DROP TRIGGER IF EXISTS update_currencies_updated_at ON currencies;
DROP TRIGGER IF EXISTS update_countries_updated_at ON countries;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop audit tables (no foreign key dependencies)
DROP TABLE IF EXISTS ssis_audit;
DROP TABLE IF EXISTS accounts_audit;
DROP TABLE IF EXISTS instrument_codes_audit;
DROP TABLE IF EXISTS instruments_audit;
DROP TABLE IF EXISTS entity_addresses_audit;
DROP TABLE IF EXISTS entities_audit;
DROP TABLE IF EXISTS addresses_audit;
DROP TABLE IF EXISTS currencies_audit;
DROP TABLE IF EXISTS countries_audit;

-- Drop tables (order matters due to foreign keys)
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS ssis;
DROP TABLE IF EXISTS "accounts"; -- noqa: RF06
DROP TABLE IF EXISTS instrument_codes;
DROP TABLE IF EXISTS instruments;
DROP TABLE IF EXISTS entity_addresses;
DROP TABLE IF EXISTS entities;
DROP TABLE IF EXISTS addresses;
DROP TABLE IF EXISTS currencies;
DROP TABLE IF EXISTS countries;

-- Drop extension
DROP EXTENSION IF EXISTS uuid_ossp;
