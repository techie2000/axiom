-- Rollback: Drop GIN index on other_names

DROP INDEX IF EXISTS lei_raw.idx_lei_records_other_names_gin;
