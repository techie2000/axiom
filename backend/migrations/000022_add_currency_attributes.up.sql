-- Add compliance-related attributes to currencies table.
-- is_alert_cls_allowed: marks currencies permitted for ALERT CLS settlement method.
-- is_ofac_sanctioned:   marks currencies associated with OFAC-sanctioned countries.

ALTER TABLE currencies
ADD COLUMN IF NOT EXISTS is_alert_cls_allowed BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_ofac_sanctioned BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN currencies.is_alert_cls_allowed IS
'TRUE when this currency is permitted for the ALERT CLS settlement method. '
'Allowed codes: AUD, CAD, CHF, DKK, EUR, GBP, HKD, HUF, ILS, JPY, KRW, MXN, NOK, NZD, SEK, SGD, USD, ZAR.';

COMMENT ON COLUMN currencies.is_ofac_sanctioned IS
'TRUE when this currency is associated with an OFAC-sanctioned country. '
'Sanctioned codes: CUP (Cuba), CUC (Cuba), IRR (Iran), KPW (North Korea), SYP (Syria).';

-- Pre-populate: ALERT CLS allowed currencies
UPDATE currencies
SET is_alert_cls_allowed = TRUE
WHERE code IN (
    'AUD', -- Australian Dollar  (Australia)
    'CAD', -- Canadian Dollar    (Canada)
    'CHF', -- Swiss Franc        (Switzerland)
    'DKK', -- Danish Krone       (Denmark)
    'EUR', -- Euro               (European Union)
    'GBP', -- Pound Sterling     (United Kingdom)
    'HKD', -- Hong Kong Dollar   (Hong Kong)
    'HUF', -- Hungarian Forint   (Hungary)
    'ILS', -- Israeli New Sheqel (Israel)
    'JPY', -- Japanese Yen       (Japan)
    'KRW', -- South Korean Won   (Korea, Republic of)
    'MXN', -- Mexican Peso       (Mexico)
    'NOK', -- Norwegian Krone    (Norway)
    'NZD', -- New Zealand Dollar (New Zealand)
    'SEK', -- Swedish Krona      (Sweden)
    'SGD', -- Singapore Dollar   (Singapore)
    'USD', -- United States Dollar (United States)
    'ZAR'  -- South African Rand (South Africa)
);

-- Pre-populate: OFAC-sanctioned currencies
UPDATE currencies
SET is_ofac_sanctioned = TRUE
WHERE code IN (
    'CUP', -- Cuban Peso          (Cuba,        CU)
    'CUC', -- Cuban Convertible Peso (Cuba,     CU)
    'IRR', -- Iranian Rial        (Iran,         IR)
    'KPW', -- North Korean Won    (North Korea,  KP)
    'SYP'  -- Syrian Pound        (Syria,        SY)
);

-- Mirror new columns in the audit table so snapshots remain complete
ALTER TABLE currencies_audit
ADD COLUMN IF NOT EXISTS is_alert_cls_allowed BOOLEAN,
ADD COLUMN IF NOT EXISTS is_ofac_sanctioned BOOLEAN;
