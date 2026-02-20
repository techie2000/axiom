-- Add comprehensive documentation comments to all tables and columns
-- This makes the database self-documenting and improves developer experience

-- ============================================================================
-- PUBLIC SCHEMA TABLES
-- ============================================================================

-- countries table
COMMENT ON TABLE countries IS
'ISO 3166 country reference data. Contains standardized country codes, names, and regional groupings for address validation and localization.';

COMMENT ON COLUMN countries.id IS 'Unique identifier (UUID v4)';
COMMENT ON COLUMN countries.code IS 'ISO 3166-1 alpha-2 country code (2 letters). Primary identifier for countries (US, GB, JP, etc.)';
COMMENT ON COLUMN countries."name" IS 'Official country name in English';
COMMENT ON COLUMN countries.alpha3_code IS 'ISO 3166-1 alpha-3 country code (3 letters). Alternative identifier (USA, GBR, JPN, etc.)';
COMMENT ON COLUMN countries.region IS 'Geographic region or continent (Europe, Asia, Americas, etc.)';
COMMENT ON COLUMN countries.active IS 'Whether this country is currently active for use. FALSE for deprecated entries.';
COMMENT ON COLUMN countries.created_at IS 'Timestamp when record was first created';
COMMENT ON COLUMN countries.updated_at IS 'Timestamp when record was last modified (auto-updated by trigger)';
COMMENT ON COLUMN countries.deleted_at IS 'Soft delete timestamp. NULL means not deleted.';

-- currencies table
COMMENT ON TABLE currencies IS
'ISO 4217 currency reference data. Contains standardized currency codes, symbols, and decimal precision for financial calculations.';

COMMENT ON COLUMN currencies.id IS 'Unique identifier (UUID v4)';
COMMENT ON COLUMN currencies.code IS 'ISO 4217 currency code (3 letters). Primary identifier (USD, EUR, GBP, JPY, etc.)';
COMMENT ON COLUMN currencies."name" IS 'Official currency name in English';
COMMENT ON COLUMN currencies.symbol IS 'Currency symbol for display ($, €, £, ¥, etc.)';
COMMENT ON COLUMN currencies.decimal_places IS 'Number of decimal places for this currency (2 for USD/EUR, 0 for JPY, 3 for BHD)';
COMMENT ON COLUMN currencies.active IS 'Whether this currency is currently active. FALSE for discontinued currencies.';
COMMENT ON COLUMN currencies.created_at IS 'Timestamp when record was first created';
COMMENT ON COLUMN currencies.updated_at IS 'Timestamp when record was last modified (auto-updated by trigger)';
COMMENT ON COLUMN currencies.deleted_at IS 'Soft delete timestamp. NULL means not deleted.';

-- addresses table
COMMENT ON TABLE addresses IS
'ISO 20022 compliant address storage. Supports both structured fields (street, city, postal code) and unstructured lines. Used by entities, accounts, and SSI records.';

COMMENT ON COLUMN addresses.id IS 'Unique identifier (UUID v4)';
COMMENT ON COLUMN addresses.address_type IS 'ISO 20022 address type: ADDR (postal), PBOX (PO box), HOME, BIZZ (business), etc.';
COMMENT ON COLUMN addresses.department IS 'Department name within organization (max 70 chars per ISO 20022)';
COMMENT ON COLUMN addresses.sub_department IS 'Sub-department name (max 70 chars per ISO 20022)';
COMMENT ON COLUMN addresses.street_name IS 'Street name without number (max 70 chars per ISO 20022)';
COMMENT ON COLUMN addresses.building_number IS 'Building or house number (max 16 chars per ISO 20022)';
COMMENT ON COLUMN addresses.building_name IS 'Building name (max 35 chars per ISO 20022)';
COMMENT ON COLUMN addresses.floor IS 'Floor identifier (max 70 chars per ISO 20022)';
COMMENT ON COLUMN addresses.post_box IS 'Post office box number (max 16 chars per ISO 20022)';
COMMENT ON COLUMN addresses.room IS 'Room or suite number (max 70 chars per ISO 20022)';
COMMENT ON COLUMN addresses.postal_code IS 'Postal code or ZIP code (max 16 chars per ISO 20022)';
COMMENT ON COLUMN addresses.town_name IS 'City or town name (max 35 chars per ISO 20022)';
COMMENT ON COLUMN addresses.town_location_name IS 'Town location name for disambiguation (max 35 chars per ISO 20022)';
COMMENT ON COLUMN addresses.district_name IS 'District within city (max 35 chars per ISO 20022)';
COMMENT ON COLUMN addresses.country_sub_division IS 'State, province, or region (max 35 chars per ISO 20022)';
COMMENT ON COLUMN addresses.country_id IS 'Foreign key to countries table. ISO 3166 country reference.';
COMMENT ON COLUMN addresses.address_line_1 IS 'Unstructured address line 1 (max 70 chars per ISO 20022). Use when structured fields are not available.';
COMMENT ON COLUMN addresses.address_line_2 IS 'Unstructured address line 2 (max 70 chars per ISO 20022)';
COMMENT ON COLUMN addresses.address_line_3 IS 'Unstructured address line 3 (max 70 chars per ISO 20022)';
COMMENT ON COLUMN addresses.address_line_4 IS 'Unstructured address line 4 (max 70 chars per ISO 20022)';
COMMENT ON COLUMN addresses.address_line_5 IS 'Unstructured address line 5 (max 70 chars per ISO 20022)';
COMMENT ON COLUMN addresses.address_line_6 IS 'Unstructured address line 6 (max 70 chars per ISO 20022)';
COMMENT ON COLUMN addresses.address_line_7 IS 'Unstructured address line 7 (max 70 chars per ISO 20022)';
COMMENT ON COLUMN addresses.created_at IS 'Timestamp when record was first created';
COMMENT ON COLUMN addresses.updated_at IS 'Timestamp when record was last modified (auto-updated by trigger)';
COMMENT ON COLUMN addresses.deleted_at IS 'Soft delete timestamp. NULL means not deleted.';

-- entities table
COMMENT ON TABLE entities IS
'Legal entities (companies, organizations, counterparties). Core master data for business relationships and settlements.';

COMMENT ON COLUMN entities.id IS 'Unique identifier (UUID v4)';
COMMENT ON COLUMN entities."name" IS 'Legal entity name (max 255 chars)';
COMMENT ON COLUMN entities.registration_number IS 'Government registration or tax ID number. Must be unique. Optional for non-registered entities.';
COMMENT ON COLUMN entities."type" IS 'Entity type classification. Examples: CORPORATION, PARTNERSHIP, SOLE_PROPRIETOR, GOVERNMENT, etc.';
COMMENT ON COLUMN entities.active IS 'Whether entity is currently active for business operations. FALSE for closed/inactive entities.';
COMMENT ON COLUMN entities.created_at IS 'Timestamp when record was first created';
COMMENT ON COLUMN entities.updated_at IS 'Timestamp when record was last modified (auto-updated by trigger)';
COMMENT ON COLUMN entities.deleted_at IS 'Soft delete timestamp. NULL means not deleted.';

-- entity_addresses junction table
COMMENT ON TABLE entity_addresses IS
'Many-to-many relationship between entities and addresses. Allows entities to have multiple addresses (registered, trading, billing, etc.).';

COMMENT ON COLUMN entity_addresses.id IS 'Unique identifier (UUID v4)';
COMMENT ON COLUMN entity_addresses.entity_id IS 'Foreign key to entities table. CASCADE delete.';
COMMENT ON COLUMN entity_addresses.address_id IS 'Foreign key to addresses table. CASCADE delete.';
COMMENT ON COLUMN entity_addresses.address_type IS 'Purpose of this address: REGISTERED (legal), TRADING (operations), BILLING, CORRESPONDENCE, etc.';
COMMENT ON COLUMN entity_addresses.is_primary IS 'TRUE if this is the primary address of this type for the entity. Only one primary per type.';
COMMENT ON COLUMN entity_addresses.created_at IS 'Timestamp when record was first created';
COMMENT ON COLUMN entity_addresses.updated_at IS 'Timestamp when record was last modified (auto-updated by trigger)';
COMMENT ON COLUMN entity_addresses.deleted_at IS 'Soft delete timestamp. NULL means not deleted.';

-- ============================================================================
-- LEI_RAW SCHEMA TABLES (GLEIF Legal Entity Identifier Data)
-- ============================================================================

COMMENT ON SCHEMA lei_raw IS
'Raw LEI (Legal Entity Identifier) data from GLEIF. Separate schema for external reference data distinct from internal master data. Contains 3.2M+ global legal entities.';

-- source_files table
COMMENT ON TABLE lei_raw.source_files IS
'Metadata and processing status for LEI data files downloaded from GLEIF. Tracks full snapshots and delta updates, download progress, and processing state. Each file contains JSON records of LEI entities.';

COMMENT ON COLUMN lei_raw.source_files.id IS 'Unique identifier (UUID v4)';
COMMENT ON COLUMN lei_raw.source_files.file_name IS 'Original filename from GLEIF (e.g., lei-FULL-20260212-112831.json.zip). Max 500 chars.';
COMMENT ON COLUMN lei_raw.source_files.file_type IS 'File type: FULL (complete snapshot of all LEI records) or DELTA (last week changes only)';
COMMENT ON COLUMN lei_raw.source_files.file_url IS 'Source URL from GLEIF API. Max 1000 chars.';
COMMENT ON COLUMN lei_raw.source_files.file_size IS 'File size in bytes. FULL files are ~1GB, DELTA files are ~15MB.';
COMMENT ON COLUMN lei_raw.source_files.file_hash IS 'SHA-256 hash for integrity verification (64 hex characters)';
COMMENT ON COLUMN lei_raw.source_files.downloaded_at IS 'Timestamp when file download completed successfully';
COMMENT ON COLUMN lei_raw.source_files.publication_date IS 'GLEIF publication date from API metadata';
COMMENT ON COLUMN lei_raw.source_files.processing_status IS 'File processing lifecycle: PENDING (queued), IN_PROGRESS (actively processing), COMPLETED (success), FAILED (error occurred)';
COMMENT ON COLUMN lei_raw.source_files.total_records IS 'Total number of LEI records in file (from GLEIF API). FULL files have 3.2M+, DELTA files have ~60K.';
COMMENT ON COLUMN lei_raw.source_files.processed_records IS 'Number of records successfully processed and inserted/updated into lei_records table';
COMMENT ON COLUMN lei_raw.source_files.failed_records IS 'Number of records that failed to process due to validation or database errors';
COMMENT ON COLUMN lei_raw.source_files.last_processed_lei IS '20-character LEI code of last successfully processed record. Used to resume processing after interruption.';
COMMENT ON COLUMN lei_raw.source_files.processing_started_at IS 'Timestamp when processing began';
COMMENT ON COLUMN lei_raw.source_files.processing_completed_at IS 'Timestamp when processing finished (success or failure)';
COMMENT ON COLUMN lei_raw.source_files.processing_error IS 'Error message if processing_status is FAILED. Contains technical details of first error encountered.';
COMMENT ON COLUMN lei_raw.source_files.failure_category IS 'Categorized failure reason (only set when processing_status=FAILED): SCHEMA_ERROR, NETWORK_ERROR, FILE_CORRUPTION, FILE_MISSING, TIMEOUT, or UNKNOWN. Empty string for non-failed records.';
COMMENT ON COLUMN lei_raw.source_files.retry_count IS 'Number of retry attempts for failed files (0-3). Incremented on FAILED status; reset to 0 on success.';
COMMENT ON COLUMN lei_raw.source_files.max_retries IS 'Maximum retry attempts before permanent failure (default 3). Configurable per file type.';
COMMENT ON COLUMN lei_raw.source_files.created_at IS 'Timestamp when record was first created (when file metadata was saved)';
COMMENT ON COLUMN lei_raw.source_files.updated_at IS 'Timestamp when record was last modified (auto-updated by trigger). Updated during processing progress.';
COMMENT ON COLUMN lei_raw.source_files.deleted_at IS 'Soft delete timestamp. NULL means not deleted. Used for archival cleanup.';

-- lei_records table
COMMENT ON TABLE lei_raw.lei_records IS
'Raw LEI (Legal Entity Identifier) data from GLEIF Golden Copy. Contains entity legal names, addresses, registration details, and validation status for all global legal entities (3.2M+ records). ISO 17442 standard.';

COMMENT ON COLUMN lei_raw.lei_records.id IS 'Unique identifier (UUID v4). Internal database ID.';
COMMENT ON COLUMN lei_raw.lei_records.lei IS '20-character Legal Entity Identifier (ISO 17442 standard). Format: 18 alphanumeric characters + 2-digit checksum. Globally unique. PRIMARY KEY for lookups.';
COMMENT ON COLUMN lei_raw.lei_records.legal_name IS 'Official registered legal name of entity as recorded with registration authority. Max 500 chars. Non-transliterated (original script).';
COMMENT ON COLUMN lei_raw.lei_records.transliterated_legal_name IS 'ASCII transliteration of legal name for non-Latin scripts (Cyrillic, Chinese, Arabic, etc.). Max 500 chars. NULL if original name is already Latin/ASCII.';
COMMENT ON COLUMN lei_raw.lei_records.other_names IS 'JSONB array of alternate entity names. Each object contains: {name: string, type: string, language: string}. Types: PREVIOUS_LEGAL_NAME, TRADING_NAME, AUTO_ASCII_TRANSLITERATED_LEGAL_NAME. Empty array [] if no alternates.';
COMMENT ON COLUMN lei_raw.lei_records.legal_address_line_1 IS 'Legal registered address line 1. Max 500 chars. Primary street address.';
COMMENT ON COLUMN lei_raw.lei_records.legal_address_line_2 IS 'Legal registered address line 2. Max 500 chars. Additional address details (suite, building, etc.).';
COMMENT ON COLUMN lei_raw.lei_records.legal_address_line_3 IS 'Legal registered address line 3. Max 500 chars. Additional address details.';
COMMENT ON COLUMN lei_raw.lei_records.legal_address_line_4 IS 'Legal registered address line 4. Max 500 chars. Additional address details.';
COMMENT ON COLUMN lei_raw.lei_records.legal_address_city IS 'Legal registered address city/town. Max 100 chars.';
COMMENT ON COLUMN lei_raw.lei_records.legal_address_region IS 'Legal registered address region/state/province. Max 100 chars.';
COMMENT ON COLUMN lei_raw.lei_records.legal_address_country IS 'Legal registered address country. ISO 3166-1 alpha-2 code (2 letters: US, GB, JP, etc.).';
COMMENT ON COLUMN lei_raw.lei_records.legal_address_postal_code IS 'Legal registered address postal/ZIP code. Max 50 chars (accommodates long international codes).';
COMMENT ON COLUMN lei_raw.lei_records.hq_address_line_1 IS 'Headquarters/operations address line 1. Max 500 chars. May differ from legal registered address.';
COMMENT ON COLUMN lei_raw.lei_records.hq_address_line_2 IS 'Headquarters address line 2. Max 500 chars.';
COMMENT ON COLUMN lei_raw.lei_records.hq_address_line_3 IS 'Headquarters address line 3. Max 500 chars.';
COMMENT ON COLUMN lei_raw.lei_records.hq_address_line_4 IS 'Headquarters address line 4. Max 500 chars.';
COMMENT ON COLUMN lei_raw.lei_records.hq_address_city IS 'Headquarters address city/town. Max 100 chars.';
COMMENT ON COLUMN lei_raw.lei_records.hq_address_region IS 'Headquarters address region/state/province. Max 100 chars.';
COMMENT ON COLUMN lei_raw.lei_records.hq_address_country IS 'Headquarters address country. ISO 3166-1 alpha-2 code (2 letters).';
COMMENT ON COLUMN lei_raw.lei_records.hq_address_postal_code IS 'Headquarters address postal/ZIP code. Max 50 chars.';
COMMENT ON COLUMN lei_raw.lei_records.registration_authority IS 'Registration authority that issued entity registration. Max 100 chars. Example: RA000589 (Delaware Division of Corporations).';
COMMENT ON COLUMN lei_raw.lei_records.registration_authority_id IS 'Registration authority identifier code. Max 100 chars. Maps to GLEIF RA list.';
COMMENT ON COLUMN lei_raw.lei_records.registration_number IS 'Entity registration number issued by registration authority. Max 100 chars. Examples: company number, tax ID, etc.';
COMMENT ON COLUMN lei_raw.lei_records.entity_category IS 'GLEIF entity category. Max 50 chars. Primary classification: BRANCH, FUND, SOLE_PROPRIETOR, etc.';
COMMENT ON COLUMN lei_raw.lei_records.entity_sub_category IS 'GLEIF entity sub-category. Max 50 chars. More specific classification under category.';
COMMENT ON COLUMN lei_raw.lei_records.entity_legal_form IS 'Legal form code from registration authority. Max 100 chars. Examples: Corp, LLC, PLC, GmbH, etc.';
COMMENT ON COLUMN lei_raw.lei_records.entity_status IS 'Current status of legal entity. Max 50 chars. Values: ACTIVE (operating), INACTIVE (closed), MERGED, DISSOLVED, etc.';
COMMENT ON COLUMN lei_raw.lei_records.managing_lou IS 'LOU (Local Operating Unit) managing this LEI record. Max 100 chars. LOUs are regional GLEIF accredited registrars.';
COMMENT ON COLUMN lei_raw.lei_records.successor_lei IS 'LEI of successor entity if this entity merged. 20-character LEI code. NULL if no merger.';
COMMENT ON COLUMN lei_raw.lei_records.initial_registration_date IS 'Date when LEI was first registered with GLEIF';
COMMENT ON COLUMN lei_raw.lei_records.last_update_date IS 'Date when LEI record was last updated in GLEIF system. Used for delta processing.';
COMMENT ON COLUMN lei_raw.lei_records.next_renewal_date IS 'Date when LEI registration must be renewed. LEIs require annual renewal.';
COMMENT ON COLUMN lei_raw.lei_records.validation_sources IS 'JSONB array of validation sources. Contains references to documents/authorities used to validate entity information.';
COMMENT ON COLUMN lei_raw.lei_records.validation_authority IS 'Authority that validated entity information. Max 100 chars. Often same as registration authority.';
COMMENT ON COLUMN lei_raw.lei_records.source_file_id IS 'Foreign key to source_files table. Tracks which GLEIF file this record came from.';
COMMENT ON COLUMN lei_raw.lei_records.changed_fields IS 'JSONB object of last change details. Format: {"field_name": {"old": "old_value", "new": "new_value"}}. Used for audit trail.';
COMMENT ON COLUMN lei_raw.lei_records.created_by IS 'User/system that created record. Default: system. Max 100 chars.';
COMMENT ON COLUMN lei_raw.lei_records.updated_by IS 'User/system that last updated record. Default: system. Max 100 chars.';
COMMENT ON COLUMN lei_raw.lei_records.created_at IS 'Timestamp when record was first created (when first imported from GLEIF)';
COMMENT ON COLUMN lei_raw.lei_records.updated_at IS 'Timestamp when record was last modified (auto-updated by trigger). Changes on every update.';
COMMENT ON COLUMN lei_raw.lei_records.deleted_at IS 'Soft delete timestamp. NULL means not deleted. Used for archival cleanup.';

-- lei_records_audit table
COMMENT ON TABLE lei_raw.lei_records_audit IS
'Complete audit trail of all changes to LEI records. Stores full record snapshots for every CREATE, UPDATE, and DELETE operation. Enables historical analysis and change tracking.';

COMMENT ON COLUMN lei_raw.lei_records_audit.id IS 'Unique identifier (UUID v4) for this audit entry';
COMMENT ON COLUMN lei_raw.lei_records_audit.lei_record_id IS 'Foreign key to lei_records.id. Links to current record (not enforced as FK to allow orphan audits).';
COMMENT ON COLUMN lei_raw.lei_records_audit.lei IS '20-character LEI code. Denormalized for fast querying without joins.';
COMMENT ON COLUMN lei_raw.lei_records_audit."action" IS 'Type of change: CREATE (new record), UPDATE (modified), DELETE (removed). Max 20 chars.';
COMMENT ON COLUMN lei_raw.lei_records_audit.record_snapshot IS 'JSONB snapshot of complete record state at time of change. Contains all fields for point-in-time recovery.';
COMMENT ON COLUMN lei_raw.lei_records_audit.changed_fields IS 'JSONB object of changed fields only. Format: {"field": {"old": "prev_value", "new": "new_value"}}. NULL for CREATE actions.';
COMMENT ON COLUMN lei_raw.lei_records_audit.source_file_id IS 'Foreign key to source_files table. Identifies which GLEIF file triggered this change.';
COMMENT ON COLUMN lei_raw.lei_records_audit.changed_by IS 'User/system that made the change. Default: system. Max 100 chars.';
COMMENT ON COLUMN lei_raw.lei_records_audit.created_at IS 'Timestamp when audit entry was created (when change occurred). Immutable.';

-- file_processing_status table
COMMENT ON TABLE lei_raw.file_processing_status IS
'Singleton scheduler state for automated LEI sync jobs. Tracks last run times, next scheduled runs, and current job status. One record per job type (DAILY_FULL, DAILY_DELTA).';

COMMENT ON COLUMN lei_raw.file_processing_status.id IS 'Unique identifier (UUID v4)';
COMMENT ON COLUMN lei_raw.file_processing_status.job_type IS 'Type of sync job. Max 50 chars. Values: DAILY_FULL (complete snapshot, runs daily), DAILY_DELTA (incremental changes, runs daily after full), MANUAL (ad-hoc user-triggered).';
COMMENT ON COLUMN lei_raw.file_processing_status.status IS 'Current job status. Max 20 chars. Values: IDLE (waiting for next run), RUNNING (actively processing), COMPLETED (last run succeeded), FAILED (last run failed).';
COMMENT ON COLUMN lei_raw.file_processing_status.last_run_at IS 'Timestamp when job last started execution. NULL if never run.';
COMMENT ON COLUMN lei_raw.file_processing_status.next_run_at IS 'Timestamp when job is scheduled to run next. Used by scheduler to determine execution time.';
COMMENT ON COLUMN lei_raw.file_processing_status.last_success_at IS 'Timestamp of last successful job completion. Used for monitoring and SLA tracking.';
COMMENT ON COLUMN lei_raw.file_processing_status.current_source_file_id IS 'Foreign key to source_files table. Points to file currently being processed (if status=RUNNING). NULL when IDLE.';
COMMENT ON COLUMN lei_raw.file_processing_status.error_message IS 'Error message from last failed run. NULL if last run succeeded or never run.';
COMMENT ON COLUMN lei_raw.file_processing_status.created_at IS 'Timestamp when job was first registered in system';
COMMENT ON COLUMN lei_raw.file_processing_status.updated_at IS 'Timestamp when job status was last modified (auto-updated by trigger). Changes on every status update.';
