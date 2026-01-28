-- Migration 014: Add CHECK constraints to currencies table
-- Enforce business rules at database level to protect against direct database manipulation
--
-- These constraints mirror the validation rules in canonicalizer-rules.md:
-- 1. code must be 3 uppercase letters (ISO 4217 format)
-- 2. number must be 3 digits if present (ISO 4217 numeric code)
-- 3. status must be one of: 'active', 'historical', 'special'
-- 4. Active currencies MUST have minor_units defined (for transaction precision)
-- 5. Active currencies cannot have an end_date

-- Add CHECK constraint for currency code format (3 uppercase letters)
ALTER TABLE reference.currencies
ADD CONSTRAINT chk_code_format CHECK (code ~ '^[A-Z]{3}$');

-- Add CHECK constraint for numeric code format (3 digits if present)
ALTER TABLE reference.currencies
ADD CONSTRAINT chk_number_format CHECK (number IS NULL OR number ~ '^\d{3}$');

-- Add CHECK constraint for valid status values
ALTER TABLE reference.currencies
ADD CONSTRAINT chk_status_values CHECK (status IN ('active', 'historical', 'special'));

-- Add CHECK constraint: active currencies MUST have minor_units
-- This ensures transaction precision is always defined for active currencies
ALTER TABLE reference.currencies
ADD CONSTRAINT chk_active_has_minor_units CHECK (
    status != 'active' OR minor_units IS NOT NULL
);

-- Add CHECK constraint: active currencies cannot have end_date
-- If a currency is active, it should not have an end date
ALTER TABLE reference.currencies
ADD CONSTRAINT chk_active_no_end_date CHECK (
    status != 'active' OR end_date IS NULL
);

-- Verify constraints were added
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'reference.currencies'::regclass
  AND contype = 'c'  -- CHECK constraints only
ORDER BY conname;
