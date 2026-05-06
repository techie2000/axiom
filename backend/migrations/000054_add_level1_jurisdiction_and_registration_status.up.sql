ALTER TABLE lei_raw.lei_records
ADD COLUMN IF NOT EXISTS legal_jurisdiction VARCHAR(20),
ADD COLUMN IF NOT EXISTS registration_status VARCHAR(50);

COMMENT ON COLUMN lei_raw.lei_records.legal_jurisdiction IS
'ISO 3166-1/3166-2 code for entity legal formation jurisdiction from LEI-CDF Entity.LegalJurisdiction.';

COMMENT ON COLUMN lei_raw.lei_records.registration_status IS
'LEI registration lifecycle status from LEI-CDF Registration.RegistrationStatus (e.g. ISSUED, LAPSED, RETIRED).';

CREATE INDEX IF NOT EXISTS idx_lei_records_legal_jurisdiction
ON lei_raw.lei_records (legal_jurisdiction);

CREATE INDEX IF NOT EXISTS idx_lei_records_registration_status
ON lei_raw.lei_records (registration_status);
