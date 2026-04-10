-- Revert column comments to their state prior to migration 000053.

COMMENT ON COLUMN lei_raw.lei_records.initial_registration_date IS
'Date when LEI was first registered with GLEIF';

COMMENT ON COLUMN lei_raw.lei_records.last_update_date IS
'Date when LEI record was last updated in GLEIF system. Used for delta processing.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.relationship_type IS
'GLEIF relationship type code, e.g. IS_DIRECTLY_CONSOLIDATED_BY or IS_ULTIMATELY_CONSOLIDATED_BY.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.relationship_status IS
'Lifecycle status of the relationship: ACTIVE or INACTIVE.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.registration_status IS
'GLEIF registration status for this relationship record, e.g. PUBLISHED or LAPSED.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.initial_registration_date IS
'Timestamp when this relationship was first registered with GLEIF.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.last_update_date IS
'Timestamp of the most recent update to this relationship record in GLEIF.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.next_renewal_date IS
'Timestamp by which the reporting entity must renew or re-confirm this relationship.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.validation_sources IS
'Validation source level, e.g. FULLY_CORROBORATED or PARTIALLY_CORROBORATED.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.validation_documents IS
'Type of documentation used for validation, e.g. SUPPORTING_DOCUMENTS.';
