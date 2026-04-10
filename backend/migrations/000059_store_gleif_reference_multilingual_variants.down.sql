-- Revert multilingual/context variant storage for GLEIF reference tables.

DROP INDEX IF EXISTS lei_raw.ux_gleif_elf_variant;
DROP INDEX IF EXISTS lei_raw.ux_gleif_role_variant;

ALTER TABLE lei_raw.gleif_entity_legal_forms
    DROP CONSTRAINT IF EXISTS gleif_entity_legal_forms_elf_code_key;

ALTER TABLE lei_raw.gleif_entity_legal_forms
    ADD CONSTRAINT gleif_entity_legal_forms_elf_code_key UNIQUE (elf_code);

ALTER TABLE lei_raw.gleif_organizational_roles
    DROP CONSTRAINT IF EXISTS gleif_organizational_roles_role_code_key;

ALTER TABLE lei_raw.gleif_organizational_roles
    ADD CONSTRAINT gleif_organizational_roles_role_code_key UNIQUE (role_code);

ALTER TABLE lei_raw.gleif_entity_legal_forms
    ALTER COLUMN country_of_formation DROP NOT NULL,
    ALTER COLUMN country_of_formation DROP DEFAULT,
    ALTER COLUMN country_subdivision_of_formation DROP NOT NULL,
    ALTER COLUMN country_subdivision_of_formation DROP DEFAULT;

ALTER TABLE lei_raw.gleif_entity_legal_forms
    DROP COLUMN IF EXISTS language_code;

ALTER TABLE lei_raw.gleif_organizational_roles
    DROP COLUMN IF EXISTS language_code,
    DROP COLUMN IF EXISTS elf_code,
    DROP COLUMN IF EXISTS country_of_formation,
    DROP COLUMN IF EXISTS country_subdivision_of_formation;
