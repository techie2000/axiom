-- Rollback: Remove status + name sorting indexes

DROP INDEX IF EXISTS lei_raw.idx_lei_records_status_deleted_name;
DROP INDEX IF EXISTS lei_raw.idx_lei_records_retired_name;
DROP INDEX IF EXISTS lei_raw.idx_lei_records_merged_name;
DROP INDEX IF EXISTS lei_raw.idx_lei_records_lapsed_name;
DROP INDEX IF EXISTS lei_raw.idx_lei_records_inactive_name;
