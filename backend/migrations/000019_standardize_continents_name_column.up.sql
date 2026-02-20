-- Standardize continents table naming to align with other master data tables
-- Rename legacy continent_name column to name when present

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'continents'
          AND column_name = 'continent_name'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'continents'
          AND column_name = 'name'
    ) THEN
        ALTER TABLE continents RENAME COLUMN continent_name TO name;
    END IF;
END $$;

COMMENT ON COLUMN continents.name IS 'Full continent name';
