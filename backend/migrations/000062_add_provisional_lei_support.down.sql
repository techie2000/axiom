DROP INDEX IF EXISTS lei_raw.idx_lei_raw_lei_records_is_provisional;

ALTER TABLE lei_raw.lei_records
    DROP COLUMN IF EXISTS is_provisional,
    DROP COLUMN IF EXISTS provisioning_source;
