-- Migration 009: Remove business rule constraints from audit table
-- Rationale: Audit tables should be permissive historical records, not enforce business rules
-- Business rules change over time - what was valid then may not be valid now and vice versa
-- Only audit metadata (audit_id, operation, operated_at) should have NOT NULL constraints

\echo 'Removing NOT NULL constraints from business data columns in audit table'

-- Remove NOT NULL from all business data columns
-- Keep NOT NULL only on audit metadata: audit_id, operation, operated_at
ALTER TABLE reference.countries_audit
ALTER COLUMN alpha2 DROP NOT NULL,
ALTER COLUMN numeric DROP NOT NULL,
ALTER COLUMN name_english DROP NOT NULL,
ALTER COLUMN name_french DROP NOT NULL,
ALTER COLUMN status DROP NOT NULL,
ALTER COLUMN record_created_at DROP NOT NULL,
ALTER COLUMN record_updated_at DROP NOT NULL;

\echo 'Audit table now accepts any historical values regardless of current business rules'
