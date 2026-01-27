-- Migration: 002_create_countries_audit_table.down.sql
-- Rollback script for audit table

-- Drop trigger first
DROP TRIGGER IF EXISTS audit_countries_changes ON reference.countries;

-- Drop function
DROP FUNCTION IF EXISTS reference.audit_countries_changes();

-- Drop audit table
DROP TABLE IF EXISTS reference.countries_audit;

-- Drop enum type
DROP TYPE IF EXISTS reference.audit_operation;
