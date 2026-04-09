-- Update column comments to align with GLEIF spec terminology.
--
-- Key corrections:
--   1. LEI registration is with the managing LOU, not directly with GLEIF.
--      "with GLEIF" / "in GLEIF system" replaced with "with/by the managing LOU".
--   2. The Registration section in both LEI-CDF v3.1 and RR-CDF v2.1 explicitly states:
--      "The Registration data is maintained by the LOU."
--   3. Level 2 (RR-CDF) InitialRegistrationDate tracks when the *relationship information*
--      was registered — a distinct event from the LEI's own initial registration.
--   4. Enum value lists updated to match published spec (RR-CDF v2.0/v2.1 additions).

-- ============================================================================
-- lei_raw.lei_records — Registration section (LEI-CDF v3.1)
-- ============================================================================

COMMENT ON COLUMN lei_raw.lei_records.initial_registration_date IS
'Date when the LEI was first assigned and published by the managing LOU
(Registration.InitialRegistrationDate in LEI-CDF v3.1). Corresponds to the date of
first publication of the identifier and its supporting data record. Distinct from the
entity creation date (EntityCreationDate).';

COMMENT ON COLUMN lei_raw.lei_records.last_update_date IS
'Date when the LEI record was last updated by the managing LOU
(Registration.LastUpdateDate in LEI-CDF v3.1). Used for delta sync processing.';

-- ============================================================================
-- lei_raw.lei_relationship_records — Registration & Relationship sections (RR-CDF v2.1)
-- ============================================================================

COMMENT ON COLUMN lei_raw.lei_relationship_records.relationship_type IS
'GLEIF relationship type code (Relationship.RelationshipType in RR-CDF v2.1).
Accounting consolidation: IS_DIRECTLY_CONSOLIDATED_BY, IS_ULTIMATELY_CONSOLIDATED_BY.
Fund relationships (added v2.0): IS_FUND-MANAGED_BY, IS_SUBFUND_OF, IS_FEEDER_TO.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.relationship_status IS
'Lifecycle status of the relationship (Relationship.RelationshipStatus in RR-CDF v2.1).
Values: ACTIVE, INACTIVE, NULL. "NULL" is the RR-CDF v2.0 enum string literal stored as
the text ''NULL'' in this NOT NULL VARCHAR(50) column — it is not SQL NULL.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.registration_status IS
'Registration status of this relationship record (Registration.RegistrationStatus in RR-CDF v2.1).
Values: PENDING_VALIDATION, PUBLISHED, DUPLICATE, LAPSED, MERGED, RETIRED, ANNULLED,
CANCELLED, TRANSFERRED, PENDING_ARCHIVAL, PENDING_TRANSFER.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.initial_registration_date IS
'Timestamp when this relationship information was first registered with the managing LOU
(Registration.InitialRegistrationDate in RR-CDF v2.1). This is a distinct event from the
LEI''s own initial registration date in lei_records: it records when the parent-child or
fund ownership relationship was first filed, not when the entity''s LEI was issued.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.last_update_date IS
'Timestamp of the most recent update to this relationship record by the managing LOU
(Registration.LastUpdateDate in RR-CDF v2.1).';

COMMENT ON COLUMN lei_raw.lei_relationship_records.next_renewal_date IS
'Timestamp by which this relationship information must be renewed with the managing LOU
(Registration.NextRenewalDate in RR-CDF v2.1).';

COMMENT ON COLUMN lei_raw.lei_relationship_records.validation_sources IS
'Corroboration level of this relationship record (Registration.ValidationSources in RR-CDF v2.1).
Values: FULLY_CORROBORATED, PARTIALLY_CORROBORATED, PENDING, ENTITY_SUPPLIED_ONLY.';

COMMENT ON COLUMN lei_raw.lei_relationship_records.validation_documents IS
'Type of documentation used to validate this relationship (Registration.ValidationDocuments in RR-CDF v2.1).
Values: ACCOUNTS_FILING, REGULATORY_FILING, SUPPORTING_DOCUMENTS, CONTRACTS, OTHER_OFFICIAL_DOCUMENTS.';
