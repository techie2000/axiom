-- Phase 2: Validate FK constraints added NOT VALID in migration 000057.
-- Each VALIDATE CONSTRAINT acquires a SHARE UPDATE EXCLUSIVE lock, which
-- allows concurrent reads and DML but blocks DDL. On a ~7 M row lei_records
-- table this typically completes in seconds; run during low-traffic window
-- if latency is a concern.
--
-- If any row violates a constraint the statement will fail with a detail line
-- showing the offending key. Run the referential-integrity queries from
-- docs/lei/ to diagnose before retrying.

ALTER TABLE lei_raw.lei_records
    VALIDATE CONSTRAINT fk_lei_records_registration_authority;

ALTER TABLE lei_raw.lei_records
    VALIDATE CONSTRAINT fk_lei_records_entity_legal_form;

ALTER TABLE lei_raw.lei_records
    VALIDATE CONSTRAINT fk_lei_records_validation_authority;

ALTER TABLE lei_raw.lei_records
    VALIDATE CONSTRAINT fk_lei_records_successor_lei;

ALTER TABLE lei_raw.lei_records
    VALIDATE CONSTRAINT fk_lei_records_managing_lou;

ALTER TABLE lei_raw.lei_relationship_records
    VALIDATE CONSTRAINT fk_lei_rr_start_node_lei;

ALTER TABLE lei_raw.lei_reporting_exceptions
    VALIDATE CONSTRAINT fk_lei_repex_lei;
