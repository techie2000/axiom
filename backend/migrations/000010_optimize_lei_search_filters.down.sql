-- Rollback LEI search filter optimizations

DROP INDEX IF EXISTS lei_raw.idx_lei_records_status_active_deleted;
DROP INDEX IF EXISTS lei_raw.idx_lei_records_active_only;

ANALYZE lei_raw.lei_records;
