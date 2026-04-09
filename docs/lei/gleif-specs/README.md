# GLEIF Common Data File (CDF) Specifications

Local copies of the GLEIF specification files that define the data structures consumed by this
application's LEI sync pipeline.

## Why these are here

The GLEIF specs are the authoritative source of truth for every field mapped in:

- `lei_raw.lei_records` — populated from the Level 1 (LEI-CDF) golden-copy files
- `lei_raw.lei_relationship_records` — populated from the Level 2 (RR-CDF) golden-copy files
- `lei_raw.lei_reporting_exceptions` — populated from the Level 2 Reporting Exceptions golden-copy files

Having local copies means:

- Developers can consult the exact field definitions without a browser
- Copilot and AI tools have immediate context when maintaining parsing, mapping, or database code
- We have a fixed reference point showing which spec version the code was written against

## Files

| File | Spec | Version | Downloaded |
| ---- | ---- | ------- | ---------- |
| [`lei-cdf-v3-1.xsd`](./lei-cdf-v3-1.xsd) | Level 1 — LEI Common Data File | 3.1 | 2021-03-04 |
| [`rr-cdf-v2-1.xsd`](./rr-cdf-v2-1.xsd) | Level 2 — Relationship Record CDF | 2.1 | 2021-03-04 |
| [`reporting-exceptions/README.md`](./reporting-exceptions/README.md) | Level 2 — Reporting Exceptions artifact index | 2.1 | 2026-04-09 |
| [`code-lists/README.md`](./code-lists/README.md) | GLEIF code-list artifact index | Mixed | 2026-04-09 |
| [`LEI-CDF-v3-1-field-reference.md`](./LEI-CDF-v3-1-field-reference.md) | Level 1 — human-readable field reference | 3.1 | — |
| [`RR-CDF-v2-1-field-reference.md`](./RR-CDF-v2-1-field-reference.md) | Level 2 — human-readable field reference | 2.1 | — |

## Supporting artifact sets

- [`reporting-exceptions/README.md`](./reporting-exceptions/README.md) explains the local copies of the
   Level 2 Reporting Exceptions XSD, release notes, and state-transition rules.
- [`code-lists/README.md`](./code-lists/README.md) explains the local snapshots for entity legal forms,
   organizational roles, and accepted legal jurisdictions.

## Official GLEIF sources

| Document | URL |
| -------- | --- |
| Level 1 spec page | <https://www.gleif.org/en/lei-data/access-and-use-lei-data/level-1-data-lei-cdf-3-1-format> |
| Level 1 XSD | <https://www.gleif.org/lei-data/access-and-use-lei-data/level-1-data-lei-cdf-3-1-format/2021-03-04_lei-cdf-v3-1.xsd> |
| Level 2 RR spec page | <https://www.gleif.org/en/lei-data/access-and-use-lei-data/level-2-data-relationship-record-rr-cdf-2-1-format> |
| Level 2 RR XSD | <https://www.gleif.org/lei-data/access-and-use-lei-data/level-2-data-relationship-record-rr-cdf-2-1-format/2021-03-04_rr-cdf-v2-1.xsd> |
| Level 2 Reporting Exceptions spec page | <https://www.gleif.org/en/lei-data/access-and-use-lei-data/level-2-data-reporting-exceptions-2-1-format> |
| State Transition & Validation Rules (PDF) | <https://www.gleif.org/lei-data/access-and-use-lei-data/level-1-data-lei-cdf-3-1-format/2025-07-03_state-transition-validation-rules_2.8.5_final.pdf> |
| GLEIF Golden Copy download | <https://www.gleif.org/en/lei-data/gleif-golden-copy/download-the-golden-copy> |
| GLEIF API | <https://www.gleif.org/en/lei-data/gleif-api> |
| GLEIF Data Dictionary | <https://www.gleif.org/en/lei-data/access-and-use-lei-data/gleif-data-dictionary> |

## How to update

If GLEIF releases a new CDF version:

1. Download the new XSD from the spec page above.
2. Replace the matching file in this directory.
3. Update [`LEI-CDF-v3-1-field-reference.md`](./LEI-CDF-v3-1-field-reference.md) or
   [`RR-CDF-v2-1-field-reference.md`](./RR-CDF-v2-1-field-reference.md) to reflect any
   added/removed/changed elements.
4. Update the column `COMMENT` SQL in the relevant migration (or add a new migration) to keep
   the database self-documentation in sync.
5. Update the file name and the table above to reflect the new version number.

## Key concepts

### Level 1 vs Level 2 data

| | Level 1 (LEI-CDF) | Level 2 (RR-CDF) |
| - | ------------------- | ------------------ |
| Question answered | "Who is who?" | "Who owns whom?" |
| Main table | `lei_raw.lei_records` | `lei_raw.lei_relationship_records` |
| Golden-copy cadence | 3× daily | 3× daily |
| ~Record count (2026) | 3.27 M | 470 K |

### GLEIF vs LOU — an important distinction

**GLEIF** (Global Legal Entity Identifier Foundation) is the umbrella body that maintains the
global LEI index and publishes the golden-copy files.

**LOU** (Local Operating Unit) is the regional registrar — e.g. Bloomberg, DTCC, WM Datenservice
— that actually issues LEIs and manages individual registrations on behalf of GLEIF.

The `Registration` section in both specs explicitly states:
> *"The Registration data is maintained by the LOU."*

This means `InitialRegistrationDate`, `LastUpdateDate`, and `NextRenewalDate` all record events
at the **LOU** level, not at GLEIF directly.

### The two `InitialRegistrationDate` fields

Both tables have a column named `initial_registration_date` but they record **different events**:

| Table | Tracks |
| ------- | -------- |
| `lei_records.initial_registration_date` | When the **LEI** was first assigned and published by the managing LOU |
| `lei_relationship_records.initial_registration_date` | When the **relationship information** (parent/fund link) was first collected by the managing LOU |

These can differ by years for the same entity. The `1970-01-01` epoch value seen on some
relationship records is a known GLEIF data quality issue in early/legacy records where the LOU
did not supply a date.
