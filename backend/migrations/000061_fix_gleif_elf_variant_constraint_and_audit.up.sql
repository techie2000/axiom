-- Fix ELF variant uniqueness to represent current state per variant key.
-- Also add audit history table for ELF lifecycle transitions.

CREATE TABLE IF NOT EXISTS lei_raw.gleif_entity_legal_forms_audit (
    id UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
    elf_variant_id UUID,
    elf_code VARCHAR(10) NOT NULL,
    action VARCHAR(20) NOT NULL,
    record_snapshot JSONB NOT NULL,
    changed_fields JSONB,
    changed_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_gleif_entity_legal_forms_audit PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_gleif_elf_audit_elf_code
    ON lei_raw.gleif_entity_legal_forms_audit (elf_code);

CREATE INDEX IF NOT EXISTS idx_gleif_elf_audit_created_at
    ON lei_raw.gleif_entity_legal_forms_audit (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gleif_elf_audit_elf_variant_id
    ON lei_raw.gleif_entity_legal_forms_audit (elf_variant_id);

CREATE INDEX IF NOT EXISTS idx_gleif_elf_audit_action
    ON lei_raw.gleif_entity_legal_forms_audit (action);

CREATE INDEX IF NOT EXISTS idx_gleif_elf_audit_variant_action_created_at
    ON lei_raw.gleif_entity_legal_forms_audit (elf_variant_id, action, created_at DESC);

COMMENT ON TABLE lei_raw.gleif_entity_legal_forms_audit IS
'Full audit history for lei_raw.gleif_entity_legal_forms lifecycle changes. Records CREATE/UPDATE transitions with JSONB snapshot and changed-fields diff.';

COMMENT ON COLUMN lei_raw.gleif_entity_legal_forms_audit.elf_variant_id IS
'UUID of the existing gleif_entity_legal_forms row when available. Null for brand new variants before insert.';

-- Remove duplicate rows created by status-in-key uniqueness.
-- Keep one row per variant key, preferring ACTIVE then most recently updated row.
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY
                elf_code,
                language_code,
                country_subdivision_of_formation
            ORDER BY
                CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END,
                updated_at DESC,
                created_at DESC,
                id DESC
        ) AS rn
    FROM lei_raw.gleif_entity_legal_forms
)
DELETE FROM lei_raw.gleif_entity_legal_forms t
USING ranked r
WHERE t.id = r.id
  AND r.rn > 1;

DROP INDEX IF EXISTS lei_raw.ux_gleif_elf_variant;

CREATE UNIQUE INDEX IF NOT EXISTS ux_gleif_elf_variant
    ON lei_raw.gleif_entity_legal_forms
    (elf_code, language_code, country_subdivision_of_formation);
