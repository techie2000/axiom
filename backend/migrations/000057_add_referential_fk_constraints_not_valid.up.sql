-- Phase 1: Enforce referential integrity on clean FK columns.
-- Approach: NOT VALID adds the constraint immediately for new writes without
-- scanning the existing ~7 M rows. Phase 2 (migration 000058) runs VALIDATE
-- CONSTRAINT, which only needs a SHARE UPDATE EXCLUSIVE lock (concurrent DML
-- stays live).
--
-- Deploy order:
--   1. Deploy Go code that writes NULL (not '') for absent code values.
--   2. Apply this migration.
--   3. Apply migration 000058 to validate existing rows.
--
-- Columns covered:
--   lei_records.registration_authority  → gleif_registration_authorities(ra_id)
--   lei_records.entity_legal_form       → gleif_entity_legal_forms(elf_code)
--   lei_records.validation_authority    → gleif_registration_authorities(ra_id)
--   lei_records.successor_lei           → lei_records(lei)  [self-ref]
--   lei_records.managing_lou            → lei_records(lei)  [self-ref]
--   lei_relationship_records.start_node_lei → lei_records(lei)
--   lei_reporting_exceptions.lei        → lei_records(lei)

-- Normalize residual empty strings to NULL on nullable FK columns so that
-- existing rows do not block VALIDATE CONSTRAINT in migration 000058.
UPDATE lei_raw.lei_records
SET registration_authority = NULLIF(BTRIM(registration_authority), '')
WHERE registration_authority IS NOT NULL AND BTRIM(registration_authority) = '';

UPDATE lei_raw.lei_records
SET entity_legal_form = NULLIF(BTRIM(entity_legal_form), '')
WHERE entity_legal_form IS NOT NULL AND BTRIM(entity_legal_form) = '';

UPDATE lei_raw.lei_records
SET validation_authority = NULLIF(BTRIM(validation_authority), '')
WHERE validation_authority IS NOT NULL AND BTRIM(validation_authority) = '';

UPDATE lei_raw.lei_records
SET managing_lou = NULLIF(BTRIM(managing_lou), '')
WHERE managing_lou IS NOT NULL AND BTRIM(managing_lou) = '';

UPDATE lei_raw.lei_records
SET successor_lei = NULLIF(BTRIM(successor_lei), '')
WHERE successor_lei IS NOT NULL AND BTRIM(successor_lei) = '';

-- Add FK constraints as NOT VALID.
-- NULL values always pass FK checks; only non-null values are looked up.
ALTER TABLE lei_raw.lei_records
    ADD CONSTRAINT fk_lei_records_registration_authority
        FOREIGN KEY (registration_authority)
        REFERENCES lei_raw.gleif_registration_authorities (ra_id)
        NOT VALID,
    ADD CONSTRAINT fk_lei_records_entity_legal_form
        FOREIGN KEY (entity_legal_form)
        REFERENCES lei_raw.gleif_entity_legal_forms (elf_code)
        NOT VALID,
    ADD CONSTRAINT fk_lei_records_validation_authority
        FOREIGN KEY (validation_authority)
        REFERENCES lei_raw.gleif_registration_authorities (ra_id)
        NOT VALID,
    ADD CONSTRAINT fk_lei_records_successor_lei
        FOREIGN KEY (successor_lei)
        REFERENCES lei_raw.lei_records (lei)
        NOT VALID,
    ADD CONSTRAINT fk_lei_records_managing_lou
        FOREIGN KEY (managing_lou)
        REFERENCES lei_raw.lei_records (lei)
        NOT VALID;

ALTER TABLE lei_raw.lei_relationship_records
    ADD CONSTRAINT fk_lei_rr_start_node_lei
        FOREIGN KEY (start_node_lei)
        REFERENCES lei_raw.lei_records (lei)
        NOT VALID;

ALTER TABLE lei_raw.lei_reporting_exceptions
    ADD CONSTRAINT fk_lei_repex_lei
        FOREIGN KEY (lei)
        REFERENCES lei_raw.lei_records (lei)
        NOT VALID;
