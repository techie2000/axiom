ALTER TABLE lei_raw.lei_reporting_exceptions
ADD COLUMN IF NOT EXISTS exception_reasons JSONB NOT NULL DEFAULT '[]'::JSONB; -- noqa: RF04

UPDATE lei_raw.lei_reporting_exceptions
SET
    exception_reasons = COALESCE(
        (
            SELECT JSONB_AGG(trimmed_reason ORDER BY ordinality) AS agg_reasons -- noqa: RF04
            FROM (
                SELECT
                    ordinality, -- noqa: RF04
                    NULLIF(BTRIM(reason_part), '') AS trimmed_reason -- noqa: RF04
                FROM
                    UNNEST(STRING_TO_ARRAY(COALESCE(exception_reason, ''), ',')) WITH ORDINALITY -- noqa: RF04
                        AS parsed_parts (reason_part, ordinality) -- noqa: RF04
            ) AS parsed
            WHERE trimmed_reason IS NOT NULL
        ),
        '[]'::JSONB
    )
WHERE exception_reasons = '[]'::JSONB;

COMMENT ON COLUMN lei_raw.lei_reporting_exceptions.exception_reasons IS -- noqa: RF04
'Canonical JSONB array of GLEIF REPEX ExceptionReason values. Preserves repeatable spec semantics without flattening to a constrained scalar.';

CREATE INDEX IF NOT EXISTS idx_lei_repex_exception_reasons_gin
ON lei_raw.lei_reporting_exceptions USING gin (exception_reasons);
