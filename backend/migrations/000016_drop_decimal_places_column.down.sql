-- Restore the decimal_places column for rollback
ALTER TABLE currencies ADD COLUMN IF NOT EXISTS decimal_places INTEGER DEFAULT 2;

-- Copy data from decimal_digits to decimal_places
UPDATE currencies
SET decimal_places = decimal_digits
WHERE decimal_digits IS NOT NULL;

-- Restore the original comment
COMMENT ON COLUMN currencies.decimal_places IS 'Number of decimal places for this currency (2 for USD/EUR, 0 for JPY, 3 for BHD)';
