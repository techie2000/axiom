# SSI UI Schema (MVP)

Minimal UI schema for the future Standard Settlement Instructions (SSI) list page.

## Scope

- Define a first-pass table layout for SSI records.
- Align with existing list-page standards (header, stats, filters, table, column selector).
- Define where virtual country flag columns should appear.

## API Contract (Current)

- Endpoint: `GET /api/v1/ssis?limit=<n>&offset=<n>` (protected)
- Response fields aligned to UI schema:
  - `id`
  - `ssi_reference`
  - `counterparty_name`
  - `account_name`
  - `country_code`
  - `currency`
  - `bic`
  - `iban` (optional)
  - `settlement_method` (`Agent` | `Direct`)
  - `status` (`Active` | `Inactive`)
  - `updated_at`

## Table Columns

Use this as the initial column set for `frontend/app/ssi/page.tsx` when SSI list UI is implemented.

| Column Key | Label | Type | Default Visible | Notes |
| --- | --- | --- | --- | --- |
| ssi_reference | SSI Reference | text | yes | Unique SSI identifier |
| counterparty_name | Counterparty | text | yes | Human-readable counterparty |
| account_name | Account | text | yes | Linked settlement account |
| country_code | Country (Alpha-2) | code | yes | ISO alpha-2 code |
| country_flag | Flag | virtual | no | Derived from `country_code` |
| currency | Currency | code | yes | ISO 4217 currency |
| bic | BIC/SWIFT | code | yes | Settlement BIC |
| iban | IBAN | text | no | Optional by market |
| settlement_method | Method | enum | yes | Example: Agent / Direct |
| status | Status | enum | yes | Active / Inactive |
| updated_at | Updated | datetime | no | ISO 8601 display |

## Filters (MVP)

- Search: `ssi_reference`, `counterparty_name`, `account_name`, `bic`
- Country filter: `country_code`
- Currency filter: `currency`
- Status filter: `status`

Show `Clear Filters` only when one or more filters are active.

## Virtual Country Flag Column

- Do not store country flag emoji in database tables.
- Render flag as a virtual UI column derived from `country_code`.
- Reuse shared helper: `frontend/app/lib/country-flag.ts`

Example mapping behavior:

- `GB` -> 🇬🇧
- `SE` -> 🇸🇪
- invalid/missing -> `—`

## Column Selector Rules

- Include all columns listed in this schema.
- Provide `Select All` and `Reset Default` actions.
- `Columns` count reflects currently visible columns.

## Suggested Default Sort

- `counterparty_name` ascending
- fallback: `ssi_reference` ascending

## Notes for Implementation

- Keep page structure consistent with current standards:
  Header -> Info/Error -> Stats -> Filters -> Table.
- Keep flags virtual and reusable; avoid duplicating conversion logic.
