# LEI-CDF v3.1 — Field Reference

> **Source:** LEI Common Data File format version 3.1, published 2021-03-04 by GLEIF.
> XSD: [`lei-cdf-v3-1.xsd`](./lei-cdf-v3-1.xsd)
> Official spec page: <https://www.gleif.org/en/lei-data/access-and-use-lei-data/level-1-data-lei-cdf-3-1-format>

This file summarises every element in a Level 1 LEI record, mapped to the Axiom column where
applicable. Definitions are taken verbatim from the XSD `xs:documentation` annotations.

---

## Record structure

```text
LEI Data Record
├── LEI                          (the 20-char identifier)
├── Entity                       (supplied by the legal entity, published by the LOU)
│   ├── LegalName
│   ├── OtherEntityNames[]
│   ├── TransliteratedOtherEntityNames[]
│   ├── LegalAddress
│   ├── HeadquartersAddress
│   ├── RegistrationAuthority
│   ├── LegalJurisdiction
│   ├── EntityCategory
│   ├── EntitySubCategory          (v3.1)
│   ├── LegalForm
│   ├── EntityStatus
│   ├── EntityCreationDate         (v3.0)
│   ├── LegalEntityEvents[]        (v3.0)
│   └── SuccessorEntity[]
└── Registration                 (maintained by the LOU)
    ├── InitialRegistrationDate
    ├── LastUpdateDate
    ├── RegistrationStatus
    ├── NextRenewalDate
    ├── ManagingLOU
    ├── ValidationSources (→ LOU corroboration level)
    ├── ValidationAuthority
    └── OtherValidationAuthorities[]
```

---

## Entity section

> *"Attributes describing the legal entity itself. The Entity data is supplied by the legal entity,
> and recorded and published by the LOU."*

### LegalName

The official name of the legal entity as recorded in the relevant official register, or otherwise
in the entity's constituting documents. `xml:lang` attribute carries the BCP 47 language tag.

**Axiom column:** `lei_records.legal_name`

### OtherEntityNames

Alternative or historical names. Each entry has a `type` attribute:

| Type | Meaning |
|------|---------|
| `PREVIOUS_LEGAL_NAME` | Former registered name |
| `TRADING_OR_OPERATING_NAME` | Commercial/trading name |
| `ALTERNATIVE_LANGUAGE_LEGAL_NAME` | Same name in another official language |

**Axiom column:** `lei_records.other_names` (JSONB array)

### TransliteratedOtherEntityNames

ASCII transliterations of non-Latin names. Types:

| Type | Meaning |
|------|---------|
| `AUTO_ASCII_TRANSLITERATED_LEGAL_NAME` | System-generated ASCII transliteration |
| `PREFERRED_ASCII_TRANSLITERATED_LEGAL_NAME` | LOU-preferred ASCII transliteration |

**Axiom column:** `lei_records.transliterated_legal_name`

### LegalAddress / HeadquartersAddress

Registered legal address and principal place of business respectively. Fields: `FirstAddressLine`,
`AdditionalAddressLine` (×n), `City`, `Region` (ISO 3166-2), `Country` (ISO 3166-1 alpha-2),
`PostalCode`.

**Axiom columns:** `lei_records.legal_address_*` / `lei_records.hq_address_*`

### RegistrationAuthority

The registration authority that issued the entity's company/trade registration.
Sub-elements: `RegistrationAuthorityID` (GLEIF RA code e.g. `RA000589`) and
`RegistrationAuthorityEntityID` (entity's number within that registry).

**Axiom columns:** `lei_records.registration_authority`, `lei_records.registration_number`

### LegalJurisdiction

ISO 3166-1/3166-2 code for the jurisdiction of legal formation.

### EntityCategory

Classification of the entity type:

| Value | Meaning |
|-------|---------|
| `BRANCH` | A branch of a foreign entity |
| `FUND` | A collective investment vehicle |
| `SOLE_PROPRIETOR` | A sole proprietorship |
| `GENERAL` | General legal entity (v3.0) |
| `RESIDENT_GOVERNMENT_ENTITY` | Government entity (v3.1) |
| `INTERNATIONAL_ORGANIZATION` | International organization (v3.1) |

**Axiom column:** `lei_records.entity_category`

### EntitySubCategory (v3.1)

More specific sub-classification, primarily for government entities:

| Value |
|-------|
| `CENTRAL_GOVERNMENT` |
| `STATE_GOVERNMENT` |
| `LOCAL_GOVERNMENT` |
| `SOCIAL_SECURITY` |

**Axiom column:** `lei_records.entity_sub_category`

### LegalForm

The legal form of the entity. `EntityLegalFormCode` contains the ISO 20275 ELF code
(e.g. `9999` for other/not classified). `OtherLegalForm` is a free-text fallback during
transition to ELF codes.

**Axiom column:** `lei_records.entity_legal_form`

### EntityStatus

Current operating status of the legal entity:

| Value | Meaning |
|-------|---------|
| `ACTIVE` | Entity is legally registered and operating |
| `INACTIVE` | Entity is no longer legally registered or operating |
| `NULL` | Status not applicable (v3.0) |

**Axiom column:** `lei_records.entity_status`

### EntityCreationDate (v3.0)

The date on which the legal entity was first established (incorporated, etc.) as represented in
ISO 8601. Distinct from `InitialRegistrationDate` which is the LEI assignment date.

### SuccessorEntity (v3.0, was v2.x AssociatedEntity — deprecated)

One or more LEIs of successor entities when this entity has been merged or transformed.

**Axiom column:** `lei_records.successor_lei` (first entry only)

---

## Registration section

> *"Attributes describing the registration of this LEI with an LOU. The Registration data is
> maintained by the LOU."*

### InitialRegistrationDate

The date at which the LEI was first assigned and published by the managing LOU.

> "The date of the first LEI assignment, being the date of publication of the identifier and its
> supporting data record." — ISO 17442

**Axiom column:** `lei_records.initial_registration_date`
**Note:** This is NOT the entity creation date. An entity may have existed for decades before
obtaining an LEI.

### LastUpdateDate

The date at which the LEI data record was most recently updated by the managing LOU.

**Axiom column:** `lei_records.last_update_date`

### RegistrationStatus

Lifecycle state of the LEI registration:

| Value | Meaning |
|-------|---------|
| `PENDING_VALIDATION` | Submitted, awaiting validation |
| `ISSUED` | Validated, published, entity is active |
| `DUPLICATE` | Determined to be a duplicate LEI |
| `LAPSED` | Not renewed by `NextRenewalDate` |
| `MERGED` | **Deprecated (v3.0)** — use `SuccessorEntity` + `RETIRED` |
| `RETIRED` | No longer an active LEI; kept for historical audit |
| `ANNULLED` | Marked erroneous after publication |
| `CANCELLED` | Cancelled before publication |
| `TRANSFERRED` | Transferred to another LOU |
| `PENDING_TRANSFER` | Transfer to another LOU in progress |
| `PENDING_ARCHIVAL` | About to be removed from LOU-specific file |

**Axiom column:** `lei_records.entity_status` (mapped from LEI registration status)

### NextRenewalDate

The next date by which the LEI registration must be renewed and re-certified by the legal entity
with the managing LOU.

**Axiom column:** `lei_records.next_renewal_date`

### ManagingLOU

The LEI of the LOU responsible for managing this LEI record.

**Axiom column:** `lei_records.managing_lou`

### ValidationSources

The level of corroboration applied by the managing LOU:

| Value | Meaning |
|-------|---------|
| `PENDING` | Validation has not yet occurred |
| `ENTITY_SUPPLIED_ONLY` | Based primarily on information supplied by the registrant |
| `PARTIALLY_CORROBORATED` | Partially confirmed against independent sources |
| `FULLY_CORROBORATED` | Confirmed against explicit independent sources |

**Axiom column:** `lei_records.validation_sources` (JSONB)

### ValidationAuthority / OtherValidationAuthorities

The authority (registry or regulator) used to validate the entity information.
Sub-elements: `ValidationAuthorityID` (GLEIF RA code) and `ValidationAuthorityEntityID`.

**Axiom column:** `lei_records.validation_authority`

---

## Enumerations added per version

### v3.1 additions

- `EntityCategory`: `RESIDENT_GOVERNMENT_ENTITY`, `INTERNATIONAL_ORGANIZATION`
- `EntitySubCategory`: `CENTRAL_GOVERNMENT`, `STATE_GOVERNMENT`, `LOCAL_GOVERNMENT`,
  `SOCIAL_SECURITY`
- New element: `EntitySubCategory`

### v3.0 additions

- `EntityCategory`: `GENERAL`
- `EntityStatus`: `NULL`
- New elements: `EntityCreationDate`, `LegalEntityEvents`, `SuccessorEntity` (now repeatable)
- Deprecated: `AssociatedEntity`, `EntityExpirationDate`, `EntityExpirationReason`
- Deprecated `RegistrationStatus`: `MERGED`

### v2.0 additions

- `EntityCategory`, `ValidationAuthority`, `OtherValidationAuthorities`
- `OtherEntityName` types: `PREVIOUS_LEGAL_NAME`, `TRADING_OR_OPERATING_NAME`
- Replaced `BusinessRegisterEntityID` with `RegistrationAuthority`
