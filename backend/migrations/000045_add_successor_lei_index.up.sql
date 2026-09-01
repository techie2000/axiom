-- Add index to speed predecessor lookups (WHERE successor_lei = ?)
CREATE INDEX IF NOT EXISTS idx_lei_raw_lei_records_successor_lei
ON lei_raw.lei_records (successor_lei)
WHERE successor_lei IS NOT NULL AND BTRIM(successor_lei) <> '';
