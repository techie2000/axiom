ALTER TABLE lei_raw.lei_reporting_exceptions
    DROP CONSTRAINT IF EXISTS fk_lei_repex_lei;

ALTER TABLE lei_raw.lei_relationship_records
    DROP CONSTRAINT IF EXISTS fk_lei_rr_start_node_lei;

ALTER TABLE lei_raw.lei_records
    DROP CONSTRAINT IF EXISTS fk_lei_records_managing_lou,
    DROP CONSTRAINT IF EXISTS fk_lei_records_successor_lei,
    DROP CONSTRAINT IF EXISTS fk_lei_records_validation_authority,
    DROP CONSTRAINT IF EXISTS fk_lei_records_entity_legal_form,
    DROP CONSTRAINT IF EXISTS fk_lei_records_registration_authority;
