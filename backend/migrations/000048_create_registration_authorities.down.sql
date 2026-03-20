-- Rollback: Drop registration_authorities tables
DROP TABLE IF EXISTS lei_raw.registration_authorities_audit;
DROP TABLE IF EXISTS lei_raw.registration_authorities;
