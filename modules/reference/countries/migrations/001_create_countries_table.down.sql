-- Migration: 001_create_countries_table.down.sql
-- Rollback script for countries table creation

DROP TRIGGER IF EXISTS update_countries_updated_at ON reference.countries;
DROP FUNCTION IF EXISTS reference.update_updated_at_column();
DROP TABLE IF EXISTS reference.countries;
DROP TYPE IF EXISTS reference.country_code_status;
-- Note: We don't drop the schema as other tables may use it
