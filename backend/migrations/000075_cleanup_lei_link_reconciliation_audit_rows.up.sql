-- Remove meaningless audit rows created by the LEI link reconciliation pass.
--
-- Root cause: BatchUpdateLEILinkReferences previously wrote audit rows with
-- record_snapshot = '{}' and changed_fields containing only boolean flags
-- (e.g. '{"managing_lou": true}') instead of real before/after values.
-- The reconciliation pass has been updated to emit proper change tracking
-- going forward; this migration removes the historic noise records.
--
-- Safety: the WHERE clause is highly specific. Only rows that match ALL of:
--   1. record_snapshot is exactly the empty JSONB object {}
--   2. changed_fields is one of the three known boolean-flag patterns
-- are deleted.  No other audit rows are affected.

DELETE FROM lei_raw.lei_records_audit
WHERE
    record_snapshot = '{}'::JSONB
    AND (
        changed_fields = '{"managing_lou": true}'::JSONB
        OR changed_fields = '{"successor_lei": true}'::JSONB
        OR changed_fields = '{"managing_lou": true, "successor_lei": true}'::JSONB
    );
