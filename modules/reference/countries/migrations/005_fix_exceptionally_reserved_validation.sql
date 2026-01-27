-- Migration 005: Fix exceptionally_reserved validation rules
-- exceptionally_reserved does NOT require name_english (only alpha2 and remarks)
-- indeterminately_reserved DOES require name_english (alpha2, name_english, remarks)

-- Drop the old combined constraint
ALTER TABLE reference.countries
DROP CONSTRAINT IF EXISTS chk_reserved_fields;

-- Add separate constraints for each reserved status type
ALTER TABLE reference.countries
ADD CONSTRAINT chk_exceptionally_reserved_fields CHECK (
    status <> 'exceptionally_reserved'::reference.country_code_status 
    OR (alpha2 IS NOT NULL AND remarks IS NOT NULL)
);

ALTER TABLE reference.countries
ADD CONSTRAINT chk_indeterminately_reserved_fields CHECK (
    status <> 'indeterminately_reserved'::reference.country_code_status 
    OR (alpha2 IS NOT NULL AND name_english IS NOT NULL AND remarks IS NOT NULL)
);
