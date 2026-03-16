# Data Dictionary

This page defines the key fields used across Axiom's data entities.

## LEI Record fields

| Field | Description | Example |
| --- | --- | --- |
| LEI | 20-character Legal Entity Identifier (ISO 17442) | `2138005O9XJIJN4JPN90` |
| Legal Name | Official registered name of the entity | `Acme Corporation Ltd` |
| Legal Form | Legal structure type (for example, `LLC`, `PLC`, `SA`) | `PLC` |
| Entity Status | Current lifecycle status of the entity | `ACTIVE` |
| Entity Category | Classification of the entity type | `GENERAL` |
| Registered Address | Officially registered legal address | 1 Main St, London |
| Headquarters Address | Principal place of business if different | 2 HQ Road, London |
| Registration Authority | Body that assigned the registration number | Companies House |
| Registration Number | Identifier issued by the registration authority | `12345678` |
| Registration Date | Date the LEI was first registered | `2015-01-15` |
| Last Updated | Date the record was last updated in GLEIF | `2026-01-10` |
| Relationship Status | Status of the relationship to the managing LOU | `ISSUED` |
| Validation Status | Source and method used to validate entity information | `FULLY_CORROBORATED` |
| Managing LOU | Legal Operating Unit responsible for this LEI | LSEG |
| Other Names | Previous legal names or trading names | - |

## Country fields

| Field | Description | Example |
| --- | --- | --- |
| Alpha-2 | Two-letter ISO 3166-1 code | `GB` |
| Alpha-3 | Three-letter ISO 3166-1 code | `GBR` |
| Numeric | Three-digit ISO 3166-1 numeric code | `826` |
| Name | Official English country name | `United Kingdom` |
| Continent | Continent classification | `Europe` |

## Currency fields

| Field | Description | Example |
| --- | --- | --- |
| Code | Three-letter ISO 4217 currency code | `USD` |
| Numeric | Three-digit ISO 4217 numeric code | `840` |
| Name | Official currency name | `US Dollar` |
| Minor Unit | Number of decimal places for the currency | `2` |

## Settlement Instruction (SSI) fields

| Field | Description | Example |
| --- | --- | --- |
| Counterparty | Name of the counterparty for these instructions | `Global Bank AG` |
| Counterparty LEI | LEI of the counterparty | `5493001KJTIIGC8Y1R12` |
| Currency | Settlement currency | `EUR` |
| Settlement Method | How settlement is performed (for example, `SWIFT`, `CLS`) | `SWIFT` |
| Beneficiary BIC | BIC of the beneficiary bank | `DEUTDEDB` |
| Account Number | Account number at the beneficiary bank | `DE89370400440532013000` |
| Intermediary BIC | BIC of the intermediary bank (if applicable) | `CHASUS33` |
| Status | Current status of the instruction | `ACTIVE` |
| Effective Date | Date from which the instruction is valid | `2024-01-01` |
| Expiry Date | Date after which the instruction is no longer valid | `2026-12-31` |

## Related pages

- [Statuses & States](./statuses-and-states) — all status values and their meanings.
- [LEI Records workflow](../workflows/lei-records) — how to search LEI data.
- [SSI workflow](../workflows/ssi) — how to use settlement instructions.
