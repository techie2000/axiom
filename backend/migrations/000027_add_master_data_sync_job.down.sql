-- Revert migration 000027: remove MASTER_DATA_SYNC tracking and unlink DAILY_FULL.

UPDATE lei_raw.file_processing_status
SET depends_on_job_type = NULL
WHERE
    job_type = 'DAILY_FULL'
    AND depends_on_job_type = 'MASTER_DATA_SYNC';

DELETE FROM lei_raw.file_processing_status
WHERE job_type = 'MASTER_DATA_SYNC';
