-- Migration 000027: surface MASTER_DATA_SYNC as a tracked pipeline job.
--
-- Reference data (countries, currencies, continents, languages) is loaded from static JSON files
-- and must be current BEFORE the GLEIF LEI data is processed, because LEI records reference
-- country codes that may not yet exist in the database if the reference data is stale.
--
-- This migration:
--   1. Seeds a MASTER_DATA_SYNC row so the job is visible in file_processing_status immediately.
--   2. Sets DAILY_FULL.depends_on_job_type = 'MASTER_DATA_SYNC' to make the dependency explicit
--      and queryable without reading Go source code.
--
-- Full pipeline after this migration:
--   MASTER_DATA_SYNC  (root — loads countries/currencies from static JSON)
--     └── DAILY_FULL  (depends_on MASTER_DATA_SYNC — downloads GLEIF LEI full golden copy)
--           └── LEVEL2_RR    (depends_on DAILY_FULL — relationship records)
--                 └── LEVEL2_REPEX (depends_on LEVEL2_RR — reporting exceptions)
--   DAILY_DELTA       (root — currently disabled)

INSERT INTO lei_raw.file_processing_status (job_type, status, depends_on_job_type, created_at, updated_at)
SELECT
    'MASTER_DATA_SYNC' AS job_type,
    'IDLE' AS status,
    NULL AS depends_on_job_type,
    NOW() AS created_at,
    NOW() AS updated_at
WHERE NOT EXISTS (
    SELECT 1 AS col1 FROM lei_raw.file_processing_status
    WHERE job_type = 'MASTER_DATA_SYNC'
);

COMMENT ON TABLE lei_raw.file_processing_status IS
'Tracks the lifecycle status of every scheduled pipeline job. The depends_on_job_type column
encodes the upstream dependency so the full chain is visible without inspecting source code.
Full pipeline: MASTER_DATA_SYNC → DAILY_FULL → LEVEL2_RR → LEVEL2_REPEX.
DAILY_DELTA is a separate root job (currently disabled).';

-- Link DAILY_FULL to its upstream dependency.
-- Backfill only: do not overwrite an already-set value.
UPDATE lei_raw.file_processing_status
SET depends_on_job_type = 'MASTER_DATA_SYNC'
WHERE
    job_type = 'DAILY_FULL'
    AND depends_on_job_type IS NULL;
