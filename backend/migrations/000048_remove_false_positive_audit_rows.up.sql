-- Remove false-positive UPDATE audit rows from lei_raw.lei_records_audit.
--
-- Root cause: detectChanges used reflect.DeepEqual on time.Time and JSONBString
-- values, which compared internal representation rather than semantic equality.
--
--   * time.Time: PostgreSQL-loaded times and XML-parsed times represent the same
--     UTC instant but may differ in their *Location representation.
--   * JSONBString (e.g. OtherNames): Go's json.Marshal sorts map keys
--     alphabetically (language < name < type), while PostgreSQL preserves the
--     original insertion key ordering.  The raw strings differ even when the
--     content is identical.
--
-- Two types of bad rows can exist:
--
--   A. "All false positive" rows: every entry in changed_fields has
--      new_value == old_value.  These rows must be deleted entirely.
--
--   B. "Mixed" rows: some entries are genuine changes, others are false
--      positives.  The false-positive entries must be stripped from
--      changed_fields, keeping the row because it records a real change.
--
-- The fix is applied in two steps:
--
--   Step 1 – UPDATE mixed rows, removing entries where
--             new_value == old_value (JSONB equality so PostgreSQL normalises
--             object key ordering for us).
--             JSONB_OBJECT_AGG returns NULL when all entries are removed;
--             those rows are cleaned up by step 2.
--
--   Step 2 – DELETE rows where no genuine change entry remains (covers
--             fully-false-positive rows untouched by step 1, and rows whose
--             changed_fields became NULL in step 1).

-- Step 1: strip false-positive entries from mixed UPDATE rows.
UPDATE lei_raw.lei_records_audit
SET changed_fields = (
    SELECT JSONB_OBJECT_AGG(fld.field_key, fld.field_val)
    FROM JSONB_EACH(changed_fields) AS fld (field_key, field_val)
    WHERE (fld.field_val -> 'new_value') IS DISTINCT FROM (fld.field_val -> 'old_value')
)
WHERE "action" = 'UPDATE'
AND changed_fields IS NOT NULL
AND changed_fields::TEXT <> '{}'
AND EXISTS (
    SELECT 1 AS has_false_positive
    FROM JSONB_EACH(changed_fields) AS fld (field_key, field_val)
    WHERE (fld.field_val -> 'new_value') IS NOT DISTINCT FROM (fld.field_val -> 'old_value')
);

-- Step 2: delete rows that have no genuine change entries.
-- JSONB_EACH(NULL) returns no rows, so NOT EXISTS correctly handles the NULL
-- case (rows set to NULL by step 1 and pre-existing fully-false-positive rows).
DELETE FROM lei_raw.lei_records_audit
WHERE id IN (
    SELECT a.id
    FROM lei_raw.lei_records_audit AS a
    WHERE
        a."action" = 'UPDATE'
        AND NOT EXISTS (
            SELECT 1 AS existence_check
            FROM JSONB_EACH(a.changed_fields) AS fld (field_key, field_val)
            WHERE
                (fld.field_val -> 'new_value') IS DISTINCT FROM (fld.field_val -> 'old_value')
        )
);
