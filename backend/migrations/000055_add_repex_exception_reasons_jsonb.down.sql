DROP INDEX IF EXISTS idx_lei_repex_exception_reasons_gin;

ALTER TABLE lei_raw.lei_reporting_exceptions
DROP COLUMN IF EXISTS exception_reasons;
