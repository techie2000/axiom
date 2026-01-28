-- Migration 016: Drop duplicate audit triggers from migration 013
-- Issue: Migration 013 created old-style audit triggers that duplicated
-- the new audit triggers from migration 015, causing double audit entries
-- This migration cleans up the duplicate triggers

-- Drop old audit triggers if they exist (created in migration 013)
DROP TRIGGER IF EXISTS currencies_audit_insert ON reference.currencies;
DROP TRIGGER IF EXISTS currencies_audit_update ON reference.currencies;
DROP TRIGGER IF EXISTS currencies_audit_delete ON reference.currencies;

-- Note: The new audit trigger trg_currencies_audit from migration 015 remains active
-- and provides the correct single-entry audit trail behavior
