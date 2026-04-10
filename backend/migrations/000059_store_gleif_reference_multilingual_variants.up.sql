-- Persist all valid multilingual/context variants from GLEIF reference lists.
-- Previous schema enforced one row per code and collapsed valid rows.

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
