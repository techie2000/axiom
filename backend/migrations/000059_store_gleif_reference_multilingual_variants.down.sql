-- Revert multilingual/context variant storage for GLEIF reference tables.

DROP INDEX IF EXISTS lei_raw.ux_gleif_elf_variant;
DROP INDEX IF EXISTS lei_raw.ux_gleif_role_variant;

ALTER TABLE lei_raw.lei_records
        DROP CONSTRAINT IF EXISTS fk_lei_records_entity_legal_form;

-- Down migration must collapse multilingual variants back to one row per code
-- before restoring UNIQUE (elf_code).
WITH keep AS (
        SELECT DISTINCT ON (elf_code) id
        FROM lei_raw.gleif_entity_legal_forms
        WHERE elf_code IS NOT NULL AND BTRIM(elf_code) <> ''
        ORDER BY elf_code,
                         CASE WHEN COALESCE(language_code, '') = 'en' THEN 0 ELSE 1 END,
                         updated_at DESC,
                         created_at DESC
)
DELETE FROM lei_raw.gleif_entity_legal_forms t
WHERE t.elf_code IS NOT NULL
    AND BTRIM(t.elf_code) <> ''
    AND NOT EXISTS (SELECT 1 FROM keep k WHERE k.id = t.id);

DROP TRIGGER IF EXISTS trg_sync_gleif_elf_code_lookup
ON lei_raw.gleif_entity_legal_forms;

ALTER TABLE lei_raw.gleif_entity_legal_forms
    DROP CONSTRAINT IF EXISTS fk_gleif_elf_variants_parent_code;

DROP FUNCTION IF EXISTS lei_raw.sync_gleif_elf_code_lookup();

DROP TRIGGER IF EXISTS update_gleif_elf_codes_updated_at
ON lei_raw.gleif_entity_legal_form_codes;

DROP TABLE IF EXISTS lei_raw.gleif_entity_legal_form_codes;

ALTER TABLE lei_raw.gleif_entity_legal_forms
    DROP CONSTRAINT IF EXISTS gleif_entity_legal_forms_elf_code_key;

ALTER TABLE lei_raw.gleif_entity_legal_forms
    ADD CONSTRAINT gleif_entity_legal_forms_elf_code_key UNIQUE (elf_code);

ALTER TABLE lei_raw.lei_records
    ADD CONSTRAINT fk_lei_records_entity_legal_form
        FOREIGN KEY (entity_legal_form)
        REFERENCES lei_raw.gleif_entity_legal_forms (elf_code)
        NOT VALID;

ALTER TABLE lei_raw.lei_records
    VALIDATE CONSTRAINT fk_lei_records_entity_legal_form;

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
