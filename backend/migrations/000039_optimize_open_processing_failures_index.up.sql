-- Optimize open-failures lookup by using a partial index that matches
-- repository filters: job_type + natural_key with resolved constrained to FALSE.

DROP INDEX IF EXISTS lei_raw.idx_lei_l2_failures_open_natural_key;

CREATE INDEX IF NOT EXISTS idx_lei_l2_failures_open_natural_key
ON lei_raw.lei_level2_processing_failures (job_type, natural_key)
WHERE resolved = FALSE
AND natural_key IS NOT NULL;
