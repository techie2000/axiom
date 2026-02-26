CREATE TABLE IF NOT EXISTS lei_raw.lei_level2_processing_failures (
    id                       UUID         NOT NULL DEFAULT GEN_RANDOM_UUID(),
    job_type                 VARCHAR(50)  NOT NULL,
    source_file_id           UUID,
    failure_stage            VARCHAR(50)  NOT NULL,
    natural_key              TEXT,
    raw_record               JSONB,
    error_message            TEXT         NOT NULL,
    resolved                 BOOLEAN      NOT NULL DEFAULT FALSE,
    resolved_at              TIMESTAMPTZ,
    resolved_source_file_id  UUID,
    resolved_note            TEXT,
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_lei_level2_processing_failures PRIMARY KEY (id)
);

COMMENT ON TABLE lei_raw.lei_level2_processing_failures IS
'Durable record of individual processing failures that occur during Level 1 (DAILY_FULL, DAILY_DELTA)
and Level 2 (LEVEL2_RR, LEVEL2_REPEX) import jobs. Each row represents one failed record at a specific
pipeline stage (DECODE, MAP, UPSERT). Rows progress through an open/resolved lifecycle: a failure is
marked resolved when the same natural key is subsequently ingested successfully.';

COMMENT ON COLUMN lei_raw.lei_level2_processing_failures.id IS
'Surrogate primary key for this failure row (UUID v4).';

COMMENT ON COLUMN lei_raw.lei_level2_processing_failures.job_type IS
'Canonical job type that produced the failure: LEVEL1_FULL, LEVEL1_DELTA, LEVEL2_RR, or LEVEL2_REPEX.';

COMMENT ON COLUMN lei_raw.lei_level2_processing_failures.source_file_id IS
'UUID of the lei_raw.source_files row associated with the import run that generated the failure.
NULL if the failure occurred before a source file was resolved.';

COMMENT ON COLUMN lei_raw.lei_level2_processing_failures.failure_stage IS
'Pipeline stage where the failure occurred: DECODE (JSON parse error), MAP (field mapping/validation
error), or UPSERT (database write error).';

COMMENT ON COLUMN lei_raw.lei_level2_processing_failures.natural_key IS
'Human-readable identifier for the failed record within its job type. For LEVEL1 this is the LEI code;
for LEVEL2_RR it is start_lei|end_lei|relationship_type; for LEVEL2_REPEX it is lei|exception_category.
NULL for DECODE failures that could not produce a key.';

COMMENT ON COLUMN lei_raw.lei_level2_processing_failures.raw_record IS
'JSONB snapshot of the raw record that failed processing. NULL for DECODE-stage failures where
no structured record could be parsed.';

COMMENT ON COLUMN lei_raw.lei_level2_processing_failures.error_message IS
'Full error message from the processing failure, captured for triage and alerting.';

COMMENT ON COLUMN lei_raw.lei_level2_processing_failures.resolved IS
'FALSE while the failure is open (unresolved). Set to TRUE when a subsequent successful upsert
for the same natural_key closes the lifecycle.';

COMMENT ON COLUMN lei_raw.lei_level2_processing_failures.resolved_at IS
'Timestamp when the failure was resolved. NULL while resolved = FALSE.';

COMMENT ON COLUMN lei_raw.lei_level2_processing_failures.resolved_source_file_id IS
'UUID of the source_files row whose successful import resolved this failure.
NULL while resolved = FALSE.';

COMMENT ON COLUMN lei_raw.lei_level2_processing_failures.resolved_note IS
'Human-readable note describing how or why the failure was resolved
(e.g. "Resolved by subsequent successful upsert"). Empty string when not applicable.';

COMMENT ON COLUMN lei_raw.lei_level2_processing_failures.created_at IS
'Timestamp when the failure row was first recorded.';

COMMENT ON COLUMN lei_raw.lei_level2_processing_failures.updated_at IS
'Timestamp of the last update to this row (e.g. when resolved was set to TRUE).';

CREATE INDEX IF NOT EXISTS idx_lei_l2_failures_job_type
ON lei_raw.lei_level2_processing_failures (job_type);

CREATE INDEX IF NOT EXISTS idx_lei_l2_failures_resolved
ON lei_raw.lei_level2_processing_failures (resolved);

CREATE INDEX IF NOT EXISTS idx_lei_l2_failures_job_resolved_created
ON lei_raw.lei_level2_processing_failures (job_type, resolved, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lei_l2_failures_source_file
ON lei_raw.lei_level2_processing_failures (source_file_id);

CREATE INDEX IF NOT EXISTS idx_lei_l2_failures_natural_key
ON lei_raw.lei_level2_processing_failures (natural_key)
WHERE natural_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lei_l2_failures_open_natural_key
ON lei_raw.lei_level2_processing_failures (job_type, resolved, natural_key)
WHERE natural_key IS NOT NULL;
