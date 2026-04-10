-- No undo: deleted audit rows cannot be recreated.
-- This migration permanently removes false-positive UPDATE audit rows from Level 2 tables.
SELECT 1;
