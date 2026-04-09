# RR-CDF v2.1 — Field Reference

> **Source:** Relationship Record Common Data File format version 2.1, published 2021-03-04 by
> GLEIF.
> XSD: [`rr-cdf-v2-1.xsd`](./rr-cdf-v2-1.xsd)
> Official spec page:
> <https://www.gleif.org/en/lei-data/access-and-use-lei-data/level-2-data-relationship-record-rr-cdf-2-1-format>

This file summarises every element in a Level 2 Relationship Record, mapped to the Axiom column
where applicable. Definitions are taken verbatim from the XSD `xs:documentation` annotations.

---

## Record structure

```text
Relationship Record
├── Relationship
│   ├── StartNode              (the child company's LEI)
│   ├── EndNode                (the parent company's LEI)
│   ├── RelationshipType
│   ├── RelationShipPeriods[]
│   ├── RelationshipStatus
│   ├── RelationshipQualifiers[]
│   └── RelationshipQuantifiers[]
└── Registration               (maintained by the managing LOU)
    ├── InitialRegistrationDate
    ├── LastUpdateDate
    ├── RegistrationStatus
    ├── NextRenewalDate
    ├── ManagingLOU
    ├── ValidationSources
    ├── ValidationDocuments
    └── ValidationReference
```

---

## Relationship section

> *"Information about the relationship between two legal entities."*

### StartNode / EndNode

Each node has an element `NodeID` containing the LEI (20 alphanumeric characters).

`StartNode` is the *child / subsidiary*; `EndNode` is the *parent / direct or ultimate owner*.

**Axiom columns:**
- `lei_relationship_records.relationship_start_node` (StartNode LEI)
- `lei_relationship_records.relationship_end_node` (EndNode LEI)

### RelationshipType

The nature of the hierarchical ownership or control link:

| Value | Level | Meaning |
|-------|-------|---------|
| `IS_DIRECTLY_CONSOLIDATED_BY` | Direct (L2) | StartNode is consolidated by EndNode at accounting year-end |
| `IS_ULTIMATELY_CONSOLIDATED_BY` | Ultimate (L2) | StartNode is ultimately consolidated by EndNode |
| `IS_INTERNATIONAL_BRANCH_OF` | — | StartNode is a foreign branch of EndNode |
| `IS_FUND-MANAGED_BY` | — | StartNode fund is managed by EndNode investment manager (v2.0) |
| `IS_SUBFUND_OF` | — | StartNode is a sub-fund of EndNode umbrella fund (v2.0) |
| `IS_FEEDER_TO` | — | StartNode feeder fund feeds into EndNode master fund (v2.0) |

**Axiom column:** `lei_relationship_records.relationship_type`

### RelationshipStatus

Indicates whether the relationship is currently active:

| Value | DB value | Meaning |
|-------|----------|---------|
| `ACTIVE` | `'ACTIVE'` | The relationship is currently in force |
| `INACTIVE` | `'INACTIVE'` | The relationship has ended |
| `NULL` | `'NULL'` | Status not determinable (v2.0 addition) |

**Axiom column:** `lei_relationship_records.relationship_status` — `VARCHAR(50) NOT NULL`

> **Note:** `NULL` is an RR-CDF enum **string** value, not a SQL NULL. It is stored as the
> literal text `'NULL'` and can appear in a `NOT NULL` column without violating the constraint.
> As of 2026-04 there are ~350 rows with this value in production data.

### RelationShipPeriods (Periods)

A repeating set of date ranges describing different aspects of the relationship with a `PeriodType`
discriminator:

| PeriodType | Meaning |
|-----------|---------|
| `ACCOUNTING_PERIOD` | Fiscal year for which the consolidation is reported |
| `DOCUMENT_FILING_PERIOD` | Period of the filing that documents the relationship |

Elements within each period: `StartDate`, `EndDate` (both ISO 8601).

**Axiom column:** `lei_relationship_records.relationship_periods` (JSONB)

### RelationshipQualifiers

Additional descriptive annotations on the relationship:

| QualifierDimension | QualifierCategory | Meaning |
|-------------------|-------------------|---------|
| `ACCOUNTING_STANDARD` | `IFRS` | Consolidated under International Financial Reporting Standards |
| `ACCOUNTING_STANDARD` | `US_GAAP` | Consolidated under US GAAP |
| `ACCOUNTING_STANDARD` | `OTHER_GAAP` | Consolidated under another GAAP |

**Axiom column:** `lei_relationship_records.relationship_qualifiers` (JSONB)

### RelationshipQuantifiers

Numeric measures describing quantitative aspects of the relationship, e.g. percentage ownership.
Each entry has `MeasurementMethod` and `QuantifierAmount`.

**Axiom column:** `lei_relationship_records.relationship_quantifiers` (JSONB)

---

## Registration section

> *"Information specifying the LOU's administration of the relationship report.  This Registration
> data is maintained by the managing LOU."*
>
> **Key distinction:** the `Registration` section here describes the administration of the
> *relationship filing*, not the LEI itself. The `ManagingLOU` is the LOU responsible for
> collecting and publishing the relationship data.

### InitialRegistrationDate

> "The date at which the relationship information was first collected by the ManagingLOU."

This is the date the relationship data was *filed with the LOU*, which may be:

- Long after both entities obtained their LEIs
- `1970-01-01` for legacy records where the LOU did not retain the original filing date
  (a known GLEIF data quality issue, not an ingestion error in Axiom)

**Axiom column:** `lei_relationship_records.initial_registration_date`
**Caution:** Do not compare this value to `lei_records.initial_registration_date`, which tracks
LEI assignment. They measure different events.

### LastUpdateDate

> "The date at which the relationship information was most recently updated by the ManagingLOU."

**Axiom column:** `lei_relationship_records.last_update_date`

### RegistrationStatus

Lifecycle state of the relationship registration (11 possible values):

| Value | Meaning |
|-------|---------|
| `PENDING_VALIDATION` | Submitted, not yet validated |
| `PUBLISHED` | Validated and active |
| `DUPLICATE` | A duplicate record |
| `LAPSED` | Not renewed by `NextRenewalDate` |
| `MERGED` | Two records merged into one |
| `RETIRED` | No longer active; retained for history |
| `ANNULLED` | Marked erroneous after publication |
| `CANCELLED` | Cancelled before publication |
| `TRANSFERRED` | Transferred to another LOU |
| `PENDING_ARCHIVAL` | About to be removed from active file (deprecated name) |
| `PENDING_ARCHIVE` | Alternate/current spelling for PENDING_ARCHIVAL |

**Axiom column:** `lei_relationship_records.registration_status`

### NextRenewalDate

> "The date at which the relationship information must next be renewed and re-certified by the
> entity with the ManagingLOU."

**Axiom column:** `lei_relationship_records.next_renewal_date`

### ManagingLOU

The LEI of the LOU responsible for administering this relationship record.

**Axiom column:** `lei_relationship_records.managing_lou`

### ValidationSources

Level of corroboration for the relationship information:

| Value | Meaning |
|-------|---------|
| `PENDING` | Validation has not yet occurred |
| `ENTITY_SUPPLIED_ONLY` | Based on information from the filing entity only |
| `PARTIALLY_CORROBORATED` | Partially confirmed against independent sources |
| `FULLY_CORROBORATED` | Fully confirmed against explicit independent sources |

**Axiom column:** `lei_relationship_records.validation_sources`

### ValidationDocuments

The type of document(s) used to validate the relationship:

| Value | Meaning |
|-------|---------|
| `ACCOUNTS_FILING` | Published accounts or financial statements |
| `REGULATORY_FILING` | Regulatory submission (e.g. 13F, CRD) |
| `SUPPORTING_DOCUMENTS` | Other supporting documentation provided by registrant |
| `CONTRACTS` | Contractual agreements |
| `OTHER_OFFICIAL_DOCUMENTS` | Other official documents |

**Axiom column:** `lei_relationship_records.validation_documents`

### ValidationReference

Free-text reference to the specific document or filing used for validation (e.g. filing number,
URL, or accession number).

**Axiom column:** `lei_relationship_records.validation_reference`

---

## Version history

### v2.1 (2021-03-04)

- Clarified `xs:documentation` on `RegistrationContainerType/InitialRegistrationDate` to read
  "collected by the ManagingLOU" (was previously ambiguous)
- Minor XSD annotation clean-up; no structural or enum changes

### v2.0

- Added `RelationshipType` values: `IS_FUND-MANAGED_BY`, `IS_SUBFUND_OF`, `IS_FEEDER_TO`
- Added `RelationshipStatus` value: `NULL`
- Added `ValidationSources` values: `PENDING`, `ENTITY_SUPPLIED_ONLY`
- Added `ValidationDocuments` values: `CONTRACTS`, `OTHER_OFFICIAL_DOCUMENTS`

### v1.0

Initial release with `IS_DIRECTLY_CONSOLIDATED_BY` and `IS_ULTIMATELY_CONSOLIDATED_BY`.
