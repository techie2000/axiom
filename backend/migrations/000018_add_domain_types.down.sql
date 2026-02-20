-- Revert domain types: restore original VARCHAR column types, then drop domains.
-- Order matters: columns must be converted away from the domain before the domain can be dropped.

-- ============================================================================
-- Revert lei_raw.lei_code domain usage
-- ============================================================================

ALTER TABLE lei_raw.lei_records_audit
ALTER COLUMN lei TYPE VARCHAR(20) USING lei::VARCHAR(20);

ALTER TABLE lei_raw.source_files
ALTER COLUMN last_processed_lei TYPE VARCHAR(20) USING last_processed_lei::VARCHAR(20);

ALTER TABLE lei_raw.lei_records
ALTER COLUMN successor_lei TYPE VARCHAR(20) USING successor_lei::VARCHAR(20);

ALTER TABLE lei_raw.lei_records
ALTER COLUMN lei TYPE VARCHAR(20) USING lei::VARCHAR(20);

-- ============================================================================
-- Revert country_code domain usage
-- ============================================================================

ALTER TABLE lei_raw.lei_records
ALTER COLUMN hq_address_country TYPE VARCHAR(2) USING hq_address_country::VARCHAR(2);

ALTER TABLE lei_raw.lei_records
ALTER COLUMN legal_address_country TYPE VARCHAR(2) USING legal_address_country::VARCHAR(2);

ALTER TABLE countries
ALTER COLUMN code TYPE VARCHAR(2) USING code::VARCHAR(2);

-- ============================================================================
-- Drop domains (now that no columns depend on them)
-- ============================================================================

DROP DOMAIN IF EXISTS lei_raw.lei_code;
DROP DOMAIN IF EXISTS country_code;
DROP DOMAIN IF EXISTS region_code;
