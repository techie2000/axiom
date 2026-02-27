ALTER TABLE IF EXISTS lei_raw.lei_reporting_exceptions
ALTER COLUMN exception_category TYPE VARCHAR(100) USING LEFT(exception_category, 100),
ALTER COLUMN exception_reason TYPE VARCHAR(100) USING LEFT(exception_reason, 100);
