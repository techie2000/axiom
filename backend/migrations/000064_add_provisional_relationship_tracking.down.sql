DROP INDEX IF EXISTS lei_raw.idx_lei_rr_provisional_parent_child;
DROP INDEX IF EXISTS lei_raw.idx_lei_rr_is_provisional;

ALTER TABLE lei_raw.lei_relationship_records
DROP COLUMN IF EXISTS notes,
DROP COLUMN IF EXISTS is_provisional;
