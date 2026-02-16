-- Rollback: Remove B-tree index on updated_at
DROP INDEX IF EXISTS lei_raw.idx_lei_records_updated_at;
