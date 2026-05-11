-- Reverse: remove compliance attribute columns added in 000022
ALTER TABLE currencies_audit
DROP COLUMN IF EXISTS is_alert_cls_allowed,
DROP COLUMN IF EXISTS is_ofac_sanctioned;

ALTER TABLE currencies
DROP COLUMN IF EXISTS is_alert_cls_allowed,
DROP COLUMN IF EXISTS is_ofac_sanctioned;
