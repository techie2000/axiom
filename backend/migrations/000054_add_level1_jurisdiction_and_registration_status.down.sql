DROP INDEX IF EXISTS idx_lei_records_registration_status;
DROP INDEX IF EXISTS idx_lei_records_legal_jurisdiction;

ALTER TABLE lei_raw.lei_records
    DROP COLUMN IF EXISTS registration_status,
    DROP COLUMN IF EXISTS legal_jurisdiction;
