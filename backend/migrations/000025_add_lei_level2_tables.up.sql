-- Migration: add Level 2 LEI tables for GLEIF "who owns whom" data.
-- Level 2 data captures two datasets published by GLEIF:
--   rr    - Relationship Records (ownership / consolidation chains between legal entities)
--   repex - Reporting Exceptions (entities that cannot disclose their parent relationship)
-- These tables MUST be populated after lei_raw.lei_records is populated because
-- the start_node_lei and end_node_lei columns reference LEI codes in that table.

CREATE TABLE IF NOT EXISTS lei_raw.lei_relationship_records (
    id                          UUID        NOT NULL DEFAULT GEN_RANDOM_UUID(),
    start_node_lei              VARCHAR(20) NOT NULL,
    end_node_lei                VARCHAR(20) NOT NULL,
    relationship_type           VARCHAR(100) NOT NULL,
    relationship_status         VARCHAR(50)  NOT NULL,
    relationship_periods        JSONB,
    relationship_qualifiers     JSONB,
    relationship_quantifiers    JSONB,
    registration_status         VARCHAR(50),
    initial_registration_date   TIMESTAMPTZ,
    last_update_date            TIMESTAMPTZ,
    next_renewal_date           TIMESTAMPTZ,
    managing_lou                VARCHAR(20),
    validation_sources          VARCHAR(100),
    validation_documents        VARCHAR(100),
    validation_reference        VARCHAR(500),
    source_file_id              UUID,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_lei_relationship_records PRIMARY KEY (id)
);

COMMENT ON TABLE lei_raw.lei_relationship_records IS
'GLEIF Level 2 Relationship Records (RR golden-copy). Each row represents a directional ownership
or consolidation relationship between two legal entities identified by their LEI codes.
Populated by the scheduled Level 2 sync job that runs after the Level 1 (lei_records) sync.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.id IS
'Surrogate primary key (UUID v4).';

COMMENT ON COLUMN lei_raw.lei_relationship_records.start_node_lei IS
'LEI of the child / controlled entity (the "who is owned" side). References lei_raw.lei_records.lei.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.end_node_lei IS
'LEI of the parent / controlling entity (the "who owns" side). References lei_raw.lei_records.lei.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.relationship_type IS
'GLEIF relationship type code, e.g. IS_DIRECTLY_CONSOLIDATED_BY or IS_ULTIMATELY_CONSOLIDATED_BY.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.relationship_status IS
'Lifecycle status of the relationship: ACTIVE or INACTIVE.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.relationship_periods IS
'JSONB array of time periods during which this relationship was in effect.
Each element contains startDate, endDate, and periodType.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.relationship_qualifiers IS
'JSONB array of qualifiers that provide additional context about the relationship,
e.g. ACCOUNTING_STANDARD or DOCUMENTATION_LEVEL.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.relationship_quantifiers IS
'JSONB array of quantifiers expressing percentage ownership or voting rights.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.registration_status IS
'GLEIF registration status for this relationship record, e.g. PUBLISHED or LAPSED.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.initial_registration_date IS
'Timestamp when this relationship was first registered with GLEIF.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.last_update_date IS
'Timestamp of the most recent update to this relationship record in GLEIF.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.next_renewal_date IS
'Timestamp by which the reporting entity must renew or re-confirm this relationship.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.managing_lou IS
'LEI of the Local Operating Unit (LOU) responsible for managing this relationship record.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.validation_sources IS
'Validation source level, e.g. FULLY_CORROBORATED or PARTIALLY_CORROBORATED.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.validation_documents IS
'Type of documentation used for validation, e.g. SUPPORTING_DOCUMENTS.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.validation_reference IS
'Reference identifier for the validation documentation.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.source_file_id IS
'Foreign key to lei_raw.source_files identifying which golden-copy download created this row.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.created_at IS
'Timestamp when this row was inserted into the database.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.updated_at IS
'Timestamp when this row was last updated in the database.';

-- Unique index on the natural key: the directed relationship between two entities.
-- A pair of LEIs can have both a direct and an ultimate consolidation relationship,
-- so relationship_type is included in the uniqueness constraint.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lei_rr_start_end_type
ON lei_raw.lei_relationship_records (start_node_lei, end_node_lei, relationship_type);

CREATE INDEX IF NOT EXISTS idx_lei_rr_start_node_lei
ON lei_raw.lei_relationship_records (start_node_lei);

CREATE INDEX IF NOT EXISTS idx_lei_rr_end_node_lei
ON lei_raw.lei_relationship_records (end_node_lei);

CREATE INDEX IF NOT EXISTS idx_lei_rr_relationship_status
ON lei_raw.lei_relationship_records (relationship_status);

CREATE INDEX IF NOT EXISTS idx_lei_rr_relationship_type
ON lei_raw.lei_relationship_records (relationship_type);

CREATE INDEX IF NOT EXISTS idx_lei_rr_source_file_id
ON lei_raw.lei_relationship_records (source_file_id);

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lei_raw.lei_reporting_exceptions (
    id                      UUID        NOT NULL DEFAULT GEN_RANDOM_UUID(),
    lei                     VARCHAR(20) NOT NULL,
    exception_category      VARCHAR(100) NOT NULL,
    exception_reason        VARCHAR(100) NOT NULL,
    exception_reference     VARCHAR(500),
    source_file_id          UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_lei_reporting_exceptions PRIMARY KEY (id)
);

COMMENT ON TABLE lei_raw.lei_reporting_exceptions IS
'GLEIF Level 2 Reporting Exceptions (REPEX golden-copy). Each row records a case where a legal
entity is exempt from disclosing its parent ownership relationship. Common reasons include no
known parent, natural persons as parents (privacy), or non-consolidated structures.
Populated by the scheduled Level 2 sync job that runs after the Level 1 (lei_records) sync.';

COMMENT ON COLUMN lei_raw.lei_reporting_exceptions.id IS
'Surrogate primary key (UUID v4).';

COMMENT ON COLUMN lei_raw.lei_reporting_exceptions.lei IS
'LEI of the entity that is claiming the reporting exception. References lei_raw.lei_records.lei.';

COMMENT ON COLUMN lei_raw.lei_reporting_exceptions.exception_category IS
'Category of the exception: DIRECT_ACCOUNTING_CONSOLIDATION_PARENT or ULTIMATE_ACCOUNTING_CONSOLIDATION_PARENT.';

COMMENT ON COLUMN lei_raw.lei_reporting_exceptions.exception_reason IS
'Reason code for the exception, e.g. NO_KNOWN_PERSON, NATURAL_PERSONS, NON_CONSOLIDATING,
BINDING_LEGAL_COMMITMENTS, LEGAL_OBSTACLES, DETRIMENT_NOT_EXCLUDED, DISCLOSURE_DETRIMENTAL,
or ESOTERIC_ORG_STRUCTURE.';

COMMENT ON COLUMN lei_raw.lei_reporting_exceptions.exception_reference IS
'Optional free-text reference or document identifier supporting the exception claim.';

COMMENT ON COLUMN lei_raw.lei_reporting_exceptions.source_file_id IS
'Foreign key to lei_raw.source_files identifying which golden-copy download created this row.';

COMMENT ON COLUMN lei_raw.lei_reporting_exceptions.created_at IS
'Timestamp when this row was inserted into the database.';

COMMENT ON COLUMN lei_raw.lei_reporting_exceptions.updated_at IS
'Timestamp when this row was last updated in the database.';

-- A single entity may have at most one exception per category.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lei_repex_lei_category
ON lei_raw.lei_reporting_exceptions (lei, exception_category);

CREATE INDEX IF NOT EXISTS idx_lei_repex_lei
ON lei_raw.lei_reporting_exceptions (lei);

CREATE INDEX IF NOT EXISTS idx_lei_repex_exception_category
ON lei_raw.lei_reporting_exceptions (exception_category);

CREATE INDEX IF NOT EXISTS idx_lei_repex_exception_reason
ON lei_raw.lei_reporting_exceptions (exception_reason);

CREATE INDEX IF NOT EXISTS idx_lei_repex_source_file_id
ON lei_raw.lei_reporting_exceptions (source_file_id);
