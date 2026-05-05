ALTER TABLE lei_raw.lei_records
    ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS provisioning_source VARCHAR(50);

COMMENT ON COLUMN lei_raw.lei_records.is_provisional IS
'TRUE for LEI records issued by Axiom as a provisional identifier (AXIO prefix) rather
than sourced from GLEIF. Provisional records follow the same ISO 17442 structure and
succession policy as official LEIs. FALSE for all GLEIF-ingested records.';

COMMENT ON COLUMN lei_raw.lei_records.provisioning_source IS
'Reason or workflow that triggered creation of a provisional LEI record.
Only set when is_provisional = TRUE. Example values: onboarding, counterparty, internal.
NULL for official GLEIF-sourced records.';

CREATE INDEX IF NOT EXISTS idx_lei_raw_lei_records_is_provisional
ON lei_raw.lei_records (is_provisional)
WHERE is_provisional = TRUE;
