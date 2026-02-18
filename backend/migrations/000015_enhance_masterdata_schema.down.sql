-- Drop languages table
DROP TABLE IF EXISTS languages;

-- Drop continents table
DROP TABLE IF EXISTS continents;

-- Remove extended fields from currencies_audit
ALTER TABLE currencies_audit
    DROP COLUMN IF EXISTS name_plural,
    DROP COLUMN IF EXISTS rounding,
    DROP COLUMN IF EXISTS decimal_digits,
    DROP COLUMN IF EXISTS symbol_native;

-- Remove extended fields from countries_audit
ALTER TABLE countries_audit
    DROP COLUMN IF EXISTS languages_list,
    DROP COLUMN IF EXISTS currency_codes,
    DROP COLUMN IF EXISTS capital,
    DROP COLUMN IF EXISTS continent,
    DROP COLUMN IF EXISTS phone_codes,
    DROP COLUMN IF EXISTS native_name;

-- Remove extended fields from currencies table
ALTER TABLE currencies
    DROP COLUMN IF EXISTS name_plural,
    DROP COLUMN IF EXISTS rounding,
    DROP COLUMN IF EXISTS decimal_digits,
    DROP COLUMN IF EXISTS symbol_native;

-- Remove indexes from countries table
DROP INDEX IF EXISTS idx_countries_languages;
DROP INDEX IF EXISTS idx_countries_currency_codes;
DROP INDEX IF EXISTS idx_countries_continent;

-- Remove extended fields from countries table
ALTER TABLE countries
    DROP COLUMN IF EXISTS languages,
    DROP COLUMN IF EXISTS currency_codes,
    DROP COLUMN IF EXISTS capital,
    DROP COLUMN IF EXISTS continent,
    DROP COLUMN IF EXISTS phone_codes,
    DROP COLUMN IF EXISTS native_name;
