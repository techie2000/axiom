-- Migration 010: Allow duplicate numeric codes for transitionally_reserved countries
-- Rationale: ISO 3166-1 standard allows the same numeric code for both a current country
--            and its predecessor(s) when the old code(s) are transitionally_reserved.
--            Example: MM (Myanmar) and BU (Burma) both have numeric 104
--                    TL (Timor-Leste) and TP (East Timor) both have numeric 626
-- Impact: Removes UNIQUE constraint on numeric column, converts unique index to non-unique

\echo 'Removing UNIQUE constraint from numeric column to allow transitional codes'

-- Drop the unique constraint by dropping and recreating as non-unique index
DROP INDEX IF EXISTS reference.idx_countries_numeric_unique;
DROP INDEX IF EXISTS reference.idx_countries_numeric;

-- Recreate as non-unique index (still useful for lookups, just not enforcing uniqueness)
CREATE INDEX idx_countries_numeric ON reference.countries(numeric);

\echo 'Numeric column now allows duplicates for transitionally_reserved codes'
\echo 'Example: BU (Burma, numeric 104, transitionally_reserved) can coexist with MM (Myanmar, numeric 104, officially_assigned)'
