ALTER TABLE lei_raw.file_processing_status
DROP COLUMN IF EXISTS depends_on_job_label,
DROP COLUMN IF EXISTS job_label;

ALTER TABLE lei_raw.source_files
DROP COLUMN IF EXISTS job_label,
DROP COLUMN IF EXISTS job_type;
