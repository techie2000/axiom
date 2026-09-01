-- Rollback: Revert provisioning_source from VARCHAR(1000) back to VARCHAR(50)
-- WARNING: If any records have provisioning_source values longer than 50 characters,
-- this migration will fail. Those records must be updated before rollback.

ALTER TABLE lei_raw.lei_records
ALTER COLUMN provisioning_source TYPE VARCHAR(50);

-- Restore original column comment
COMMENT ON COLUMN lei_raw.lei_records.provisioning_source IS
'Reason or workflow that triggered creation of a provisional LEI record.
Only set when is_provisional = TRUE. Example values: onboarding, counterparty, internal.
NULL for official GLEIF-sourced records.';
