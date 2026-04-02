-- Remove false-positive UPDATE audit rows from lei_raw.lei_records_audit.
--
-- Root cause: detectChanges used reflect.DeepEqual on time.Time values, which
-- compared internal timezone/location pointers rather than the actual instant.
-- PostgreSQL-loaded times and XML-parsed times could represent the same UTC
-- instant but differ in their *Location representation, causing false positives
-- where changed_fields entries had identical new_value and old_value.
--
-- A bad row is an UPDATE audit entry where every field in changed_fields has
-- new_value equal to old_value (i.e. nothing actually changed).
--
-- The subquery identifies rows where:
--   1. action = 'UPDATE' (CREATE rows always have valid changed_fields)
--   2. changed_fields is not null/empty
--   3. ALL field entries have new_value = old_value (no actual change)
--
-- Condition 3 is implemented by checking that the count of fields with a
-- genuine difference (new_value != old_value) is zero.

DELETE FROM lei_raw.lei_records_audit
WHERE id IN (
    SELECT a.id
    FROM lei_raw.lei_records_audit AS a
    WHERE
        a."action" = 'UPDATE'
        AND a.changed_fields IS NOT NULL
        AND a.changed_fields::TEXT <> '{}'
        AND NOT EXISTS (
            SELECT 1 AS existence_check
            FROM JSONB_EACH(a.changed_fields) AS fld (field_key, field_val)
            WHERE
                (fld.field_val ->> 'new_value') IS DISTINCT FROM (fld.field_val ->> 'old_value')
        )
);
