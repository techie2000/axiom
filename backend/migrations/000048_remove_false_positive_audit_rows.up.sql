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
-- The fix is applied in two steps, each executed in batches of 10 000 rows to
-- keep per-statement runtime, memory, and WAL volume manageable on audit tables
-- that may contain millions of rows.  A single un-batched statement across 10 M
-- rows would likely time out or exhaust available memory.
--
-- NOTE: golang-migrate runs each migration inside one transaction, so row locks
-- are released only at migration commit.  This batching still reduces statement
-- cost, but large environments should run this migration in a maintenance window.
--
--   Step 1 – UPDATE mixed rows in batches, removing entries where
--             new_value == old_value (JSONB equality so PostgreSQL normalises
--             object key ordering for us).
--             JSONB_OBJECT_AGG returns NULL when all entries are removed;
--             those rows are cleaned up by step 2.
--
--   Step 2 – DELETE rows in batches where no genuine change entry remains
--             (covers fully-false-positive rows untouched by step 1, and rows
--             whose changed_fields became NULL in step 1).
--
-- Both steps are combined in a single DO block so the batch size is declared
-- once.  ORDER BY id plus a high-water-mark cursor (id > _last_id) keeps the
-- total scan linear rather than repeatedly rescanning from the beginning.

DO $$
DECLARE
    -- 10 000 rows per iteration balances lock/WAL pressure against loop overhead:
    -- each batch completes in well under a second while the total iteration count
    -- remains manageable even at 10 M rows (~1 000 batches per step).
    _batch_size CONSTANT INTEGER := 10000;
    _rows_done           INTEGER;
    _total               INTEGER;
    _last_id             UUID;
BEGIN
    -- Step 1: strip false-positive entries from mixed UPDATE rows.
    _total := 0;
    _last_id := '00000000-0000-0000-0000-000000000000';
    LOOP
        WITH to_fix AS (
            SELECT id
            FROM lei_raw.lei_records_audit
            WHERE "action" = 'UPDATE'
            AND id > _last_id
            AND changed_fields IS NOT NULL
            AND changed_fields::TEXT <> '{}'
            AND EXISTS (
                SELECT 1
                FROM JSONB_EACH(changed_fields) AS fld (field_key, field_val)
                WHERE (fld.field_val -> 'new_value') IS NOT DISTINCT FROM (fld.field_val -> 'old_value')
            )
            ORDER BY id
            LIMIT _batch_size
        ),
        updated AS (
            UPDATE lei_raw.lei_records_audit AS a
            SET changed_fields = (
                SELECT JSONB_OBJECT_AGG(fld.field_key, fld.field_val)
                FROM JSONB_EACH(a.changed_fields) AS fld (field_key, field_val)
                WHERE (fld.field_val -> 'new_value') IS DISTINCT FROM (fld.field_val -> 'old_value')
            )
            FROM to_fix
            WHERE a.id = to_fix.id
            RETURNING a.id
        )
        SELECT
            COUNT(*),
            COALESCE((ARRAY_AGG(id ORDER BY id DESC))[1], _last_id)
        INTO _rows_done, _last_id
        FROM updated;
        _total := _total + _rows_done;
        EXIT WHEN _rows_done = 0;
    END LOOP;
    RAISE NOTICE 'Step 1 complete: % rows updated', _total;

    -- Step 2: delete rows that have no genuine change entries.
    -- JSONB_EACH(NULL) returns no rows, so NOT EXISTS correctly handles the NULL
    -- case (rows set to NULL by step 1 and pre-existing fully-false-positive rows).
    _total := 0;
    _last_id := '00000000-0000-0000-0000-000000000000';
    LOOP
        WITH to_delete AS (
            SELECT a.id
            FROM lei_raw.lei_records_audit AS a
            WHERE a."action" = 'UPDATE'
            AND a.id > _last_id
            AND NOT EXISTS (
                SELECT 1
                FROM JSONB_EACH(a.changed_fields) AS fld (field_key, field_val)
                WHERE (fld.field_val -> 'new_value') IS DISTINCT FROM (fld.field_val -> 'old_value')
            )
            ORDER BY a.id
            LIMIT _batch_size
        ),
        deleted AS (
            DELETE FROM lei_raw.lei_records_audit
            USING to_delete
            WHERE lei_raw.lei_records_audit.id = to_delete.id
            RETURNING lei_raw.lei_records_audit.id
        )
        SELECT
            COUNT(*),
            COALESCE((ARRAY_AGG(id ORDER BY id DESC))[1], _last_id)
        INTO _rows_done, _last_id
        FROM deleted;
        _total := _total + _rows_done;
        EXIT WHEN _rows_done = 0;
    END LOOP;
    RAISE NOTICE 'Step 2 complete: % rows deleted', _total;
END $$;
