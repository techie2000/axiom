-- Migration: 017_add_currency_to_countries
-- Description: Restructure currency-country relationship
--   - Add currency_code to countries table (natural direction: countries use currencies)
--   - Remove alpha2 from currencies table (backwards relationship)
-- Date: 2026-01-28

-- Step 1: Drop foreign key constraint from currencies table
ALTER TABLE reference.currencies
DROP CONSTRAINT IF EXISTS fk_currencies_alpha2;

-- Step 2: Drop alpha2 column from currencies table
ALTER TABLE reference.currencies
DROP COLUMN IF EXISTS alpha2;

-- Step 3: Drop index on alpha2 (no longer exists)
DROP INDEX IF EXISTS reference.idx_currencies_alpha2;

-- Step 4: Add currency_code column to countries table (nullable - not all countries have currencies)
ALTER TABLE reference.countries
ADD COLUMN IF NOT EXISTS currency_code TEXT;

-- Step 5: Create foreign key constraint (countries → currencies)
ALTER TABLE reference.countries
ADD CONSTRAINT fk_countries_currency
    FOREIGN KEY (currency_code)
    REFERENCES reference.currencies(code)
    ON DELETE SET NULL;  -- If currency is deleted, set to NULL (preserve country record)

-- Step 6: Create index on currency_code for efficient lookups
CREATE INDEX IF NOT EXISTS idx_countries_currency
ON reference.countries(currency_code)
WHERE currency_code IS NOT NULL;

-- Step 7: Add check constraint to ensure currency_code format if present
ALTER TABLE reference.countries
ADD CONSTRAINT chk_currency_code_format
    CHECK (currency_code IS NULL OR currency_code ~ '^[A-Z]{3}$');

-- Step 8: Update countries_audit trigger to include currency_code
-- The trigger function automatically captures all columns, so no code change needed
-- But we should document that currency_code changes will be audited

COMMENT ON COLUMN reference.countries.currency_code IS 
'ISO 4217 three-letter currency code used by this country. NULL for countries without a currency (e.g., Antarctica). References reference.currencies(code).';

-- Migration notes:
-- 1. This is a structural change - no data migration needed yet (currency_code starts NULL)
-- 2. Future work: Populate currency_code by parsing ISO 4217 ENTITY field
-- 3. Historical currency changes will be tracked via countries_audit table
-- 4. Multiple countries can reference the same currency (e.g., EUR for Eurozone)
