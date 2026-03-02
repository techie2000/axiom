-- Expand REPEX exception_reason length to support multiple reason codes joined from GLEIF arrays
ALTER TABLE lei_raw.lei_reporting_exceptions
ALTER COLUMN exception_reason TYPE VARCHAR(200);
