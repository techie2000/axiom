-- Migration 000052: Clean and prevent Level 2 false-positive audit rows
-- Purpose: Remove false-positive UPDATE audit rows from Level 2 audit tables where
--          changed_fields contained only SourceFileID (provenance field, not business change)
--          or semantically identical values (JSONB key-order differences).
-- Impact: ~1.41M rows from lei_relationship_records_audit, ~18.05M from lei_reporting_exceptions_audit

DO $$
DECLARE
  v_batch_size CONSTANT INT := 10000;
  v_updated_count INT;
  v_deleted_count INT;
  v_total_updated_rr INT := 0;
  v_total_deleted_rr INT := 0;
  v_total_updated_repex INT := 0;
  v_total_deleted_repex INT := 0;
BEGIN
  -- ***** STEP 1: lei_relationship_records_audit *****
  RAISE NOTICE '=== Processing lei_raw.lei_relationship_records_audit ===';
  
  LOOP
    WITH to_fix AS (
      SELECT id FROM lei_raw.lei_relationship_records_audit
      WHERE action = 'UPDATE'
      AND changed_fields IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM jsonb_each(changed_fields) fld
          WHERE LOWER(fld.key) IN ('sourcefileid', 'source_file_id')
        )
        OR EXISTS (
          SELECT 1 FROM jsonb_each(changed_fields) fld
          WHERE (fld.value ->> 'new_value') IS NOT DISTINCT FROM (fld.value ->> 'old_value')
        )
      )
      ORDER BY id LIMIT v_batch_size
    ),
    updated AS (
      UPDATE lei_raw.lei_relationship_records_audit a
      SET changed_fields = (
        SELECT jsonb_object_agg(fld.key, fld.value)
        FROM jsonb_each(a.changed_fields) fld
        WHERE LOWER(fld.key) NOT IN ('sourcefileid', 'source_file_id')
        AND (fld.value ->> 'new_value') IS DISTINCT FROM (fld.value ->> 'old_value')
      )
      FROM to_fix
      WHERE a.id = to_fix.id
      RETURNING a.id
    )
    SELECT COUNT(*) INTO v_updated_count FROM updated;
    
    EXIT WHEN v_updated_count = 0;
    v_total_updated_rr := v_total_updated_rr + v_updated_count;
    RAISE NOTICE 'RR Step 1 Batch: Updated % rows (cumulative: %)', v_updated_count, v_total_updated_rr;
  END LOOP;

  LOOP
    WITH to_delete AS (
      SELECT id FROM lei_raw.lei_relationship_records_audit
      WHERE action = 'UPDATE'
      AND changed_fields IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM jsonb_each(changed_fields))
      ORDER BY id LIMIT v_batch_size
    ),
    deleted AS (
      DELETE FROM lei_raw.lei_relationship_records_audit a
      USING to_delete
      WHERE a.id = to_delete.id
      RETURNING a.id
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted;
    
    EXIT WHEN v_deleted_count = 0;
    v_total_deleted_rr := v_total_deleted_rr + v_deleted_count;
    RAISE NOTICE 'RR Step 2 Batch: Deleted % rows (cumulative: %)', v_deleted_count, v_total_deleted_rr;
  END LOOP;
  
  RAISE NOTICE 'Completed RR: Updated % rows, Deleted % rows', v_total_updated_rr, v_total_deleted_rr;

  -- ***** STEP 2: lei_reporting_exceptions_audit *****
  RAISE NOTICE '=== Processing lei_raw.lei_reporting_exceptions_audit ===';
  
  LOOP
    WITH to_fix AS (
      SELECT id FROM lei_raw.lei_reporting_exceptions_audit
      WHERE action = 'UPDATE'
      AND changed_fields IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM jsonb_each(changed_fields) fld
          WHERE LOWER(fld.key) IN ('sourcefileid', 'source_file_id')
        )
        OR EXISTS (
          SELECT 1 FROM jsonb_each(changed_fields) fld
          WHERE (fld.value ->> 'new_value') IS NOT DISTINCT FROM (fld.value ->> 'old_value')
        )
      )
      ORDER BY id LIMIT v_batch_size
    ),
    updated AS (
      UPDATE lei_raw.lei_reporting_exceptions_audit a
      SET changed_fields = (
        SELECT jsonb_object_agg(fld.key, fld.value)
        FROM jsonb_each(a.changed_fields) fld
        WHERE LOWER(fld.key) NOT IN ('sourcefileid', 'source_file_id')
        AND (fld.value ->> 'new_value') IS DISTINCT FROM (fld.value ->> 'old_value')
      )
      FROM to_fix
      WHERE a.id = to_fix.id
      RETURNING a.id
    )
    SELECT COUNT(*) INTO v_updated_count FROM updated;
    
    EXIT WHEN v_updated_count = 0;
    v_total_updated_repex := v_total_updated_repex + v_updated_count;
    RAISE NOTICE 'REPEX Step 1 Batch: Updated % rows (cumulative: %)', v_updated_count, v_total_updated_repex;
  END LOOP;

  LOOP
    WITH to_delete AS (
      SELECT id FROM lei_raw.lei_reporting_exceptions_audit
      WHERE action = 'UPDATE'
      AND changed_fields IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM jsonb_each(changed_fields))
      ORDER BY id LIMIT v_batch_size
    ),
    deleted AS (
      DELETE FROM lei_raw.lei_reporting_exceptions_audit a
      USING to_delete
      WHERE a.id = to_delete.id
      RETURNING a.id
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted;
    
    EXIT WHEN v_deleted_count = 0;
    v_total_deleted_repex := v_total_deleted_repex + v_deleted_count;
    RAISE NOTICE 'REPEX Step 2 Batch: Deleted % rows (cumulative: %)', v_deleted_count, v_total_deleted_repex;
  END LOOP;
  
  RAISE NOTICE 'Completed REPEX: Updated % rows, Deleted % rows', v_total_updated_repex, v_total_deleted_repex;

  -- Summary
  RAISE NOTICE '=== Migration 000052 Complete ===';
  RAISE NOTICE 'lei_relationship_records_audit: Updated % rows, Deleted % rows', v_total_updated_rr, v_total_deleted_rr;
  RAISE NOTICE 'lei_reporting_exceptions_audit: Updated % rows, Deleted % rows', v_total_updated_repex, v_total_deleted_repex;
  RAISE NOTICE 'TOTAL: Updated % rows, Deleted % rows', v_total_updated_rr + v_total_updated_repex, v_total_deleted_rr + v_total_deleted_repex;
END $$;
