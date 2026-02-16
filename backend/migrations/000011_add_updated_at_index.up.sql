-- Add B-tree index on updated_at for efficient sorting of recent records
-- This enables the Hybrid Approach: show recently updated records by default (fast)
-- Users search/filter to get sorted by legal_name (smaller result set)

-- Benefits:
-- 1. ORDER BY updated_at DESC LIMIT 50 is very fast (< 50ms vs 1276ms for legal_name)
-- 2. Most recent data is shown first (better UX for monitoring data updates)
-- 3. Search/filter queries still use legal_name sorting (results are filtered so sort is fast)

CREATE INDEX IF NOT EXISTS idx_lei_records_updated_at 
ON lei_raw.lei_records(updated_at DESC) 
WHERE deleted_at IS NULL;

-- Add updated_at to valid sort fields for API flexibility
-- This allows frontend to explicitly request updated_at sorting
