-- Rollback: remove Level 2 LEI tables

DROP TABLE IF EXISTS lei_raw.lei_reporting_exceptions;
DROP TABLE IF EXISTS lei_raw.lei_relationship_records;
