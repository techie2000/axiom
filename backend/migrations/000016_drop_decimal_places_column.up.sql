-- Drop the old decimal_places column since we now use decimal_digits
-- This is safe because the app is not yet in production

ALTER TABLE currencies DROP COLUMN IF EXISTS decimal_places;

-- Update comment to clarify the field we're using
COMMENT ON COLUMN currencies.decimal_digits IS 'Number of decimal places for this currency (0 for JPY, 2 for USD/EUR, 3 for BHD/KWD)';
