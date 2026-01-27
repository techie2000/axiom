-- Migration 006: Remove alpha4 column
-- Rationale: alpha4 is only populated for formerly_used codes, which we now skip per ADR-007
-- It's very rarely present in other statuses (reserved types) so we can safely ignore it

\echo 'Dropping column: reference.countries.alpha4'
ALTER TABLE reference.countries
DROP COLUMN IF EXISTS alpha4;

\echo 'Dropping column: reference.countries_audit.alpha4'
ALTER TABLE reference.countries_audit
DROP COLUMN IF EXISTS alpha4;
