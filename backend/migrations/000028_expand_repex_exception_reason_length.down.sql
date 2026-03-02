-- Revert REPEX exception_reason length to original width
-- Truncate values first to satisfy the narrower column limit.
UPDATE lei_raw.lei_reporting_exceptions
SET exception_reason = LEFT(exception_reason, 100)
WHERE LENGTH(exception_reason) > 100;

ALTER TABLE lei_raw.lei_reporting_exceptions
ALTER COLUMN exception_reason TYPE VARCHAR(100);
