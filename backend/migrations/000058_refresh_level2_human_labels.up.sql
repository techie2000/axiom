-- Refresh human-facing Level 2 labels and comments to prefer descriptive names over
-- the GLEIF mnemonics RR and REPEX. Internal job codes remain unchanged.

UPDATE lei_raw.file_processing_status
SET job_label = CASE job_type
    WHEN 'LEVEL2_RR' THEN 'Level 2 — Relationship Records'
    WHEN 'LEVEL2_REPEX' THEN 'Level 2 — Reporting Exceptions'
    ELSE job_label
END,
updated_at = NOW()
WHERE job_type IN ('LEVEL2_RR', 'LEVEL2_REPEX');

UPDATE lei_raw.source_files
SET job_label = CASE job_type
    WHEN 'LEVEL2_RR' THEN 'Level 2 — Relationship Records'
    WHEN 'LEVEL2_REPEX' THEN 'Level 2 — Reporting Exceptions'
    ELSE job_label
END,
updated_at = NOW()
WHERE job_type IN ('LEVEL2_RR', 'LEVEL2_REPEX');

COMMENT ON TABLE lei_raw.lei_relationship_records IS
'GLEIF Level 2 Relationship Records golden-copy data. Each row represents a directional ownership
or consolidation relationship between two legal entities identified by their LEI codes.
Populated by the scheduled Level 2 sync job that runs after the Level 1 (lei_records) sync.';

COMMENT ON TABLE lei_raw.lei_reporting_exceptions IS
'GLEIF Level 2 Reporting Exceptions golden-copy data. Each row records a case where a legal
entity is exempt from disclosing its parent ownership relationship. Common reasons include no
known parent, natural persons as parents (privacy), or non-consolidated structures.
Populated by the scheduled Level 2 sync job that runs after the Level 1 (lei_records) sync.';

COMMENT ON TABLE lei_raw.lei_relationship_records_audit IS
'Full audit history for lei_raw.lei_relationship_records. Every CREATE, UPDATE, or DELETE
performed by the Level 2 sync job is recorded here, including a JSONB snapshot of the complete
record state and a diff of the changed fields. Mirrors the pattern used by lei_records_audit
for Level 1 LEI data.';

COMMENT ON TABLE lei_raw.lei_reporting_exceptions_audit IS
'Full audit history for lei_raw.lei_reporting_exceptions. Every CREATE or UPDATE performed by
the Level 2 sync job is recorded here, including a JSONB snapshot of the complete record state
and a diff of the changed fields. Mirrors the pattern used by lei_records_audit for Level 1
LEI data.';

COMMENT ON COLUMN lei_raw.lei_reporting_exceptions.exception_reasons IS
'Canonical JSONB array of GLEIF Reporting Exceptions ExceptionReason values. Preserves
repeatable specification semantics without flattening them to a constrained scalar.';