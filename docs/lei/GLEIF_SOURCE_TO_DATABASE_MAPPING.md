# GLEIF Source-to-Database Mapping

This document shows how each GLEIF feed that Axiom ingests is transformed into
database rows in the `lei_raw` schema.

It complements these existing docs:

- [LEI Acquisition](./LEI_ACQUISITION.md) for scheduler and operational flow
- [LEI Data Flow](./LEI_DATA_FLOW.md) for the high-level pipeline
- [GLEIF Reference Code Lists](./GLEIF_REFERENCE_CODE_LISTS.md) for reference-list
  lifecycle and UI enrichment

## Feeds Covered

| Feed | Source format | Primary target tables | Notes |
| --- | --- | --- | --- |
| Level 1 LEI CDF | JSON | `lei_raw.lei_records`, `lei_raw.lei_records_audit` | Main legal entity feed |
| Level 2 Relationship Records | JSON | `lei_raw.lei_relationship_records`, `lei_raw.lei_relationship_records_audit` | Ownership and consolidation links |
| Level 2 Reporting Exceptions | JSON | `lei_raw.lei_reporting_exceptions`, `lei_raw.lei_reporting_exceptions_audit` | Parent-reporting exceptions |
| Registration Authorities | CSV/TSV | `lei_raw.gleif_registration_authorities` | Resolves RA codes to names |
| Entity Legal Forms | CSV/TSV | `lei_raw.gleif_entity_legal_forms` | Resolves ELF codes to names |
| Organizational Roles | CSV/TSV | `lei_raw.gleif_organizational_roles` | Reference list for role codes |
| Legal Jurisdictions | CSV/TSV | `lei_raw.gleif_legal_jurisdictions` | Resolves legal jurisdiction codes |

## Shared Ingestion Pattern

All GLEIF feeds follow the same high-level pattern:

1. Download the current GLEIF payload.
2. Create or update a `lei_raw.source_files` row to track provenance and progress.
3. Parse the raw JSON or CSV row into a Go domain model.
4. Upsert the target table using a business natural key.
5. Write audit rows when a create or update is detected.
6. Update `lei_raw.file_processing_status` and `source_files` counters.

For Level 2 jobs, record-level failures are also written to
`lei_raw.lei_level2_processing_failures` and later marked resolved when a subsequent
upsert succeeds for the same natural key.

## Level 1 LEI CDF JSON to `lei_raw.lei_records`

### Example source payload

Issue #289 asked for a concrete example. The abbreviated payload below is the same
kind of Level 1 JSON object processed by `jsonToDomainRecord()` in
`backend/internal/service/lei_service.go`.

```json
{
  "LEI": { "$": "ZZZWS8Y6XVKM0Q9RJQ79" },
  "Entity": {
    "LegalName": { "$": "Delaware Ivy Value Fund" },
    "OtherEntityNames": {
      "OtherEntityName": [
        {
          "@xml:lang": "en",
          "@type": "PREVIOUS_LEGAL_NAME",
          "$": "IVY FUNDS - Delaware Ivy Value Fund"
        }
      ]
    },
    "LegalAddress": {
      "FirstAddressLine": { "$": "C/O THE CORPORATION TRUST COMPANY" },
      "AdditionalAddressLine": [{ "$": "1209 ORANGE ST" }],
      "City": { "$": "WILMINGTON" },
      "Region": { "$": "US-DE" },
      "Country": { "$": "US" },
      "PostalCode": { "$": "19801" }
    },
    "HeadquartersAddress": {
      "FirstAddressLine": { "$": "C/O Delaware Management Company, Inc." },
      "AdditionalAddressLine": [
        { "$": "CORPORATION SERVICE COMPANY" },
        { "$": "251 LITTLE FALLS DRIVE" }
      ],
      "City": { "$": "WILMINGTON" },
      "Region": { "$": "US-DE" },
      "Country": { "$": "US" },
      "PostalCode": { "$": "19808" }
    },
    "RegistrationAuthority": {
      "RegistrationAuthorityID": { "$": "RA000665" },
      "RegistrationAuthorityEntityID": { "$": "S000024832" }
    },
    "LegalJurisdiction": { "$": "US" },
    "EntityCategory": { "$": "FUND" },
    "LegalForm": {
      "EntityLegalFormCode": { "$": "8888" },
      "OtherLegalForm": { "$": "FUND" }
    },
    "EntityStatus": { "$": "INACTIVE" },
    "SuccessorEntity": [{ "SuccessorLEI": { "$": "549300VHTWY6NEMPX721" } }]
  },
  "Registration": {
    "InitialRegistrationDate": { "$": "2012-06-06T15:56:00.000Z" },
    "LastUpdateDate": { "$": "2024-10-31T17:51:29.927Z" },
    "RegistrationStatus": { "$": "RETIRED" },
    "NextRenewalDate": { "$": "2024-09-12T20:51:51.032Z" },
    "ManagingLOU": { "$": "5493001KJTIIGC8Y1R12" },
    "ValidationSources": { "$": "FULLY_CORROBORATED" },
    "ValidationAuthority": {
      "ValidationAuthorityID": { "$": "RA000665" }
    }
  }
}
```

### Field mapping

| GLEIF JSON path | Stored column | Example stored value | Notes |
| --- | --- | --- | --- |
| `LEI.$` | `lei_records.lei` | `ZZZWS8Y6XVKM0Q9RJQ79` | Normalized to uppercase LEI |
| `Entity.LegalName.$` | `legal_name` | `Delaware Ivy Value Fund` | Primary display name |
| `Entity.OtherEntityNames.OtherEntityName[]` | `other_names` | JSONB array | Stored as JSON objects with `name`, `type`, `language` |
| `Entity.LegalAddress.FirstAddressLine.$` | `legal_address_line_1` | `C/O THE CORPORATION TRUST COMPANY` | |
| `Entity.LegalAddress.AdditionalAddressLine[0].$` | `legal_address_line_2` | `1209 ORANGE ST` | Extra lines map to line 2-4 |
| `Entity.LegalAddress.City.$` | `legal_address_city` | `WILMINGTON` | |
| `Entity.LegalAddress.Region.$` | `legal_address_region` | `US-DE` | |
| `Entity.LegalAddress.Country.$` | `legal_address_country` | `US` | ISO country code |
| `Entity.LegalAddress.PostalCode.$` | `legal_address_postal_code` | `19801` | |
| `Entity.HeadquartersAddress.*` | `hq_address_*` | `C/O Delaware Management Company, Inc.` | Same address-line expansion as legal address |
| `Entity.RegistrationAuthority.RegistrationAuthorityID.$` | `registration_authority` | `RA000665` | Code only; name is resolved later from reference data |
| `Entity.RegistrationAuthority.RegistrationAuthorityEntityID.$` | `registration_number` | `S000024832` | Entity's registry number |
| `Entity.EntityCategory.$` | `entity_category` | `FUND` | |
| `Entity.EntitySubCategory.$` | `entity_sub_category` | empty | Empty when not supplied |
| `Entity.LegalForm.EntityLegalFormCode.$` | `entity_legal_form` | `8888` | Raw ELF code from GLEIF |
| `Entity.EntityStatus.$` | `entity_status` | `INACTIVE` | Entity lifecycle |
| `Entity.LegalJurisdiction.$` | `legal_jurisdiction` | `US` | Added in migration `000054` |
| `Registration.RegistrationStatus.$` | `registration_status` | `RETIRED` | Added in migration `000054` |
| `Entity.SuccessorEntity[0].SuccessorLEI.$` | `successor_lei` | `549300VHTWY6NEMPX721` | Only the first successor is currently persisted |
| `Registration.ManagingLOU.$` | `managing_lou` | `5493001KJTIIGC8Y1R12` | Raw LOU LEI code |
| `Registration.ValidationSources.$` | `validation_sources` | `"FULLY_CORROBORATED"` | Stored as JSONB containing the raw string value |
| `Registration.ValidationAuthority.ValidationAuthorityID.$` | `validation_authority` | `RA000665` | Validation authority code |
| `Registration.InitialRegistrationDate.$` | `initial_registration_date` | `2012-06-06T15:56:00Z` | Parsed as timestamp |
| `Registration.LastUpdateDate.$` | `last_update_date` | `2024-10-31T17:51:29.927Z` | Parsed as timestamp |
| `Registration.NextRenewalDate.$` | `next_renewal_date` | `2024-09-12T20:51:51.032Z` | Parsed as timestamp |
| current source file id | `source_file_id` | UUID | Provenance back to `lei_raw.source_files` |

### Resulting row shape

The resulting Level 1 row is conceptually equivalent to:

```sql
INSERT INTO lei_raw.lei_records (
  lei,
  legal_name,
  other_names,
  legal_address_line_1,
  legal_address_line_2,
  legal_address_city,
  legal_address_region,
  legal_address_country,
  legal_address_postal_code,
  hq_address_line_1,
  hq_address_line_2,
  hq_address_line_3,
  hq_address_city,
  hq_address_region,
  hq_address_country,
  hq_address_postal_code,
  registration_authority,
  registration_number,
  entity_category,
  entity_legal_form,
  entity_status,
  legal_jurisdiction,
  registration_status,
  managing_lou,
  successor_lei,
  validation_sources,
  validation_authority,
  initial_registration_date,
  last_update_date,
  next_renewal_date,
  source_file_id
) VALUES (...);
```

### Additional Level 1 rules

- Literal string values of `null` are normalized to empty strings before persistence.
- `other_names` defaults to `[]`, and `changed_fields` defaults to `{}`.
- `successor_lei` is normalized and cleared if it is not a valid LEI.
- Resolved display fields such as `registration_authority_name`,
  `entity_legal_form_name`, `managing_lou_legal_name`, and
  `successor_lei_legal_name` are not stored in `lei_records`; they are added at
  query time via joins and correlated subqueries.

## Level 2 Relationship Records JSON to `lei_raw.lei_relationship_records`

The Level 2 Relationship Records parser maps each relationship object with the natural key
`start_node_lei | end_node_lei | relationship_type`.

| GLEIF JSON path | Stored column | Notes |
| --- | --- | --- |
| `Relationship.StartNode.NodeID.$` | `start_node_lei` | Child / controlled entity LEI |
| `Relationship.EndNode.NodeID.$` | `end_node_lei` | Parent / controlling entity LEI |
| `Relationship.RelationshipType.$` | `relationship_type` | For example direct vs ultimate consolidation |
| `Relationship.RelationshipStatus.$` | `relationship_status` | Relationship lifecycle |
| `Relationship.RelationshipPeriods` | `relationship_periods` | Raw JSONB payload |
| `Relationship.RelationshipQualifiers` | `relationship_qualifiers` | Raw JSONB payload |
| `Relationship.RelationshipQuantifiers` | `relationship_quantifiers` | Raw JSONB payload |
| `Registration.RegistrationStatus.$` | `registration_status` | Relationship registration lifecycle |
| `Registration.InitialRegistrationDate.$` | `initial_registration_date` | Parsed timestamp |
| `Registration.LastUpdateDate.$` | `last_update_date` | Parsed timestamp |
| `Registration.NextRenewalDate.$` | `next_renewal_date` | Parsed timestamp |
| `Registration.ManagingLOU.$` | `managing_lou` | LOU LEI code |
| `Registration.ValidationSources.$` | `validation_sources` | Stored as plain string |
| `Registration.ValidationDocuments.$` | `validation_documents` | Stored as plain string |
| `Registration.ValidationReference.$` | `validation_reference` | Optional document reference |
| current source file id | `source_file_id` | Provenance |

Relationship Records rows are only upserted after a pre-check confirms both LEIs already exist in
`lei_raw.lei_records`. Missing prerequisites are written to
`lei_raw.lei_level2_processing_failures` instead of creating partial links.

## Level 2 Reporting Exceptions JSON to `lei_raw.lei_reporting_exceptions`

The Level 2 Reporting Exceptions parser maps each exception with the natural key
`lei | exception_category`.

| GLEIF JSON path | Stored column | Notes |
| --- | --- | --- |
| `LEI.$` | `lei` | Entity claiming the exception |
| `ExceptionCategory.$` | `exception_category` | Direct or ultimate parent exception bucket |
| `ExceptionReason[]` | `exception_reasons` | Stored as JSONB array since migration `000055` |
| `ExceptionReference.$` | `exception_reference` | Optional free-text or document reference |
| current source file id | `source_file_id` | Provenance |

If GLEIF emits either a single exception reason or an array, the parser normalizes
both into the same JSONB array shape before persistence.

## GLEIF Reference CSV Lists

Reference lists are full-refresh syncs. Missing rows are deactivated or replaced so
the database reflects the latest published code list.

### Registration Authorities to `lei_raw.gleif_registration_authorities`

| CSV field | Stored column |
| --- | --- |
| RA ID | `ra_id` |
| Organization Name | `organization_name` |
| Jurisdiction | `jurisdiction` |
| International Name | `international_name` |
| Languages | `languages_used` |
| Website | `website` |
| Comments | `comments` |
| sync metadata | `active`, `updated_by` |

### Entity Legal Forms to `lei_raw.gleif_entity_legal_forms`

| CSV field | Stored column |
| --- | --- |
| ELF code | `elf_code` |
| Legal form name | `entity_legal_form_name` |
| Abbreviations | `abbreviations` |
| Language | `language_code` |
| Country of formation | `country_of_formation` |
| Country subdivision | `country_subdivision_of_formation` |
| Source status | `status` |

The parser normalizes `ACTV` to `ACTIVE` and `INAC` to `DECOMMISSIONED`.

### Organizational Roles to `lei_raw.gleif_organizational_roles`

| CSV field | Stored column |
| --- | --- |
| Role code | `role_code` |
| Role name | `role_name` |
| Description | `description` |
| Language | `language_code` |
| Related ELF code | `elf_code` |
| Country of formation | `country_of_formation` |
| Country subdivision | `country_subdivision_of_formation` |
| sync metadata | `active`, `updated_by` |

### Legal Jurisdictions to `lei_raw.gleif_legal_jurisdictions`

| CSV field | Stored column |
| --- | --- |
| Jurisdiction code | `jurisdiction_code` |
| Jurisdiction name | `jurisdiction_name` |
| Country code | `country_code` |
| sync metadata | `active`, `updated_by` |

If the source file layout is reversed, the parser detects that and swaps code/name
before persisting.

## Provenance, Audit, and Operational Tables

These tables are shared across the GLEIF pipeline:

| Table | Purpose |
| --- | --- |
| `lei_raw.source_files` | One row per downloaded file, with job type, status, hash, counters, and timestamps |
| `lei_raw.file_processing_status` | Current scheduler state for each job type |
| `lei_raw.lei_records_audit` | Level 1 create/update/delete history |
| `lei_raw.lei_relationship_records_audit` | Level 2 Relationship Records create/update/delete history |
| `lei_raw.lei_reporting_exceptions_audit` | Level 2 Reporting Exceptions create/update history |
| `lei_raw.lei_level2_processing_failures` | Durable decode/map/upsert failures with open/resolved lifecycle |

## UI-Enriched Fields That Are Not Stored in Base Tables

Some fields shown in the API and UI are derived at query time:

| API/UI field | Derived from |
| --- | --- |
| `registration_authority_name` | `gleif_registration_authorities.organization_name` |
| `registration_authority_international_name` | `gleif_registration_authorities.international_name` |
| `registration_authority_website` | `gleif_registration_authorities.website` |
| `registration_authority_comments` | `gleif_registration_authorities.comments` |
| `entity_legal_form_name` | `gleif_entity_legal_forms.entity_legal_form_name` |
| `managing_lou_legal_name` | joined Level 1 LEI lookup on `managing_lou` |
| `successor_lei_legal_name` | joined Level 1 LEI lookup on `successor_lei` |

This keeps the raw ingested tables close to the source payload while still allowing
the UI to show friendly names.
