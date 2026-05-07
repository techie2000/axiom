-- Add GLEIF reference code-list tables
-- These tables support daily ingestion of GLEIF registration authorities,
-- entity legal forms, organizational roles, and legal jurisdictions before
-- LEI Level 1/2 ingest to prevent unresolved reference code lookups.

-- 1. GLEIF Registration Authorities (issue #212)
-- Source: https://www.gleif.org/en/lei-data/code-lists/gleif-registration-authorities-list
CREATE TABLE IF NOT EXISTS lei_raw.gleif_registration_authorities (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    ra_id VARCHAR(50) NOT NULL UNIQUE,
    organization_name VARCHAR(500) NOT NULL,
    jurisdiction VARCHAR(100),
    international_name VARCHAR(500),
    languages_used VARCHAR(100),
    website VARCHAR(500),
    comments TEXT, -- noqa: RF04
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(100) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gleif_ra_ra_id ON lei_raw.gleif_registration_authorities (ra_id);
CREATE INDEX idx_gleif_ra_active ON lei_raw.gleif_registration_authorities (active);
CREATE INDEX idx_gleif_ra_jurisdiction ON lei_raw.gleif_registration_authorities (jurisdiction);

COMMENT ON TABLE lei_raw.gleif_registration_authorities IS
'GLEIF registration authorities list. Sourced daily from GLEIF CSV. '
'Used to resolve registration_authority codes in LEI records to human-readable names.';

COMMENT ON COLUMN lei_raw.gleif_registration_authorities.ra_id IS
'Registration authority identifier code (e.g. RA000001). Matches registration_authority '
'column in lei_raw.lei_records.';

COMMENT ON COLUMN lei_raw.gleif_registration_authorities.organization_name IS
'Official name of the registration authority or business registry.';

COMMENT ON COLUMN lei_raw.gleif_registration_authorities.jurisdiction IS
'Country or jurisdiction where the registration authority operates (ISO 3166-1 alpha-2 or subdivision code).';

COMMENT ON COLUMN lei_raw.gleif_registration_authorities.active IS
'FALSE when the registration authority has been deprecated or removed from the GLEIF list.';

-- 2. GLEIF Entity Legal Forms (ISO 20275) (issue #213)
-- Source: https://www.gleif.org/en/lei-data/code-lists/iso-20275-entity-legal-forms-code-list
CREATE TABLE IF NOT EXISTS lei_raw.gleif_entity_legal_forms (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    elf_code VARCHAR(10) NOT NULL UNIQUE,
    entity_legal_form_name VARCHAR(500) NOT NULL,
    abbreviations VARCHAR(100),
    country_of_formation VARCHAR(2),
    country_subdivision_of_formation VARCHAR(10),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_by VARCHAR(100) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gleif_elf_elf_code ON lei_raw.gleif_entity_legal_forms (elf_code);
CREATE INDEX idx_gleif_elf_status ON lei_raw.gleif_entity_legal_forms (status);
CREATE INDEX idx_gleif_elf_country ON lei_raw.gleif_entity_legal_forms (country_of_formation);

COMMENT ON TABLE lei_raw.gleif_entity_legal_forms IS
'ISO 20275 Entity Legal Forms code list. Sourced daily from GLEIF CSV. '
'Used to resolve entity_legal_form codes in LEI records to human-readable names.';

COMMENT ON COLUMN lei_raw.gleif_entity_legal_forms.elf_code IS
'ELF code (Entity Legal Form code, ISO 20275). Matches entity_legal_form column in lei_raw.lei_records.';

COMMENT ON COLUMN lei_raw.gleif_entity_legal_forms.entity_legal_form_name IS
'Official name of the legal form (e.g. Public Limited Company, GmbH).';

COMMENT ON COLUMN lei_raw.gleif_entity_legal_forms.abbreviations IS
'Common abbreviations for this legal form (e.g. PLC, GmbH, SA).';

COMMENT ON COLUMN lei_raw.gleif_entity_legal_forms.country_of_formation IS
'ISO 3166-1 alpha-2 country code where this legal form applies.';

COMMENT ON COLUMN lei_raw.gleif_entity_legal_forms.country_subdivision_of_formation IS
'ISO 3166-2 country subdivision code where this legal form applies.';

COMMENT ON COLUMN lei_raw.gleif_entity_legal_forms.status IS
'Lifecycle status from GLEIF: ACTIVE or DECOMMISSIONED.';

-- 3. GLEIF Official Organizational Roles (ISO 5009) (issue #214)
-- Source: https://www.gleif.org/en/lei-data/code-lists/iso-5009-official-organizational-roles-code-list
CREATE TABLE IF NOT EXISTS lei_raw.gleif_organizational_roles (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    role_code VARCHAR(50) NOT NULL UNIQUE, -- noqa: RF04
    role_name VARCHAR(500) NOT NULL,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(100) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gleif_roles_role_code ON lei_raw.gleif_organizational_roles (role_code);
CREATE INDEX idx_gleif_roles_active ON lei_raw.gleif_organizational_roles (active);

COMMENT ON TABLE lei_raw.gleif_organizational_roles IS
'ISO 5009 Official Organizational Roles code list. Sourced daily from GLEIF CSV. '
'Used to resolve role codes in LEI Level 2 data to human-readable role names.';

COMMENT ON COLUMN lei_raw.gleif_organizational_roles.role_code IS
'ISO 5009 role code (e.g. GENERAL_PARTNER, MANAGING_DIRECTOR).';

COMMENT ON COLUMN lei_raw.gleif_organizational_roles.role_name IS
'Human-readable name for the organizational role.';

COMMENT ON COLUMN lei_raw.gleif_organizational_roles.description IS
'Extended description of the role, as provided by GLEIF.';

COMMENT ON COLUMN lei_raw.gleif_organizational_roles.active IS
'FALSE when the role has been deprecated or removed from the GLEIF list.';

-- 4. GLEIF Accepted Legal Jurisdictions (issue #215)
-- Source: https://www.gleif.org/en/lei-data/code-lists/gleif-accepted-legal-jurisdictions-code-list
CREATE TABLE IF NOT EXISTS lei_raw.gleif_legal_jurisdictions (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    jurisdiction_code VARCHAR(20) NOT NULL UNIQUE,
    jurisdiction_name VARCHAR(500) NOT NULL,
    country_code VARCHAR(2),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(100) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gleif_jur_jurisdiction_code ON lei_raw.gleif_legal_jurisdictions (jurisdiction_code);
CREATE INDEX idx_gleif_jur_country_code ON lei_raw.gleif_legal_jurisdictions (country_code);
CREATE INDEX idx_gleif_jur_active ON lei_raw.gleif_legal_jurisdictions (active);

COMMENT ON TABLE lei_raw.gleif_legal_jurisdictions IS
'GLEIF accepted legal jurisdictions code list. Sourced daily from GLEIF CSV. '
'Used to resolve LEI entity jurisdiction codes to human-readable names.';

COMMENT ON COLUMN lei_raw.gleif_legal_jurisdictions.jurisdiction_code IS
'Jurisdiction code as used in LEI records (e.g. US, GB, DE-BY). '
'Matches the LegalJurisdiction field in GLEIF Level 1 JSON data.';

COMMENT ON COLUMN lei_raw.gleif_legal_jurisdictions.jurisdiction_name IS
'Human-readable name of the jurisdiction (e.g. United States, United Kingdom, Bavaria).';

COMMENT ON COLUMN lei_raw.gleif_legal_jurisdictions.country_code IS
'ISO 3166-1 alpha-2 country code extracted from the jurisdiction code prefix.';

COMMENT ON COLUMN lei_raw.gleif_legal_jurisdictions.active IS
'FALSE when the jurisdiction has been deprecated or removed from the GLEIF list.';

-- 5. Add updated_at triggers for new tables
CREATE TRIGGER update_gleif_ra_updated_at BEFORE UPDATE ON lei_raw.gleif_registration_authorities
FOR EACH ROW EXECUTE FUNCTION UPDATE_UPDATED_AT_COLUMN();

CREATE TRIGGER update_gleif_elf_updated_at BEFORE UPDATE ON lei_raw.gleif_entity_legal_forms
FOR EACH ROW EXECUTE FUNCTION UPDATE_UPDATED_AT_COLUMN();

CREATE TRIGGER update_gleif_roles_updated_at BEFORE UPDATE ON lei_raw.gleif_organizational_roles
FOR EACH ROW EXECUTE FUNCTION UPDATE_UPDATED_AT_COLUMN();

CREATE TRIGGER update_gleif_jur_updated_at BEFORE UPDATE ON lei_raw.gleif_legal_jurisdictions
FOR EACH ROW EXECUTE FUNCTION UPDATE_UPDATED_AT_COLUMN();

-- 6. Add GLEIF_REFERENCE_SYNC job to file_processing_status so the pipeline is visible in UI
INSERT INTO lei_raw.file_processing_status (job_type, status, created_at, updated_at)
VALUES ('GLEIF_REFERENCE_SYNC', 'IDLE', NOW(), NOW())
ON CONFLICT DO NOTHING;
