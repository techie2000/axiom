-- Optimize common filter combinations for LEI search queries
-- These queries typically filter by entity_status and deleted_at along with text search

-- Create composite index for status + deleted_at (commonly used together)
CREATE INDEX IF NOT EXISTS idx_lei_records_status_active_deleted 
ON lei_raw.lei_records (entity_status, deleted_at) 
WHERE deleted_at IS NULL;

-- Create partial index for active, non-deleted records (most common query)
CREATE INDEX IF NOT EXISTS idx_lei_records_active_only 
ON lei_raw.lei_records (legal_name) 
WHERE entity_status = 'ACTIVE' AND deleted_at IS NULL;

-- Update statistics to help query planner
ANALYZE lei_raw.lei_records;
