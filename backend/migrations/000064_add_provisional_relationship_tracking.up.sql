-- Add support for provisional (manually-created) parent/child relationships
-- These relationships are for provisional LEI records and are distinct from GLEIF-sourced relationships

ALTER TABLE lei_raw.lei_relationship_records
ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN lei_raw.lei_relationship_records.is_provisional IS
'TRUE for manually-created parent/child relationships between provisional LEI records.
FALSE for all GLEIF-sourced relationship records (golden-copy RR data).
Allows distinguishing administrative/provisional relationships from authoritative GLEIF data.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.notes IS
'Optional internal notes for provisional relationships. Only set when is_provisional = TRUE.
NULL for all GLEIF-sourced relationship records.';

-- Index to efficiently find provisional relationships
CREATE INDEX IF NOT EXISTS idx_lei_rr_is_provisional
ON lei_raw.lei_relationship_records (is_provisional)
WHERE is_provisional = TRUE;

-- Composite index for provisional parent queries (relationship linking two provisional LEIs)
CREATE INDEX IF NOT EXISTS idx_lei_rr_provisional_parent_child
ON lei_raw.lei_relationship_records (start_node_lei, end_node_lei)
WHERE is_provisional = TRUE;
