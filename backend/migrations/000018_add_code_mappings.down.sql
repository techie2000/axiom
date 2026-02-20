-- Drop audit table and indexes first
DROP TABLE IF EXISTS code_mappings_audit;

-- Drop main table (also drops associated indexes)
DROP TABLE IF EXISTS code_mappings;
