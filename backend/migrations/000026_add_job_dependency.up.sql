-- Migration 000026: add depends_on_job_type to file_processing_status.
--
-- This column makes the scheduler's job dependency graph visible in the database so that:
--   1. Operators and the UI can display the full pipeline (DAILY_FULL → LEVEL2_RR → LEVEL2_REPEX)
--      without inspecting Go source code.
--   2. The scheduler can use the column for smart recovery on startup: if a dependent job
--      (e.g. LEVEL2_REPEX) is FAILED but its parent (LEVEL2_RR) already succeeded, the
--      scheduler resumes from the failed step rather than restarting from DAILY_FULL.

ALTER TABLE lei_raw.file_processing_status
ADD COLUMN IF NOT EXISTS depends_on_job_type VARCHAR(50);

COMMENT ON COLUMN lei_raw.file_processing_status.depends_on_job_type IS
'Optional job_type of the upstream (parent) job that must complete successfully before this job
can run. NULL means this job is a root job with no upstream dependency. The scheduler reads this
column on startup to determine the correct recovery order: a failed dependent job is resumed
before considering whether to re-run its parent. Known dependency chain:
  DAILY_FULL  (no parent)
  LEVEL2_RR   depends_on DAILY_FULL
  LEVEL2_REPEX depends_on LEVEL2_RR';

-- Seed the Level 2 job rows if they do not exist yet.
-- (They are created lazily by the scheduler the first time it runs, but seeding them here
--  ensures the dependency metadata is visible from the very first migration run.)
INSERT INTO lei_raw.file_processing_status (job_type, status, depends_on_job_type, created_at, updated_at)
SELECT
    'LEVEL2_RR' AS job_type,
    'IDLE' AS status,
    'DAILY_FULL' AS depends_on_job_type,
    NOW() AS created_at,
    NOW() AS updated_at
WHERE NOT EXISTS (
    SELECT 1 AS col1 FROM lei_raw.file_processing_status
    WHERE job_type = 'LEVEL2_RR'
);

INSERT INTO lei_raw.file_processing_status (job_type, status, depends_on_job_type, created_at, updated_at)
SELECT
    'LEVEL2_REPEX' AS job_type,
    'IDLE' AS status,
    'LEVEL2_RR' AS depends_on_job_type,
    NOW() AS created_at,
    NOW() AS updated_at
WHERE NOT EXISTS (
    SELECT 1 AS col1 FROM lei_raw.file_processing_status
    WHERE job_type = 'LEVEL2_REPEX'
);

-- For rows already created lazily by the scheduler (depends_on_job_type is still NULL),
-- backfill the dependency metadata.
UPDATE lei_raw.file_processing_status
SET depends_on_job_type = 'DAILY_FULL'
WHERE
    job_type = 'LEVEL2_RR'
    AND depends_on_job_type IS NULL;

UPDATE lei_raw.file_processing_status
SET depends_on_job_type = 'LEVEL2_RR'
WHERE
    job_type = 'LEVEL2_REPEX'
    AND depends_on_job_type IS NULL;
