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
ON lei_raw.lei_level2_processing_failures (job_type, natural_key)
WHERE resolved = FALSE AND natural_key IS NOT NULL;
