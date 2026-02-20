-- Add database domain types to enforce data integrity at the database level.
-- Implements ISO 17442 LEI code validation and ISO 3166-1 alpha-2 country code validation.

-- ============================================================================
-- DOMAIN: country_code (created in public schema via default search_path)
-- ISO 3166-1 alpha-2 country code: exactly 2 uppercase letters (A-Z).
-- See: http://www.iso.org/iso/home/standards/country_codes.htm
-- ============================================================================

CREATE DOMAIN country_code AS VARCHAR(2)
CHECK (VALUE ~ '^[A-Z]{2}$'); -- noqa: RF04, CP02

COMMENT ON DOMAIN country_code IS
'ISO 3166-1 alpha-2 country code. Exactly 2 uppercase letters (A-Z). '
'Pattern: [A-Z]{2}. Examples: US, GB, JP, DE. '
'See: http://www.iso.org/iso/home/standards/country_codes.htm';

-- ============================================================================
-- DOMAIN: region_code (created in public schema via default search_path)
-- ISO 3166-2 region code: country code + hyphen + 1-3 uppercase alphanumeric
-- subdivision code (4 to 6 characters total).
-- See: https://www.iso.org/iso-3166-country-codes.html
-- ============================================================================

CREATE DOMAIN region_code AS VARCHAR(6)
CHECK (VALUE ~ '^[A-Z]{2}-[A-Z0-9]{1,3}$'); -- noqa: RF04, CP02

COMMENT ON DOMAIN region_code IS
'ISO 3166-2 region (subdivision) code. 4 to 6 characters total: '
'2-letter country code, a hyphen, and 1-3 uppercase alphanumeric subdivision characters. '
'Pattern: [A-Z]{2}-[A-Z0-9]{1,3}. Examples: US-CA, GB-ENG, AU-NSW, DE-BY. '
'See: https://www.iso.org/iso-3166-country-codes.html';

-- ============================================================================
-- DOMAIN: lei_raw.lei_code
-- Legal Entity Identifier (ISO 17442): 18 uppercase alphanumeric characters
-- followed by 2 check digits.
-- ============================================================================

CREATE DOMAIN lei_raw.lei_code AS VARCHAR(20)
CHECK (VALUE ~ '^[0-9A-Z]{18}[0-9]{2}$'); -- noqa: RF04, CP02

COMMENT ON DOMAIN lei_raw.lei_code IS
'Legal Entity Identifier domain (ISO 17442 standard). Exactly 20 characters: '
'18 uppercase alphanumeric characters ([0-9A-Z]) followed by a 2-digit checksum. '
'Pattern: [0-9A-Z]{18}[0-9]{2}. No spaces, control characters, or lowercase letters.'
'See: https://www.gleif.org/lei-data/access-and-use-lei-data/gleif-data-dictionary/2025-11-18_gleif-data-dictionary_v1.2_final.pdf';

-- ============================================================================
-- Apply lei_raw.lei_code to LEI columns
-- ============================================================================

-- lei_records.lei: primary LEI identifier (NOT NULL, UNIQUE)
ALTER TABLE lei_raw.lei_records
ALTER COLUMN lei TYPE lei_raw.lei_code USING lei::lei_raw.lei_code; -- noqa: CP05

-- lei_records.successor_lei: LEI of successor entity after merger (nullable)
ALTER TABLE lei_raw.lei_records
ALTER COLUMN successor_lei TYPE lei_raw.lei_code USING successor_lei::lei_raw.lei_code; -- noqa: CP05

-- source_files.last_processed_lei: resumption checkpoint (nullable)
ALTER TABLE lei_raw.source_files
ALTER COLUMN last_processed_lei TYPE lei_raw.lei_code -- noqa: CP05
USING last_processed_lei::lei_raw.lei_code; -- noqa: CP05

-- lei_records_audit.lei: denormalised LEI in audit trail (NOT NULL)
ALTER TABLE lei_raw.lei_records_audit
ALTER COLUMN lei TYPE lei_raw.lei_code USING lei::lei_raw.lei_code; -- noqa: CP05

-- ============================================================================
-- Apply country_code domain to country columns
-- ============================================================================

-- countries.code: primary key country code in reference table
ALTER TABLE countries
ALTER COLUMN code TYPE country_code USING code::country_code; -- noqa: CP05

-- lei_records.legal_address_country: ISO 3166-1 alpha-2 country (nullable)
ALTER TABLE lei_raw.lei_records
ALTER COLUMN legal_address_country TYPE country_code -- noqa: CP05
USING legal_address_country::country_code; -- noqa: CP05

-- lei_records.hq_address_country: ISO 3166-1 alpha-2 country (nullable)
ALTER TABLE lei_raw.lei_records
ALTER COLUMN hq_address_country TYPE country_code -- noqa: CP05
USING hq_address_country::country_code; -- noqa: CP05

-- ============================================================================
-- Update column comments to reference the domain type
-- ============================================================================

COMMENT ON COLUMN lei_raw.lei_records.lei IS
'20-character Legal Entity Identifier (ISO 17442). Type: lei_raw.lei_code domain. '
'Format: 18 uppercase alphanumeric characters + 2-digit checksum. Globally unique. '
'Pattern enforced by domain: [0-9A-Z]{18}[0-9]{2}.';

COMMENT ON COLUMN lei_raw.lei_records.successor_lei IS
'LEI of successor entity if this entity has merged or been restructured. '
'Type: lei_raw.lei_code domain. NULL if no successor.';

COMMENT ON COLUMN lei_raw.source_files.last_processed_lei IS
'20-character LEI code of the last successfully processed record. '
'Type: lei_raw.lei_code domain. Used to resume processing after interruption. NULL if not started.';

COMMENT ON COLUMN lei_raw.lei_records_audit.lei IS
'20-character LEI code. Type: lei_raw.lei_code domain. '
'Denormalised for fast querying without joins.';

COMMENT ON COLUMN countries.code IS
'ISO 3166-1 alpha-2 country code. Type: country_code domain. '
'Exactly 2 uppercase letters. Examples: US, GB, JP, DE.';

COMMENT ON COLUMN lei_raw.lei_records.legal_address_country IS
'Legal registered address country. Type: country_code domain. '
'ISO 3166-1 alpha-2 code (2 uppercase letters). Examples: US, GB, JP.';

COMMENT ON COLUMN lei_raw.lei_records.hq_address_country IS
'Headquarters address country. Type: country_code domain. '
'ISO 3166-1 alpha-2 code (2 uppercase letters). Examples: US, GB, JP.';
