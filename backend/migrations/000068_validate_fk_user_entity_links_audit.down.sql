-- Validation cannot be rolled back independently.
-- Constraint lifecycle rollback is handled by 000067 down migration.
SELECT 1 AS col1;
