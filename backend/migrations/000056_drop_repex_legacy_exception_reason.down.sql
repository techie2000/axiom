-- Restore the legacy exception_reason scalar column from the canonical JSONB array.
ALTER TABLE lei_raw.lei_reporting_exceptions
    ADD COLUMN IF NOT EXISTS exception_reason VARCHAR(200) NOT NULL DEFAULT '';

UPDATE lei_raw.lei_reporting_exceptions
SET exception_reason = COALESCE(
    (
        SELECT string_agg(elem, ',')
        FROM jsonb_array_elements_text(exception_reasons) AS elem
    ),
    ''
);
