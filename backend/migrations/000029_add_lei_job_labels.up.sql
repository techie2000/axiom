ALTER TABLE lei_raw.file_processing_status
ADD COLUMN IF NOT EXISTS job_label VARCHAR(120),
ADD COLUMN IF NOT EXISTS depends_on_job_label VARCHAR(120);

ALTER TABLE lei_raw.source_files
ADD COLUMN IF NOT EXISTS job_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS job_label VARCHAR(120);

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'lei_raw'
			AND table_name = 'file_processing_status'
			AND column_name = 'depends_on_job_type'
	) THEN
		UPDATE lei_raw.file_processing_status
		SET
			job_label = CASE job_type
				WHEN 'MASTER_DATA_SYNC' THEN 'Reference Data (MASTER_DATA_SYNC)'
				WHEN 'DAILY_FULL' THEN 'Level 1 — LEI Records (DAILY_FULL)'
				WHEN 'DAILY_DELTA' THEN 'Level 1 — LEI Records Delta (DAILY_DELTA)'
				WHEN 'LEVEL2_RR' THEN 'Level 2 — Relationship Records (LEVEL2_RR)'
				WHEN 'LEVEL2_REPEX' THEN 'Level 2 — Reporting Exceptions (LEVEL2_REPEX)'
				ELSE job_type
			END,
			depends_on_job_label = CASE depends_on_job_type
				WHEN 'MASTER_DATA_SYNC' THEN 'Reference Data (MASTER_DATA_SYNC)'
				WHEN 'DAILY_FULL' THEN 'Level 1 — LEI Records (DAILY_FULL)'
				WHEN 'DAILY_DELTA' THEN 'Level 1 — LEI Records Delta (DAILY_DELTA)'
				WHEN 'LEVEL2_RR' THEN 'Level 2 — Relationship Records (LEVEL2_RR)'
				WHEN 'LEVEL2_REPEX' THEN 'Level 2 — Reporting Exceptions (LEVEL2_REPEX)'
				WHEN '' THEN NULL
				ELSE depends_on_job_type
			END;
	ELSE
		UPDATE lei_raw.file_processing_status
		SET
			job_label = CASE job_type
				WHEN 'MASTER_DATA_SYNC' THEN 'Reference Data (MASTER_DATA_SYNC)'
				WHEN 'DAILY_FULL' THEN 'Level 1 — LEI Records (DAILY_FULL)'
				WHEN 'DAILY_DELTA' THEN 'Level 1 — LEI Records Delta (DAILY_DELTA)'
				WHEN 'LEVEL2_RR' THEN 'Level 2 — Relationship Records (LEVEL2_RR)'
				WHEN 'LEVEL2_REPEX' THEN 'Level 2 — Reporting Exceptions (LEVEL2_REPEX)'
				ELSE job_type
			END,
			depends_on_job_label = NULL;
	END IF;
END
$$;

UPDATE lei_raw.source_files
SET
	job_type = CASE file_type
		WHEN 'FULL' THEN 'DAILY_FULL'
		WHEN 'DELTA' THEN 'DAILY_DELTA'
		WHEN 'RR' THEN 'LEVEL2_RR'
		WHEN 'REPEX' THEN 'LEVEL2_REPEX'
		ELSE NULL
	END,
	job_label = CASE file_type
		WHEN 'FULL' THEN 'Level 1 — LEI Records (DAILY_FULL)'
		WHEN 'DELTA' THEN 'Level 1 — LEI Records Delta (DAILY_DELTA)'
		WHEN 'RR' THEN 'Level 2 — Relationship Records (LEVEL2_RR)'
		WHEN 'REPEX' THEN 'Level 2 — Reporting Exceptions (LEVEL2_REPEX)'
		ELSE NULL
	END
WHERE job_type IS NULL OR job_label IS NULL;
