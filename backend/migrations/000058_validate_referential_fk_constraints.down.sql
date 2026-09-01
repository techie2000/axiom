-- Restore constraints to NOT VALID (pre-validation) state.
-- Drops fully-validated FKs and re-adds them as NOT VALID so that
-- new writes are still enforced while the row-level check is deferred.
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
