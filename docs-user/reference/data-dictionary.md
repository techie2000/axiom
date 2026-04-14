# Data Dictionary

This page defines the key fields used across Axiom's data entities.

## LEI Record fields

| Field | Description | Example |
| --- | --- | --- |
| LEI | 20-character Legal Entity Identifier (ISO 17442) | `2138005O9XJIJN4JPN90` |
| Legal Name | Official registered name of the entity | `Acme Corporation Ltd` |
| Transliterated Legal Name | Latin-script version of the legal name when GLEIF provides one | `Bank Moskvy` |
| Other Names | Previous legal names, trading names, or alternate spellings shown as a list | `IVY FUNDS - Ivy Value Fund` |
| Legal Form | Legal form code from GLEIF; the full legal-form name is shown when reference data is available | `2HBR` / `Public Limited Company` |
| Entity Status | Current lifecycle status of the entity | `ACTIVE` |
| Entity Category | Classification of the entity type | `GENERAL` |
| Entity Sub-category | More specific classification under the main entity category when supplied | `FUND_FAMILY` |
| Legal Jurisdiction | Country or subdivision code for the entity's legal formation jurisdiction | `US` / `US-DE` |
| Registration Status | LEI registration lifecycle state | `ISSUED`, `LAPSED`, `RETIRED` |
| Registered Address | Officially registered legal address | 1 Main St, London |
| Headquarters Address | Principal place of business if different | 2 HQ Road, London |
| Registration Authority | Registry code from GLEIF; the registry name, international name, and website may also be shown | `RA000585` / `Companies House` |
| Registration Number | Identifier issued by the registration authority | `12345678` |
| Initial Registration Date | Date the LEI was first registered | `2015-01-15` |
| Last Updated | Date the record was last updated in GLEIF | `2026-01-10` |
| Next Renewal Date | Date by which the LEI registration should be renewed | `2026-09-12` |
| Managing LOU | LEI of the Local Operating Unit responsible for managing the record; the LOU name may also be shown | `5493001KJTIIGC8Y1R12` |
| Successor LEI | LEI of the successor entity after a merger or retirement, when one exists | `549300VHTWY6NEMPX721` |
| Validation Source | GLEIF validation source for the record | `FULLY_CORROBORATED` |
| Validation Authority | Registry or authority code used for validation when supplied | `RA000585` |

## Country fields

| Field | Description | Example |
| --- | --- | --- |
| Alpha-2 | Two-letter ISO 3166-1 code | `GB` |
| Alpha-3 | Three-letter ISO 3166-1 code | `GBR` |
| Numeric | Three-digit ISO 3166-1 numeric code | `826` |
| Name | Official English country name | `United Kingdom` |
| Native Name | Country name in its primary official language | `United Kingdom` |
| Capital | Capital city | `London` |
| Continent | Continent classification | `Europe` |
| Region | Sub-region classification | `Northern Europe` |
| Languages | Languages spoken in the country (ISO codes) | `en` |
| Currency Codes | Currencies used in the country (ISO 4217) | `GBP` |
| Phone Codes | International dialling codes | `+44` |
| Active | Whether the record is active in Axiom | `Active` / `Inactive` |

## Currency fields

| Field | Description | Example |
| --- | --- | --- |
| Code | Three-letter ISO 4217 currency code | `USD` |
| Numeric | Three-digit ISO 4217 numeric code | `840` |
| Name | Official currency name | `US Dollar` |
| Symbol | Currency symbol | `$` |
| Minor Unit (Decimals) | Number of decimal places for the currency | `2` |
| ALERT CLS Allowed | Eligible for Continuous Linked Settlement | `Allowed` / `—` |
| OFAC Sanctioned | Associated with OFAC-sanctioned jurisdiction | `Sanctioned` / `—` |

## Language fields

| Field | Description | Example |
| --- | --- | --- |
| Code | ISO 639-1 two-letter language code | `en` |
| Name | Official English name of the language | `English` |
| Native Name | Language name written in that language | `English` |
| Direction | Writing direction: left-to-right or right-to-left | `LTR` / `RTL` |

## Entity fields

| Field | Description | Example |
| --- | --- | --- |
| Name | Legal name of the entity as held in Axiom master data | `Acme Trading Ltd` |
| Status | Current operational status of the entity | `ACTIVE` |
| LEI | Linked 20-character Legal Entity Identifier | `2138005O9XJIJN4JPN90` |
| Internal ID | Firm-assigned internal identifier | `ENT-0042` |

## Instrument fields (planned)

| Field | Description | Example |
| --- | --- | --- |
| ISIN | International Securities Identification Number (ISO 6166) | `GB0002634946` |
| CUSIP | North American securities identifier | `037833100` |
| SEDOL | Stock Exchange Daily Official List identifier | `B7TL820` |
| Name | Instrument description | `Apple Inc Common Stock` |
| Asset Class | Top-level asset classification | `Equity` |
| Instrument Type | Specific classification within the asset class | `Ordinary Share` |
| Issuer Name | Name of the issuing entity | `Apple Inc` |
| Issuer LEI | LEI of the issuing entity | `HWUPKR0MPOU8FGXBT394` |
| Currency | Settlement currency | `USD` |
| Status | Current status of the instrument record | `ACTIVE` |

## Account fields (planned)

| Field | Description | Example |
| --- | --- | --- |
| Account Number | Primary account identifier | `DE89370400440532013000` |
| Account Name | Descriptive name for the account | `EUR Nostro Account` |
| BIC | Bank Identifier Code of the holding institution | `DEUTDEDB` |
| Currency | Account settlement currency | `EUR` |
| Account Holder | Name of the entity that owns the account | `Global Markets AG` |
| Account Holder LEI | LEI of the account holder | `5493001KJTIIGC8Y1R12` |
| Status | Current status of the account | `ACTIVE` |
| Effective Date | Date from which the account record is valid | `2024-01-01` |

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
