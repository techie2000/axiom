-- Revert migration 000026: remove depends_on_job_type from file_processing_status.
ALTER TABLE lei_raw.file_processing_status
    DROP COLUMN IF EXISTS depends_on_job_type;
