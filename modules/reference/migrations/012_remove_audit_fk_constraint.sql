-- Migration 012: Remove foreign key constraint from audit table
-- Rationale: Audit table should be independent and record deletions
-- 
-- Problem discovered when attempting to DELETE from countries table:
--   DELETE FROM reference.countries WHERE alpha2='AQ'
--   ERROR: Key (alpha2)=(AQ) is not present in table "countries"
--   Context: audit trigger trying to INSERT DELETE record into audit table
--   
-- Root cause:
--   1. DELETE removes AQ from countries table
--   2. AFTER DELETE trigger fires to record the deletion
--   3. Trigger tries INSERT into countries_audit with alpha2='AQ'
--   4. FK constraint requires alpha2 to exist in countries table
--   5. But AQ was already deleted → FK violation
--
-- Solution:
--   Remove the FK constraint - audit table should be independent
--   Audit tables are historical records and should persist even after
--   the referenced records are deleted from the main table
--
-- Additionally:
--   ON DELETE CASCADE would delete entire audit history when main record deleted
--   This defeats the purpose of audit trails (permanent historical record)

\echo 'Removing foreign key constraint from countries_audit table'
ALTER TABLE reference.countries_audit
    DROP CONSTRAINT IF EXISTS fk_countries_alpha2;

\echo 'Foreign key constraint removed'
\echo 'Audit table is now independent - can record deletions without constraint violations'
\echo 'Audit history will be preserved even if main table records are deleted'
