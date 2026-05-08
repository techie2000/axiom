-- Restore the original single-column index before dropping the composite.
CREATE INDEX IF NOT EXISTS idx_lei_records_audit_lei ON
lei_raw.lei_records_audit (lei);

DROP INDEX IF EXISTS lei_raw.idx_lei_records_audit_lei_created_at_desc;
