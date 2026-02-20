-- Revert standardized continents name column to legacy continent_name

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'continents'
          AND column_name = 'name'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'continents'
          AND column_name = 'continent_name'
    ) THEN
        ALTER TABLE continents RENAME COLUMN name TO continent_name;
    END IF;
END $$;

COMMENT ON COLUMN continents.continent_name IS 'Full continent name';
