-- Migration: Create registration_authorities tables in lei_raw schema
-- Purpose: Store GLEIF registration authority reference data for resolving
--          registration authority codes present in LEI Level 1/Level 2 records.

-- Registration authorities table (GLEIF code list)
CREATE TABLE IF NOT EXISTS lei_raw.registration_authorities (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    ra_code VARCHAR(100) NOT NULL,
    country_code VARCHAR(3),
    ra_name VARCHAR(500) NOT NULL,
    international_name VARCHAR(500),
    website VARCHAR(1000),
    gleif_notes TEXT,
    is_deprecated BOOLEAN NOT NULL DEFAULT FALSE,
    created_by VARCHAR(100) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_authorities_ra_code
ON lei_raw.registration_authorities (ra_code);

CREATE INDEX IF NOT EXISTS idx_registration_authorities_country_code
ON lei_raw.registration_authorities (country_code)
WHERE country_code IS NOT NULL
AND BTRIM(country_code) <> '';

CREATE INDEX IF NOT EXISTS idx_registration_authorities_is_deprecated
ON lei_raw.registration_authorities (is_deprecated);

COMMENT ON TABLE lei_raw.registration_authorities IS
'GLEIF registration authority reference data. Loaded from the GLEIF Registration
Authorities List (CSV). Each row represents one registration body that may be
referenced by registration_authority in lei_raw.lei_records.';

COMMENT ON COLUMN lei_raw.registration_authorities.ra_code IS
'GLEIF-assigned registration authority code (e.g. RA000585). Unique identifier
used in LEI Level 1 records to reference the registering body.';

COMMENT ON COLUMN lei_raw.registration_authorities.country_code IS
'ISO 3166-1 alpha-2 country code of the registration authority jurisdiction.';

COMMENT ON COLUMN lei_raw.registration_authorities.ra_name IS
'Official name of the registration authority in its primary language.';

COMMENT ON COLUMN lei_raw.registration_authorities.international_name IS
'English / international name of the registration authority when the primary name
is in another language. May be empty.';

COMMENT ON COLUMN lei_raw.registration_authorities.website IS
'Public website URL of the registration authority.';

COMMENT ON COLUMN lei_raw.registration_authorities.gleif_notes IS
'Free-text notes provided by GLEIF in the Registration Authorities List CSV.';

COMMENT ON COLUMN lei_raw.registration_authorities.is_deprecated IS
'TRUE when this authority code has been retired or superseded by GLEIF.';

-- Audit table for registration authorities
CREATE TABLE IF NOT EXISTS lei_raw.registration_authorities_audit (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    ra_id UUID NOT NULL,
    ra_code VARCHAR(100) NOT NULL,
    action VARCHAR(20) NOT NULL,
    record_snapshot JSONB NOT NULL,
    changed_fields JSONB,
    changed_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registration_authorities_audit_ra_id
ON lei_raw.registration_authorities_audit (ra_id);

CREATE INDEX IF NOT EXISTS idx_registration_authorities_audit_ra_code
ON lei_raw.registration_authorities_audit (ra_code);

CREATE INDEX IF NOT EXISTS idx_registration_authorities_audit_action
ON lei_raw.registration_authorities_audit (action);

CREATE INDEX IF NOT EXISTS idx_registration_authorities_audit_created_at
ON lei_raw.registration_authorities_audit (created_at);

COMMENT ON TABLE lei_raw.registration_authorities_audit IS
'Complete audit history of all registration authority record changes, including
initial loads and subsequent GLEIF CSV updates.';
