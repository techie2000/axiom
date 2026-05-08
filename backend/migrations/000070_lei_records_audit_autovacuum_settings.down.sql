-- Restore PostgreSQL default autovacuum analyze settings.
ALTER TABLE lei_raw.lei_records_audit
RESET (
    autovacuum_analyze_scale_factor,
    autovacuum_analyze_threshold
);
