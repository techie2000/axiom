-- Fix data quality issues with failure_category field
-- Issue 1: FAILED records with NULL failure_category → set to UNKNOWN
-- Issue 2: COMPLETED/PENDING records with non-empty failure_category → clear it

-- Fix FAILED records missing failure_category
UPDATE lei_raw.source_files
SET failure_category = 'UNKNOWN'
WHERE
    processing_status = 'FAILED'
    AND (failure_category IS NULL OR failure_category = '');

-- Clear failure_category and processing_error for successfully completed files
UPDATE lei_raw.source_files
SET
    failure_category = '',
    processing_error = ''
WHERE
    processing_status IN ('COMPLETED', 'PENDING')
    AND (failure_category IS NOT NULL AND failure_category != '');

-- Add comment for documentation
COMMENT ON COLUMN lei_raw.source_files.failure_category IS 'Categorized failure reason (only set when processing_status=FAILED): SCHEMA_ERROR, NETWORK_ERROR, FILE_CORRUPTION, FILE_MISSING, TIMEOUT, or UNKNOWN';
