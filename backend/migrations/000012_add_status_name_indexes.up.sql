-- Add specialized indexes for filtering by status and sorting by name
-- These optimize queries like: WHERE entity_status = 'X' ORDER BY legal_name

-- Partial index for INACTIVE status sorted by name
CREATE INDEX IF NOT EXISTS idx_lei_records_inactive_name 
ON lei_raw.lei_records (legal_name)
WHERE entity_status = 'INACTIVE' AND deleted_at IS NULL;

-- Partial index for LAPSED status sorted by name
CREATE INDEX IF NOT EXISTS idx_lei_records_lapsed_name 
ON lei_raw.lei_records (legal_name)
WHERE entity_status = 'LAPSED' AND deleted_at IS NULL;

-- Partial index for MERGED status sorted by name
CREATE INDEX IF NOT EXISTS idx_lei_records_merged_name 
ON lei_raw.lei_records (legal_name)
WHERE entity_status = 'MERGED' AND deleted_at IS NULL;

-- Partial index for RETIRED status sorted by name
CREATE INDEX IF NOT EXISTS idx_lei_records_retired_name 
ON lei_raw.lei_records (legal_name)
WHERE entity_status = 'RETIRED' AND deleted_at IS NULL;

-- Composite index for general case: status + deleted_at + name
-- This helps when status is not one of the specific values above
CREATE INDEX IF NOT EXISTS idx_lei_records_status_deleted_name 
ON lei_raw.lei_records (entity_status, legal_name)
WHERE deleted_at IS NULL;

-- Update statistics to help query planner
ANALYZE lei_raw.lei_records;
