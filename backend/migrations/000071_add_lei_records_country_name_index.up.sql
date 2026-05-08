-- Optimise the country-filter + ORDER BY legal_name query pattern on lei_records:
--   WHERE legal_address_country = ? AND deleted_at IS NULL ORDER BY legal_name LIMIT n
--
-- Without this index the planner uses idx_lei_records_legal_name_active (legal_name)
-- which scans rows in legal_name order but must skip every non-matching country row.
-- For a common country (e.g. GB = 225k rows) the planner had to discard 12 312 rows
-- before finding the first 51, reading 10 968 buffer pages in 1 645 ms.
--
-- The composite partial index (legal_address_country, legal_name) WHERE deleted_at IS NULL:
--   1. Narrows the scan to the requested country immediately (first key column)
--   2. Returns rows pre-sorted by legal_name (second key column), eliminating the sort
--   3. The partial predicate excludes soft-deleted rows from the index entirely
--
-- Result: LIMIT 51 reads exactly 51 index entries and 51 heap pages, not 12 000+.

CREATE INDEX IF NOT EXISTS idx_lei_records_country_legal_name_active
ON lei_raw.lei_records (legal_address_country, legal_name)
WHERE (deleted_at IS NULL);

ANALYZE lei_raw.lei_records;
