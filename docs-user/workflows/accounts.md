# Accounts

## Goal

View and search account static data in Axiom.

## Prerequisites

- You are signed in to Axiom. See [Sign In & Access](../getting-started/sign-in-and-access).
- Your role includes access to the **Accounts** module.

## Current status

The Accounts module is currently in development. When you navigate to **Accounts**, you will see
a **Coming Soon** card indicating that the feature is not yet available for general use.

This page documents the planned behaviour so you know what to expect when the module is released.

## Planned workflow

### Search for an account

1. Click **Accounts** in the top navigation.
2. Use the **Search** bar to find an account by name, account number, or internal reference.
3. Results appear in the table. Click a row to view the full account record.

### View account details

1. Click a row in the accounts table.
2. The detail panel will show:
   - **Account identifiers** — account number, internal reference, and BIC.
   - **Account holder** — entity name and LEI.
   - **Settlement details** — linked settlement instructions and default currency.
   - **Status and dates** — account status and effective date range.

### Navigate to linked SSI records

From the account detail panel, you will be able to navigate directly to associated Standard
Settlement Instructions (SSI) for that account.

### Customise columns

1. Click the **Columns** button in the page header.
2. Toggle columns on or off to focus on the most relevant fields.
3. Click **Save as default** to persist your column selection.

## Planned fields

| Field | Description | Example |
| --- | --- | --- |
| Account Number | Primary account identifier | `DE89370400440532013000` |
| Account Name | Descriptive name for the account | `EUR Nostro Account` |
| BIC | Bank Identifier Code of the account holding institution | `DEUTDEDB` |
| Currency | Account settlement currency | `EUR` |
| Account Holder | Name of the entity that owns the account | `Global Markets AG` |
| Account Holder LEI | LEI of the account holder | `5493001KJTIIGC8Y1R12` |
| Status | Current status of the account record | `ACTIVE` |
| Effective Date | Date from which the account is valid | `2024-01-01` |

## Related tasks

- [Instruments](./instruments) — financial instrument data linked to accounts.
- [SSI](./ssi) — standard settlement instructions associated with accounts.
- [Data Dictionary](../reference/data-dictionary) — field definitions for account records.
