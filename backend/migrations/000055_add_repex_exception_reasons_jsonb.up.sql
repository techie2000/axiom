ALTER TABLE lei_raw.lei_reporting_exceptions
    ADD COLUMN IF NOT EXISTS exception_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE lei_raw.lei_reporting_exceptions
SET exception_reasons = COALESCE(
    (
        SELECT jsonb_agg(trimmed_reason)
        FROM (
            SELECT NULLIF(BTRIM(reason_part), '') AS trimmed_reason
            FROM unnest(string_to_array(COALESCE(exception_reason, ''), ',')) AS reason_part
        ) parsed
        WHERE trimmed_reason IS NOT NULL
    ),
    '[]'::jsonb
)
WHERE exception_reasons = '[]'::jsonb;

COMMENT ON COLUMN lei_raw.lei_reporting_exceptions.exception_reasons IS
'Canonical JSONB array of GLEIF REPEX ExceptionReason values. Preserves repeatable spec semantics without flattening to a constrained scalar.';

CREATE INDEX IF NOT EXISTS idx_lei_repex_exception_reasons_gin
ON lei_raw.lei_reporting_exceptions USING GIN (exception_reasons);