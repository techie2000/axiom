ALTER TABLE IF EXISTS lei_raw.lei_reporting_exceptions
ALTER COLUMN exception_category TYPE VARCHAR(200),
ALTER COLUMN exception_reason TYPE VARCHAR(200);
