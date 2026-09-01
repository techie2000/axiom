-- Restore the legacy exception_reason scalar column from the canonical JSONB array.
ALTER TABLE lei_raw.lei_reporting_exceptions
ADD COLUMN IF NOT EXISTS exception_reason VARCHAR(200) NOT NULL DEFAULT '';

UPDATE lei_raw.lei_reporting_exceptions
SET exception_reason = COALESCE(
    (
        SELECT STRING_AGG(elem, ',') AS agg_elem -- noqa: RF04
        FROM JSONB_ARRAY_ELEMENTS_TEXT(exception_reasons) AS elem -- noqa: RF04
    ),
    ''
);
