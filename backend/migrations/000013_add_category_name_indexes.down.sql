-- Rollback: Remove category + name sorting indexes

DROP INDEX IF EXISTS lei_raw.idx_lei_records_category_deleted_name;
DROP INDEX IF EXISTS lei_raw.idx_lei_records_intl_branch_name;
DROP INDEX IF EXISTS lei_raw.idx_lei_records_branch_name;
DROP INDEX IF EXISTS lei_raw.idx_lei_records_fund_name;
DROP INDEX IF EXISTS lei_raw.idx_lei_records_sole_proprietor_name;
