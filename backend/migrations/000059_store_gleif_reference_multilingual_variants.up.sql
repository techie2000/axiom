-- Persist all valid multilingual/context variants from GLEIF reference lists.
-- Previous schema enforced one row per code and collapsed valid rows.

-- Parent table for ELF codes. Child variants remain in
-- lei_raw.gleif_entity_legal_forms.
CREATE TABLE IF NOT EXISTS lei_raw.gleif_entity_legal_form_codes (
    elf_code VARCHAR(10) PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lei_raw.gleif_entity_legal_form_codes IS
'Parent code table for ELF values. FK target for lei_records.entity_legal_form and parent for multilingual ELF variants.';

COMMENT ON COLUMN lei_raw.gleif_entity_legal_form_codes.elf_code IS
'Canonical ELF code (ISO 20275).';

INSERT INTO lei_raw.gleif_entity_legal_form_codes (elf_code)
SELECT DISTINCT elf_code
FROM lei_raw.gleif_entity_legal_forms
WHERE elf_code IS NOT NULL AND BTRIM(elf_code) <> ''
ON CONFLICT (elf_code) DO NOTHING;

CREATE TRIGGER update_gleif_elf_codes_updated_at
    BEFORE UPDATE ON lei_raw.gleif_entity_legal_form_codes
    FOR EACH ROW
    EXECUTE FUNCTION UPDATE_UPDATED_AT_COLUMN();

CREATE OR REPLACE FUNCTION lei_raw.sync_gleif_elf_code_lookup()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.elf_code IS NOT NULL AND BTRIM(NEW.elf_code) <> '' THEN
            INSERT INTO lei_raw.gleif_entity_legal_form_codes (elf_code)
            VALUES (NEW.elf_code)
            ON CONFLICT (elf_code) DO NOTHING;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.elf_code IS NOT NULL AND BTRIM(NEW.elf_code) <> '' THEN
            INSERT INTO lei_raw.gleif_entity_legal_form_codes (elf_code)
            VALUES (NEW.elf_code)
            ON CONFLICT (elf_code) DO NOTHING;
        END IF;

        IF OLD.elf_code IS DISTINCT FROM NEW.elf_code
           AND OLD.elf_code IS NOT NULL
           AND BTRIM(OLD.elf_code) <> ''
           AND NOT EXISTS (
               SELECT 1
               FROM lei_raw.gleif_entity_legal_forms
               WHERE elf_code = OLD.elf_code
                 AND id <> OLD.id
           ) THEN
            DELETE FROM lei_raw.gleif_entity_legal_form_codes
            WHERE elf_code = OLD.elf_code;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.elf_code IS NOT NULL
           AND BTRIM(OLD.elf_code) <> ''
           AND NOT EXISTS (
               SELECT 1
               FROM lei_raw.gleif_entity_legal_forms
               WHERE elf_code = OLD.elf_code
                 AND id <> OLD.id
           ) THEN
            DELETE FROM lei_raw.gleif_entity_legal_form_codes
            WHERE elf_code = OLD.elf_code;
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_gleif_elf_code_lookup
ON lei_raw.gleif_entity_legal_forms;

CREATE TRIGGER trg_sync_gleif_elf_code_lookup
    AFTER INSERT OR UPDATE OR DELETE ON lei_raw.gleif_entity_legal_forms
    FOR EACH ROW
    EXECUTE FUNCTION lei_raw.sync_gleif_elf_code_lookup();

ALTER TABLE lei_raw.lei_records
    DROP CONSTRAINT IF EXISTS fk_lei_records_entity_legal_form;

ALTER TABLE lei_raw.lei_records
    ADD CONSTRAINT fk_lei_records_entity_legal_form
        FOREIGN KEY (entity_legal_form)
        REFERENCES lei_raw.gleif_entity_legal_form_codes (elf_code)
        NOT VALID;

ALTER TABLE lei_raw.lei_records
    VALIDATE CONSTRAINT fk_lei_records_entity_legal_form;

ALTER TABLE lei_raw.gleif_entity_legal_forms
    DROP CONSTRAINT IF EXISTS fk_gleif_elf_variants_parent_code;

ALTER TABLE lei_raw.gleif_entity_legal_forms
    ADD CONSTRAINT fk_gleif_elf_variants_parent_code
        FOREIGN KEY (elf_code)
        REFERENCES lei_raw.gleif_entity_legal_form_codes (elf_code)
        NOT VALID;

ALTER TABLE lei_raw.gleif_entity_legal_forms
    VALIDATE CONSTRAINT fk_gleif_elf_variants_parent_code;

-- Entity legal forms: add language and make context columns non-null for stable composite uniqueness.
ALTER TABLE lei_raw.gleif_entity_legal_forms
    ADD COLUMN IF NOT EXISTS language_code VARCHAR(10) NOT NULL DEFAULT '';

UPDATE lei_raw.gleif_entity_legal_forms
SET country_of_formation = COALESCE(country_of_formation, ''),
    country_subdivision_of_formation = COALESCE(country_subdivision_of_formation, ''),
    language_code = COALESCE(language_code, '');

ALTER TABLE lei_raw.gleif_entity_legal_forms
    ALTER COLUMN country_of_formation SET DEFAULT '',
    ALTER COLUMN country_of_formation SET NOT NULL,
    ALTER COLUMN country_subdivision_of_formation SET DEFAULT '',
    ALTER COLUMN country_subdivision_of_formation SET NOT NULL,
    ALTER COLUMN language_code SET DEFAULT '',
    ALTER COLUMN language_code SET NOT NULL;

ALTER TABLE lei_raw.gleif_entity_legal_forms
    DROP CONSTRAINT IF EXISTS gleif_entity_legal_forms_elf_code_key;

DROP INDEX IF EXISTS lei_raw.idx_gleif_elf_elf_code;

CREATE INDEX IF NOT EXISTS idx_gleif_elf_elf_code ON lei_raw.gleif_entity_legal_forms (elf_code);

CREATE UNIQUE INDEX IF NOT EXISTS ux_gleif_elf_variant
    ON lei_raw.gleif_entity_legal_forms
    (elf_code, language_code, country_of_formation, country_subdivision_of_formation, entity_legal_form_name, status);

-- Organizational roles: add context columns required to persist all variants.
ALTER TABLE lei_raw.gleif_organizational_roles
    ADD COLUMN IF NOT EXISTS language_code VARCHAR(10) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS elf_code VARCHAR(10) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS country_of_formation VARCHAR(2) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS country_subdivision_of_formation VARCHAR(10) NOT NULL DEFAULT '';

UPDATE lei_raw.gleif_organizational_roles
SET language_code = COALESCE(language_code, ''),
    elf_code = COALESCE(elf_code, ''),
    country_of_formation = COALESCE(country_of_formation, ''),
    country_subdivision_of_formation = COALESCE(country_subdivision_of_formation, '');

ALTER TABLE lei_raw.gleif_organizational_roles
    ALTER COLUMN language_code SET DEFAULT '',
    ALTER COLUMN language_code SET NOT NULL,
    ALTER COLUMN elf_code SET DEFAULT '',
    ALTER COLUMN elf_code SET NOT NULL,
    ALTER COLUMN country_of_formation SET DEFAULT '',
    ALTER COLUMN country_of_formation SET NOT NULL,
    ALTER COLUMN country_subdivision_of_formation SET DEFAULT '',
    ALTER COLUMN country_subdivision_of_formation SET NOT NULL;

ALTER TABLE lei_raw.gleif_organizational_roles
    DROP CONSTRAINT IF EXISTS gleif_organizational_roles_role_code_key;

DROP INDEX IF EXISTS lei_raw.idx_gleif_roles_role_code;

CREATE INDEX IF NOT EXISTS idx_gleif_roles_role_code ON lei_raw.gleif_organizational_roles (role_code);

CREATE UNIQUE INDEX IF NOT EXISTS ux_gleif_role_variant
    ON lei_raw.gleif_organizational_roles
    (role_code, language_code, country_of_formation, country_subdivision_of_formation, elf_code, role_name);
