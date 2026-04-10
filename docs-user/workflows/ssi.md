# Settlement Instructions (SSI)

## Goal

View and work with Standard Settlement Instructions (SSI) records in Axiom.

## Prerequisites

- You are signed in to Axiom. See [Sign In & Access](../getting-started/sign-in-and-access).
- Your role includes access to the **SSI** module.

## What are SSIs?

Standard Settlement Instructions (SSI) are pre-agreed payment and delivery instructions used in
financial transactions. They specify where assets or cash should be delivered for a given
counterparty and asset type, eliminating the need to exchange this information on each trade.

## Steps

### View SSI records

1. Click **SSI** in the top navigation.
2. The SSI list page shows all settlement instructions you have access to.
3. Each row shows the key fields: counterparty, currency, settlement method, and status.

### Search and filter SSIs

Use the controls in the filter bar to narrow results:

- **Search** — type a counterparty name or reference code.
- **Currency** — filter by the settlement currency.
- **Status** — filter by the instruction status (`ACTIVE`, `INACTIVE`, `PENDING`).

Click **Clear Filters** to reset all active filters.

### View SSI details

1. Click a row to open the detail view.
2. The panel shows:
   - **Counterparty information** — name, LEI, and BIC.
   - **Settlement details** — settlement method, currency, and clearing system.
   - **Beneficiary bank** — account details for the receiving institution.
   - **Intermediary bank** — if applicable.
   - **Status and dates** — effective date, expiry date, and current status.
3. Press **Escape** or click **Close** to dismiss the panel.

### Customise columns

1. Click the **Columns** button in the page header to open the column selector.
2. Toggle columns on or off.
3. Click **Save as default** to persist your selection across sessions.

## Expected result

You can find SSI records for a given counterparty and currency, and view the full settlement
instruction details.

## Common issues

| Issue | Possible cause | Resolution |
| --- | --- | --- |
| SSI not found | The record may be inactive or not yet loaded | Try searching with a partial name; check if the status filter is set |
| Missing columns | Columns may be hidden | Open the Columns panel and enable the columns you need |
| Stale data | Records may have been recently updated | Refresh the page or trigger a manual sync (admin role required) |

## Related tasks

- [Data Dictionary](../reference/data-dictionary) — definitions for SSI fields.
- [Navigation Basics](../getting-started/navigation-basics) — customise your view.
