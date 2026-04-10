-- Remove false-positive UPDATE audit rows from Level 2 LEI audit tables.
--
-- Scope:
--   * lei_raw.lei_relationship_records_audit
--   * lei_raw.lei_reporting_exceptions_audit
--
-- This migration removes changed_fields entries that are not semantic data changes:
--   1) entries where new_value == old_value (JSONB semantic equality), and
--   2) source-file provenance-only entries (SourceFileID / source_file_id).
--
-- After stripping these entries, UPDATE audit rows with no meaningful changes left
-- are deleted.
--
-- Like 000048, work is done in batches to reduce per-statement runtime and WAL spikes.

DO $$
DECLARE
    _batch_size CONSTANT INTEGER := 10000;
    _rows_done INTEGER;
    _total INTEGER;
    _batch_no INTEGER;
    _last_id UUID;
    _next_last_id UUID;
    _table_name TEXT;
BEGIN
    FOREACH _table_name IN ARRAY ARRAY[
        'lei_raw.lei_relationship_records_audit',
        'lei_raw.lei_reporting_exceptions_audit'
    ]
    LOOP
        -- Step 1: remove false-positive/non-semantic entries from changed_fields.
        _total := 0;
        _batch_no := 0;
        _last_id := '00000000-0000-0000-0000-000000000000';

        LOOP
            EXECUTE format(
                $SQL$
                WITH to_fix AS (
                    SELECT id
                    FROM %s
                    WHERE "action" = 'UPDATE'
                    AND id > $1
                    AND changed_fields IS NOT NULL
                    AND changed_fields::TEXT <> '{}'
                    AND EXISTS (
                        SELECT 1
                        FROM JSONB_EACH(changed_fields) AS fld (field_key, field_val)
                        WHERE LOWER(fld.field_key) IN ('sourcefileid', 'source_file_id')
                        OR (fld.field_val -> 'new_value') IS NOT DISTINCT FROM (fld.field_val -> 'old_value')
                    )
                    ORDER BY id
                    LIMIT $2
                ),
                updated AS (
                    UPDATE %s AS a
                    SET changed_fields = (
                        SELECT JSONB_OBJECT_AGG(fld.field_key, fld.field_val)
                        FROM JSONB_EACH(a.changed_fields) AS fld (field_key, field_val)
                        WHERE LOWER(fld.field_key) NOT IN ('sourcefileid', 'source_file_id')
                        AND (fld.field_val -> 'new_value') IS DISTINCT FROM (fld.field_val -> 'old_value')
                    )
                    FROM to_fix
                    WHERE a.id = to_fix.id
                    RETURNING a.id
                )
                SELECT
                    COUNT(*),
                    COALESCE((ARRAY_AGG(id ORDER BY id DESC))[1], $1)
                FROM updated
                $SQL$,
                _table_name,
                _table_name
            )
            INTO _rows_done, _next_last_id
            USING _last_id, _batch_size;

            _total := _total + _rows_done;
            _last_id := _next_last_id;

            EXIT WHEN _rows_done = 0;

            _batch_no := _batch_no + 1;
            RAISE NOTICE 'Level 2 Step 1 batch % for %: % rows updated (running total: %, last_id: %)',
                _batch_no,
                _table_name,
                _rows_done,
                _total,
                _last_id;
        END LOOP;

        RAISE NOTICE 'Level 2 Step 1 complete for %: % rows updated', _table_name, _total;

        -- Step 2: remove UPDATE rows that have no meaningful changed_fields entries.
        _total := 0;
        _batch_no := 0;
        _last_id := '00000000-0000-0000-0000-000000000000';

        LOOP
            EXECUTE format(
                $SQL$
                WITH to_delete AS (
                    SELECT a.id
                    FROM %s AS a
                    WHERE a."action" = 'UPDATE'
                    AND a.id > $1
                    AND NOT EXISTS (
                        SELECT 1
                        FROM JSONB_EACH(a.changed_fields) AS fld (field_key, field_val)
                        WHERE LOWER(fld.field_key) NOT IN ('sourcefileid', 'source_file_id')
                        AND (fld.field_val -> 'new_value') IS DISTINCT FROM (fld.field_val -> 'old_value')
                    )
                    ORDER BY a.id
                    LIMIT $2
                ),
                deleted AS (
                    DELETE FROM %s
                    USING to_delete
                    WHERE %s.id = to_delete.id
                    RETURNING %s.id
                )
                SELECT
                    COUNT(*),
                    COALESCE((ARRAY_AGG(id ORDER BY id DESC))[1], $1)
                FROM deleted
                $SQL$,
                _table_name,
                _table_name,
                _table_name,
                _table_name
            )
            INTO _rows_done, _next_last_id
            USING _last_id, _batch_size;

            _total := _total + _rows_done;
            _last_id := _next_last_id;

            EXIT WHEN _rows_done = 0;

            _batch_no := _batch_no + 1;
            RAISE NOTICE 'Level 2 Step 2 batch % for %: % rows deleted (running total: %, last_id: %)',
                _batch_no,
                _table_name,
                _rows_done,
                _total,
                _last_id;
        END LOOP;

        RAISE NOTICE 'Level 2 Step 2 complete for %: % rows deleted', _table_name, _total;
    END LOOP;
END $$;
