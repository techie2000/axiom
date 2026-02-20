-- Add extended fields to countries table for comprehensive master data
ALTER TABLE countries
ADD COLUMN IF NOT EXISTS native_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone_codes JSONB,  -- Array of phone codes [1, 44, etc.]
ADD COLUMN IF NOT EXISTS continent VARCHAR(2),  -- AF, AN, AS, EU, NA, OC, SA
ADD COLUMN IF NOT EXISTS capital VARCHAR(255),
ADD COLUMN IF NOT EXISTS currency_codes JSONB,  -- Array of currency codes ["USD", "EUR"]
ADD COLUMN IF NOT EXISTS languages JSONB;  -- Array of language codes ["en", "es"]

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_countries_continent ON countries (continent);
CREATE INDEX IF NOT EXISTS idx_countries_currency_codes ON countries USING gin (currency_codes);
CREATE INDEX IF NOT EXISTS idx_countries_languages ON countries USING gin (languages);

-- Add comments for documentation
COMMENT ON COLUMN countries.native_name IS 'Country name in native language/script';
COMMENT ON COLUMN countries.phone_codes IS 'International dialing codes as JSON array (e.g., [1], [44])';
COMMENT ON COLUMN countries.continent IS 'Continent code: AF (Africa), AN (Antarctica), AS (Asia), EU (Europe), NA (North America), OC (Oceania), SA (South America)';
COMMENT ON COLUMN countries.capital IS 'Capital city name';
COMMENT ON COLUMN countries.currency_codes IS 'ISO 4217 currency codes used in this country as JSON array (e.g., ["USD"], ["EUR"])';
COMMENT ON COLUMN countries.languages IS 'ISO 639-1 language codes spoken in this country as JSON array (e.g., ["en"], ["en", "es"])';

-- Add extended fields to currencies table
ALTER TABLE currencies
ADD COLUMN IF NOT EXISTS symbol_native VARCHAR(10),
ADD COLUMN IF NOT EXISTS decimal_digits INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS rounding INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS name_plural VARCHAR(255);

-- Rename decimal_places to decimal_digits for consistency (if needed)
-- Note: decimal_places already exists, so we'll use decimal_digits as an alias
-- If decimal_digits doesn't exist, it will be created by the ADD COLUMN above

-- Add comments for documentation
COMMENT ON COLUMN currencies.symbol_native IS 'Currency symbol in native format (e.g., $ for USD, ₹ for INR)';
COMMENT ON COLUMN currencies.decimal_digits IS 'Number of decimal places for this currency (0-3)';
COMMENT ON COLUMN currencies.rounding IS 'Rounding increment (0 for standard rounding)';
COMMENT ON COLUMN currencies.name_plural IS 'Plural form of currency name (e.g., "US dollars", "euros")';

-- Create continents reference table
CREATE TABLE IF NOT EXISTS continents (
    code VARCHAR(2) PRIMARY KEY,  -- AF, AN, AS, EU, NA, OC, SA
    continent_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE continents IS 'Continent reference data';
COMMENT ON COLUMN continents.code IS 'Two-letter continent code (AF, AN, AS, EU, NA, OC, SA)';
COMMENT ON COLUMN continents.continent_name IS 'Full continent name';

-- Create languages reference table
CREATE TABLE IF NOT EXISTS languages (
    code VARCHAR(2) PRIMARY KEY,  -- ISO 639-1 two-letter code
    language_name VARCHAR(100) NOT NULL,
    native_name VARCHAR(100) NOT NULL,
    rtl BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_languages_language_name ON languages (language_name);

COMMENT ON TABLE languages IS 'Language reference data following ISO 639-1 standard';
COMMENT ON COLUMN languages.code IS 'ISO 639-1 two-letter language code';
COMMENT ON COLUMN languages.language_name IS 'Language name in English';
COMMENT ON COLUMN languages.native_name IS 'Language name in native script';
COMMENT ON COLUMN languages.rtl IS 'Right-to-left writing system flag (true for Arabic, Hebrew, etc.)';

-- Add foreign key constraint for continent (optional, for data integrity)
-- Note: We'll keep it optional to allow flexibility
-- ALTER TABLE countries ADD CONSTRAINT fk_countries_continent 
--     FOREIGN KEY (continent) REFERENCES continents(code);

-- Update countries_audit table to include new fields
ALTER TABLE countries_audit
ADD COLUMN IF NOT EXISTS native_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone_codes VARCHAR(100),
ADD COLUMN IF NOT EXISTS continent VARCHAR(2),
ADD COLUMN IF NOT EXISTS capital VARCHAR(255),
ADD COLUMN IF NOT EXISTS currency_codes VARCHAR(100),
ADD COLUMN IF NOT EXISTS languages_list VARCHAR(255);

COMMENT ON TABLE countries_audit IS 'Complete audit history of country record changes';

-- Update currencies_audit table to include new fields
ALTER TABLE currencies_audit
ADD COLUMN IF NOT EXISTS symbol_native VARCHAR(10),
ADD COLUMN IF NOT EXISTS decimal_digits INTEGER,
ADD COLUMN IF NOT EXISTS rounding INTEGER,
ADD COLUMN IF NOT EXISTS name_plural VARCHAR(255);

COMMENT ON TABLE currencies_audit IS 'Complete audit history of currency record changes';
