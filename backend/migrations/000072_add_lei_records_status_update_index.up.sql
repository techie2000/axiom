-- Optimise the entity_status + ORDER BY last_update_date query pattern on lei_records:
--   WHERE entity_status = ? AND deleted_at IS NULL ORDER BY last_update_date DESC LIMIT n
--
-- Without this index the planner uses idx_lei_records_last_update_date (last_update_date)
-- which scans all rows in reverse date order, then filters on status post-scan.
-- For INACTIVE status (238k rows) the planner had to discard 4 652 rows to find 51 results.
--
-- The composite partial index (entity_status, last_update_date) WHERE deleted_at IS NULL:
--   1. Narrows the scan to the requested status immediately (first key column)
--   2. Returns rows pre-sorted by last_update_date DESC (second key column), no sort needed
--   3. The partial predicate excludes soft-deleted rows from the index entirely
--
-- Result: LIMIT 51 reads exactly 51 index entries and 51 heap pages, not 4 700+.

CREATE INDEX IF NOT EXISTS idx_lei_records_status_last_update_active
ON lei_raw.lei_records (entity_status, last_update_date DESC)
WHERE (deleted_at IS NULL);

ANALYZE lei_raw.lei_records;
