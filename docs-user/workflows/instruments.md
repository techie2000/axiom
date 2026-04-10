# Instruments

## Goal

View and search financial instrument master data in Axiom.

## Prerequisites

- You are signed in to Axiom. See [Sign In & Access](../getting-started/sign-in-and-access).
- Your role includes access to the **Instruments** module.

## Current status

The Instruments module is currently in development. When you navigate to **Instruments**, you will
see a **Coming Soon** card indicating that the feature is not yet available for general use.

This page documents the planned behaviour so you know what to expect when the module is released.

## Planned workflow

### Search for an instrument

1. Click **Instruments** in the top navigation.
2. Use the **Search** bar to find an instrument by name, ISIN, or other identifier.
3. Results appear in the table. Click a row to view the full instrument record.

### View instrument details

1. Click a row in the instruments table.
2. The detail panel will show:
   - **Identifiers** — ISIN, CUSIP, SEDOL, and internal identifier.
   - **Classification** — asset class, instrument type, and sub-type.
   - **Issuer** — name, LEI, and domicile of the issuing entity.
   - **Settlement details** — settlement currency, settlement method, and clearing system.

### Customise columns

1. Click the **Columns** button in the page header.
2. Toggle columns on or off to show the fields most relevant to you.
3. Click **Save as default** to persist your selection.

## Planned fields

| Field | Description | Example |
| --- | --- | --- |
| ISIN | International Securities Identification Number (ISO 6166) | `GB0002634946` |
| CUSIP | North American securities identifier | `037833100` |
| SEDOL | Stock Exchange Daily Official List identifier | `B7TL820` |
| Name | Instrument name or description | `Apple Inc Common Stock` |
| Asset Class | Top-level asset classification | `Equity` |
| Instrument Type | More specific classification | `Ordinary Share` |
| Issuer Name | Name of the issuing entity | `Apple Inc` |
| Issuer LEI | LEI of the issuing entity | `HWUPKR0MPOU8FGXBT394` |
| Currency | Settlement currency | `USD` |
| Status | Current status of the instrument record | `ACTIVE` |

## Related tasks

- [Accounts](./accounts) — account static data linked to instruments.
- [LEI Records](./lei-records) — LEI data for instrument issuers.
- [Data Dictionary](../reference/data-dictionary) — field definitions for instrument records.
