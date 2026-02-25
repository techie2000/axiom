-- Migration: add audit tables for GLEIF Level 2 data (Relationship Records and Reporting Exceptions).
-- These tables follow the same pattern as lei_raw.lei_records_audit, which audits Level 1 LEI data.
-- Every INSERT and UPDATE performed by the Level 2 sync jobs is recorded here so that a full
-- change history is available for compliance and debugging purposes.

CREATE TABLE IF NOT EXISTS lei_raw.lei_relationship_records_audit (
    id                  UUID        NOT NULL DEFAULT GEN_RANDOM_UUID(),
    rr_record_id        UUID        NOT NULL,
    start_node_lei      VARCHAR(20) NOT NULL,
    end_node_lei        VARCHAR(20) NOT NULL,
    relationship_type   VARCHAR(100) NOT NULL,
    action              VARCHAR(20) NOT NULL,
    record_snapshot     JSONB       NOT NULL,
    changed_fields      JSONB,
    source_file_id      UUID REFERENCES lei_raw.source_files(id),
    changed_by          VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_lei_rr_audit PRIMARY KEY (id)
);

COMMENT ON TABLE lei_raw.lei_relationship_records_audit IS
'Full audit history for lei_raw.lei_relationship_records. Every CREATE, UPDATE, or DELETE
performed by the Level 2 sync job is recorded here, including a JSONB snapshot of the complete
record state and a diff of the changed fields. Mirrors the pattern used by lei_records_audit
for Level 1 LEI data.';

COMMENT ON COLUMN lei_raw.lei_relationship_records_audit.id IS
'Surrogate primary key for this audit row (UUID v4).';

COMMENT ON COLUMN lei_raw.lei_relationship_records_audit.rr_record_id IS
'UUID of the lei_relationship_records row that was created or updated.';

COMMENT ON COLUMN lei_raw.lei_relationship_records_audit.start_node_lei IS
'LEI of the child / controlled entity at the time of the change.';

COMMENT ON COLUMN lei_raw.lei_relationship_records_audit.end_node_lei IS
'LEI of the parent / controlling entity at the time of the change.';

COMMENT ON COLUMN lei_raw.lei_relationship_records_audit.relationship_type IS
'GLEIF relationship type (e.g. IS_DIRECTLY_CONSOLIDATED_BY) at the time of the change.';

COMMENT ON COLUMN lei_raw.lei_relationship_records_audit.action IS
'Type of change: CREATE (first ingestion of the record) or UPDATE (subsequent change detected).';

COMMENT ON COLUMN lei_raw.lei_relationship_records_audit.record_snapshot IS
'Complete JSONB snapshot of the relationship record at the time of the action.';

COMMENT ON COLUMN lei_raw.lei_relationship_records_audit.changed_fields IS
'JSONB map of fields that changed on UPDATE: {"field": {"old": <value>, "new": <value>}}.
Empty object {} for CREATE actions.';

COMMENT ON COLUMN lei_raw.lei_relationship_records_audit.source_file_id IS
'FK to lei_raw.source_files identifying the golden-copy file that triggered this change.';

COMMENT ON COLUMN lei_raw.lei_relationship_records_audit.changed_by IS
'Identity of the process that made the change (always ''system'' for automated sync jobs).';

COMMENT ON COLUMN lei_raw.lei_relationship_records_audit.created_at IS
'Timestamp when this audit row was inserted.';

CREATE INDEX IF NOT EXISTS idx_lei_rr_audit_rr_record_id
ON lei_raw.lei_relationship_records_audit (rr_record_id);

CREATE INDEX IF NOT EXISTS idx_lei_rr_audit_start_node_lei
ON lei_raw.lei_relationship_records_audit (start_node_lei);

CREATE INDEX IF NOT EXISTS idx_lei_rr_audit_end_node_lei
ON lei_raw.lei_relationship_records_audit (end_node_lei);

CREATE INDEX IF NOT EXISTS idx_lei_rr_audit_action
ON lei_raw.lei_relationship_records_audit (action);

CREATE INDEX IF NOT EXISTS idx_lei_rr_audit_created_at
ON lei_raw.lei_relationship_records_audit (created_at);

CREATE INDEX IF NOT EXISTS idx_lei_rr_audit_source_file_id
ON lei_raw.lei_relationship_records_audit (source_file_id);

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lei_raw.lei_reporting_exceptions_audit (
    id                  UUID        NOT NULL DEFAULT GEN_RANDOM_UUID(),
    repex_record_id     UUID        NOT NULL,
    lei                 VARCHAR(20) NOT NULL,
    exception_category  VARCHAR(100) NOT NULL,
    action              VARCHAR(20) NOT NULL,
    record_snapshot     JSONB       NOT NULL,
    changed_fields      JSONB,
    source_file_id      UUID,
    changed_by          VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_lei_repex_audit PRIMARY KEY (id)
);

COMMENT ON TABLE lei_raw.lei_reporting_exceptions_audit IS
'Full audit history for lei_raw.lei_reporting_exceptions. Every CREATE or UPDATE performed by
the Level 2 sync job is recorded here, including a JSONB snapshot of the complete record state
and a diff of the changed fields. Mirrors the pattern used by lei_records_audit for Level 1
LEI data.';

COMMENT ON COLUMN lei_raw.lei_reporting_exceptions_audit.id IS
'Surrogate primary key for this audit row (UUID v4).';

COMMENT ON COLUMN lei_raw.lei_reporting_exceptions_audit.repex_record_id IS
'UUID of the lei_reporting_exceptions row that was created or updated.';

COMMENT ON COLUMN lei_raw.lei_reporting_exceptions_audit.lei IS
'LEI of the entity claiming the reporting exception at the time of the change.';

COMMENT ON COLUMN lei_raw.lei_reporting_exceptions_audit.exception_category IS
'Exception category (DIRECT_ACCOUNTING_CONSOLIDATION_PARENT or ULTIMATE_ACCOUNTING_CONSOLIDATION_PARENT)
at the time of the change.';

COMMENT ON COLUMN lei_raw.lei_reporting_exceptions_audit.action IS
'Type of change: CREATE (first ingestion of the record) or UPDATE (subsequent change detected).';

COMMENT ON COLUMN lei_raw.lei_reporting_exceptions_audit.record_snapshot IS
'Complete JSONB snapshot of the reporting exception at the time of the action.';

COMMENT ON COLUMN lei_raw.lei_reporting_exceptions_audit.changed_fields IS
'JSONB map of fields that changed on UPDATE: {"field": {"old": <value>, "new": <value>}}.
Empty object {} for CREATE actions.';

COMMENT ON COLUMN lei_raw.lei_reporting_exceptions_audit.source_file_id IS
'FK to lei_raw.source_files identifying the golden-copy file that triggered this change.';

COMMENT ON COLUMN lei_raw.lei_reporting_exceptions_audit.changed_by IS
'Identity of the process that made the change (always ''system'' for automated sync jobs).';

COMMENT ON COLUMN lei_raw.lei_reporting_exceptions_audit.created_at IS
'Timestamp when this audit row was inserted.';

CREATE INDEX IF NOT EXISTS idx_lei_repex_audit_repex_record_id
ON lei_raw.lei_reporting_exceptions_audit (repex_record_id);

CREATE INDEX IF NOT EXISTS idx_lei_repex_audit_lei
ON lei_raw.lei_reporting_exceptions_audit (lei);

CREATE INDEX IF NOT EXISTS idx_lei_repex_audit_exception_category
ON lei_raw.lei_reporting_exceptions_audit (exception_category);

CREATE INDEX IF NOT EXISTS idx_lei_repex_audit_action
ON lei_raw.lei_reporting_exceptions_audit (action);

CREATE INDEX IF NOT EXISTS idx_lei_repex_audit_created_at
ON lei_raw.lei_reporting_exceptions_audit (created_at);

CREATE INDEX IF NOT EXISTS idx_lei_repex_audit_source_file_id
ON lei_raw.lei_reporting_exceptions_audit (source_file_id);
