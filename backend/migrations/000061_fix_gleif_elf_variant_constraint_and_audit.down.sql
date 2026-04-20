-- Revert ELF current-state uniqueness and remove ELF audit table.

DROP TABLE IF EXISTS lei_raw.gleif_entity_legal_forms_audit;

DROP INDEX IF EXISTS lei_raw.ux_gleif_elf_variant;

CREATE UNIQUE INDEX IF NOT EXISTS ux_gleif_elf_variant
    ON lei_raw.gleif_entity_legal_forms
    (elf_code, language_code, country_of_formation, country_subdivision_of_formation, entity_legal_form_name, status);
