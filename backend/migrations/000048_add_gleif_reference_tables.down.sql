-- Rollback: Remove GLEIF reference tables and legal_jurisdiction column

-- Remove processing status row
DELETE FROM lei_raw.file_processing_status WHERE job_type = 'GLEIF_REFERENCE_SYNC';

-- Drop triggers
DROP TRIGGER IF EXISTS update_gleif_jur_updated_at ON lei_raw.gleif_legal_jurisdictions;
DROP TRIGGER IF EXISTS update_gleif_roles_updated_at ON lei_raw.gleif_organizational_roles;
DROP TRIGGER IF EXISTS update_gleif_elf_updated_at ON lei_raw.gleif_entity_legal_forms;
DROP TRIGGER IF EXISTS update_gleif_ra_updated_at ON lei_raw.gleif_registration_authorities;

-- Remove legal_jurisdiction column and index
DROP INDEX IF EXISTS lei_raw.idx_lei_records_legal_jurisdiction;
ALTER TABLE lei_raw.lei_records DROP COLUMN IF EXISTS legal_jurisdiction;

-- Drop tables
DROP TABLE IF EXISTS lei_raw.gleif_legal_jurisdictions;
DROP TABLE IF EXISTS lei_raw.gleif_organizational_roles;
DROP TABLE IF EXISTS lei_raw.gleif_entity_legal_forms;
DROP TABLE IF EXISTS lei_raw.gleif_registration_authorities;
