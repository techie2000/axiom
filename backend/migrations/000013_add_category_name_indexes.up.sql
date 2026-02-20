-- Add specialized indexes for filtering by category and sorting by name
-- These optimize queries like: WHERE entity_category = 'X' ORDER BY legal_name

-- Partial index for SOLE_PROPRIETOR category sorted by name
CREATE INDEX IF NOT EXISTS idx_lei_records_sole_proprietor_name
ON lei_raw.lei_records (legal_name)
WHERE entity_category = 'SOLE_PROPRIETOR' AND deleted_at IS NULL;

-- Partial index for FUND category sorted by name
CREATE INDEX IF NOT EXISTS idx_lei_records_fund_name
ON lei_raw.lei_records (legal_name)
WHERE entity_category = 'FUND' AND deleted_at IS NULL;

-- Partial index for BRANCH category sorted by name
CREATE INDEX IF NOT EXISTS idx_lei_records_branch_name
ON lei_raw.lei_records (legal_name)
WHERE entity_category = 'BRANCH' AND deleted_at IS NULL;

-- Partial index for INTERNATIONAL_BRANCH category sorted by name
CREATE INDEX IF NOT EXISTS idx_lei_records_intl_branch_name
ON lei_raw.lei_records (legal_name)
WHERE entity_category = 'INTERNATIONAL_BRANCH' AND deleted_at IS NULL;

-- Composite index for general case: category + deleted_at + name
-- This helps when category is GENERAL or for other combinations
CREATE INDEX IF NOT EXISTS idx_lei_records_category_deleted_name
ON lei_raw.lei_records (entity_category, legal_name)
WHERE deleted_at IS NULL;

-- Update statistics to help query planner
ANALYZE lei_raw.lei_records;
