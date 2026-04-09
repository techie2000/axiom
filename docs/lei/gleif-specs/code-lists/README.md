# GLEIF Code Lists

Local snapshots of the GLEIF-maintained code lists used by this repository for LEI enrichment,
validation, and debugging.

## Why these are here

These files are not the LEI-CDF or RR-CDF schemas themselves. They are the supporting reference
lists used to interpret coded values found in LEI data:

- `entity_legal_form` in `lei_raw.lei_records`
- `legal_jurisdiction` in `lei_raw.lei_records`
- organizational role codes in the GLEIF reference pipeline and downstream LEI/vLEI work

Keeping local copies gives us a stable reference when:

- upstream code lists change between sync runs
- we need to debug a historical value or version-specific behavior
- we want reviewers and AI tools to understand the source vocabulary without leaving the repo

## Included sets

| Folder | Purpose | Current local version |
| ------ | ------- | --------------------- |
| [`entity-legal-forms/`](./entity-legal-forms/) | ISO 20275 ELF codes used for `lei_records.entity_legal_form` | 1.6 |
| [`organizational-roles/`](./organizational-roles/) | ISO 5009 official organizational roles | 1.0.0 |
| [`legal-jurisdictions/`](./legal-jurisdictions/) | GLEIF accepted legal jurisdictions for `LegalJurisdiction` values | 1.5 |

## Source pages

| Domain | GLEIF source page |
| ------ | ----------------- |
| Entity legal forms | <https://www.gleif.org/en/lei-data/code-lists/iso-20275-entity-legal-forms-code-list> |
| Organizational roles | <https://www.gleif.org/en/lei-data/code-lists/iso-5009-official-organizational-roles-code-list> |
| Accepted legal jurisdictions | <https://www.gleif.org/en/lei-data/code-lists/gleif-accepted-legal-jurisdictions-code-list> |

## Notes by domain

### Entity legal forms

The ELF code list is GLEIF's implementation of ISO 20275. It is the authoritative reference for
`EntityLegalFormCode` values in LEI-CDF and for the values loaded into
`lei_raw.gleif_entity_legal_forms`.

Reserved codes called out by GLEIF are especially important during debugging:

- `8888` means a new legal form has been requested from GLEIF
- `9999` means the entity has no separate legal form

### Organizational roles

The OOR code list is based on ISO 5009 and is related to the relevant legal form. These role codes
are more relevant to reference-data support and future vLEI-related work than to the core Level 1
LEI ingest path.

### Accepted legal jurisdictions

The legal jurisdiction list constrains valid `LegalJurisdiction` values. GLEIF explicitly notes
that the general rule is to use ISO 3166-1 alpha-2 unless a jurisdiction requires ISO 3166-2 for
sub-division-level legal forms.

## File types

Each folder may contain one or more of:

- `csv` for machine-readable ingestion and diffing
- `xlsx` for analyst/reviewer inspection
- `pdf` for narrative/reference use
- changelog spreadsheets when GLEIF publishes version deltas

## How to update

1. Download the newest files from the source page above.
2. Keep the upstream filename so the embedded version/date remain visible.
3. Replace or add the files in the matching subfolder.
4. Update this README if a new major version or file type is added.
5. If the change affects ingestion behavior, also update [docs/lei/GLEIF_REFERENCE_CODE_LISTS.md](../GLEIF_REFERENCE_CODE_LISTS.md).
