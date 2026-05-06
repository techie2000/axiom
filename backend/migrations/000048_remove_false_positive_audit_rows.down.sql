-- No undo: deleted audit rows cannot be recreated.
-- This migration permanently removes false-positive audit rows (see up migration).
SELECT 1 AS col1;
