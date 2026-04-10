# Currencies

## Goal

Browse and search ISO 4217 currency reference data in Axiom, including compliance flags.

## Prerequisites

- You are signed in to Axiom. See [Sign In & Access](../getting-started/sign-in-and-access).

## Steps

### Search for a currency

1. Click **Currencies** in the top navigation.
2. Type in the **Search** bar to filter by currency name, code, or symbol.
3. Results update automatically as you type.

### Filter by compliance category

The stats cards at the top of the page show compliance-related counts. Click a card to filter:

- **ALERT CLS Allowed** — shows only currencies permitted in CLS (Continuous Linked Settlement).
- **OFAC Sanctioned** — shows currencies associated with OFAC-sanctioned jurisdictions.

Click the active card again to deactivate the filter and return to the full list.

### View currency details

1. Click any row in the currencies table to see the detail view.
2. Review compliance flags and decimal precision.
3. Press **Escape** or click **Close** to dismiss the panel.

### Adjust page width

Click the **Expand / Normal** toggle in the page header to switch between wider and standard table
width. Your preference is saved automatically.

## Fields

| Field | Description | Example |
| --- | --- | --- |
| Code | Three-letter ISO 4217 currency code | `USD` |
| Name | Official currency name | `US Dollar` |
| Symbol | Currency symbol | `$` |
| Decimals | Number of decimal places (minor unit) | `2` |
| ALERT CLS Allowed | Whether the currency is eligible for CLS settlement | `Yes` |
| OFAC Sanctioned | Whether the currency is associated with OFAC sanctions | `No` |

## Expected result

You can find any ISO 4217 currency by name, code, or symbol, review its decimal precision, and
check its compliance classification at a glance.

## Common issues

| Issue | Possible cause | Resolution |
| --- | --- | --- |
| Currency not found | Code or symbol does not match | Try the three-letter ISO code (for example, `EUR`) |
| ALERT CLS filter shows unexpected results | Some currencies have special CLS eligibility rules | Refer to CLS Bank documentation for authoritative data |
| Decimal digits show zero | Some currencies have no minor unit (for example, JPY) | This is expected for zero-decimal currencies |

## Related tasks

- [Countries](./countries) — country reference data including currency codes used per country.
- [SSI](./ssi) — settlement instructions reference currencies.
- [Data Dictionary](../reference/data-dictionary) — definitions for all currency fields.
