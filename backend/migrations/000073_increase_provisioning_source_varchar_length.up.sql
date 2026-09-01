-- Migration: Increase provisioning_source VARCHAR length to support URLs and extended references
-- Context: Provisional LEI records can reference external documents (e.g., prospectuses)
-- Error: "value too long for type character varying(50)" when inserting URLs
-- Example: https://www.butterfieldgroup.com/sites/butterfield-corp/files/.../ (165+ chars)

-- Increase provisioning_source from VARCHAR(50) to VARCHAR(1000)
-- This accommodates:
-- - Long document URLs (typically 100-500 chars)
-- - References with additional metadata (up to 1000 chars)
-- - Maintains consistency with other text fields that support URLs/references
ALTER TABLE lei_raw.lei_records
ALTER COLUMN provisioning_source TYPE VARCHAR(1000);

-- Update column comment to reflect new capacity
COMMENT ON COLUMN lei_raw.lei_records.provisioning_source IS
'Reason, reference, or URL that triggered creation of a provisional LEI record.
Only set when is_provisional = TRUE. Can contain URLs to source documents (prospectuses,
regulatory filings, etc.) or workflow labels (onboarding, counterparty, internal, etc.).
NULL for official GLEIF-sourced records.
Maximum length: 1000 characters.';
