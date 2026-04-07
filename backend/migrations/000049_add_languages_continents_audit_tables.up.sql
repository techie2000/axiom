CREATE TABLE IF NOT EXISTS continents_audit (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    continent_code VARCHAR(2) NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    record_snapshot JSONB NOT NULL,
    changed_fields JSONB,
    changed_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_continents_audit_continent_code ON continents_audit (continent_code);
CREATE INDEX IF NOT EXISTS idx_continents_audit_action ON continents_audit ("action");
CREATE INDEX IF NOT EXISTS idx_continents_audit_created_at ON continents_audit (created_at);

CREATE TABLE IF NOT EXISTS languages_audit (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    language_code VARCHAR(2) NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    record_snapshot JSONB NOT NULL,
    changed_fields JSONB,
    changed_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_languages_audit_language_code ON languages_audit (language_code);
CREATE INDEX IF NOT EXISTS idx_languages_audit_action ON languages_audit ("action");
CREATE INDEX IF NOT EXISTS idx_languages_audit_created_at ON languages_audit (created_at);

COMMENT ON TABLE continents_audit IS
'Complete audit history of continent record changes.';

COMMENT ON TABLE languages_audit IS
'Complete audit history of language record changes.';
