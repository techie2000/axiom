-- Safety guard: abort if any row still has an empty JSONB array where the legacy
-- column is non-empty, which would indicate migration 000055 did not backfill cleanly.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM lei_raw.lei_reporting_exceptions
        WHERE exception_reasons = '[]'::jsonb
          AND exception_reason IS NOT NULL
          AND BTRIM(exception_reason) <> ''
        LIMIT 1
    ) THEN
        RAISE EXCEPTION
            'Aborting: rows found where exception_reasons is still empty but exception_reason is not. '
            'Re-run migration 000055 backfill before dropping the legacy column.';
    END IF;
END;
$$;

ALTER TABLE lei_raw.lei_reporting_exceptions
DROP COLUMN IF EXISTS exception_reason;
