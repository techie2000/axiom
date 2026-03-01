-- Revert open-failures index to previous non-partial-key form.

DROP INDEX IF EXISTS lei_raw.idx_lei_l2_failures_open_natural_key;

CREATE INDEX IF NOT EXISTS idx_lei_l2_failures_open_natural_key
ON lei_raw.lei_level2_processing_failures (job_type, resolved, natural_key)
WHERE natural_key IS NOT NULL;
