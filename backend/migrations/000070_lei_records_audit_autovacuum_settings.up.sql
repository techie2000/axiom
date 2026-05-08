-- Tighten autovacuum analyze thresholds on lei_records_audit.
--
-- Default behaviour: autovacuum triggers ANALYZE after
--   n_live_tup * autovacuum_analyze_scale_factor (0.2) + autovacuum_analyze_threshold (50)
-- At 6.8 M rows that means stats are stale until ~1.4 M new rows have been inserted,
-- which is too coarse for a high-insert table like this one.
--
-- PostgreSQL uses an additive trigger formula:
--   autovacuum_analyze_threshold + autovacuum_analyze_scale_factor * n_live_tup
-- With these settings and ~6.8 M rows, ANALYZE triggers at ~78 000 new rows
-- (10 000 + 1% of 6.8 M). This keeps planner statistics current and prevents the planning-time
-- inflation observed in issue #521 (planner estimated 2 rows, actual was 24+).

ALTER TABLE lei_raw.lei_records_audit
    SET (autovacuum_analyze_scale_factor = 0.01,
         autovacuum_analyze_threshold    = 10000);
