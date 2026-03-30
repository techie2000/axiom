# LEI Records

## Goal

Search and view Legal Entity Identifier (LEI) records sourced from the GLEIF global registry.

## Prerequisites

- You are signed in to Axiom. See [Sign In & Access](../getting-started/sign-in-and-access).
- Your role includes access to the **LEI Records** module.

## What is an LEI?

A Legal Entity Identifier (LEI) is a 20-character, alphanumeric code that uniquely identifies legal
entities in financial transactions. LEI data is published by GLEIF (Global Legal Entity Identifier
Foundation) and updated daily.

Axiom synchronises the full GLEIF dataset (3.2 million+ records) and makes it searchable in real time.

## Steps

### Search for an LEI record

1. Click **LEI Records** in the top navigation.
2. Use the **Search** bar to search by:
   - LEI code (20-character identifier)
   - Legal name
3. Results appear in the table below the filter bar.

### Filter LEI records

Use the filter controls to narrow results:

- **Status** — filter by entity status (`ACTIVE`, `INACTIVE`, `ANNULLED`, `DUPLICATE`,
  `LAPSED`, `MERGED`, `RETIRED`, `TRANSFERRED`).
- **Country** — filter by the entity's legal registration country.
- **Category** — filter by entity category (`BRANCH`, `FUND`, `SOLE_PROPRIETOR`, or general).

Multiple filters can be active at the same time. Click **Clear Filters** to reset all filters.

### View LEI record details

1. Click a row in the LEI Records table.
2. A detail panel opens showing:
   - **Entity information** — legal name, legal form (with full name where available), status, and category.
   - **Registered address** — street, city, region, postal code, and country.
   - **Headquarters address** — if different from registered address.
   - **Registration details** — registration authority (with full organisation name where available),
     registration number, and initial registration date.
   - **Relationship data** — managing LOU (Legal Operating Unit), relationship status, and validation status.
   - **Other names** — previous legal names or trading names if available.
3. Click **Close** or press **Escape** to dismiss the panel.

### Customise visible columns

1. Click the **Columns** button in the page header.
2. Check or uncheck columns to adjust what is displayed in the table.
3. Click **Save as default** to persist your column selection.

### Adjust page width

Click the **Expand / Normal** toggle in the page header to switch between a wider table view
(recommended for LEI Records due to the number of available columns) and a standard width.

## Expected result

You can find any LEI record by name or code, filter results to a relevant subset, and view the
full entity details.

## Common issues

| Issue | Possible cause | Resolution |
| --- | --- | --- |
| No results returned | Search term is too narrow or contains a typo | Try a partial name or the full LEI code |
| Record shows stale data | Daily sync may not have run yet | Data is updated once per day; check the last sync date |
| Some columns are missing | They may be hidden in your column selection | Open the Columns panel and enable them |
| Record count differs from GLEIF | Delta records may be queued | Axiom performs a daily full sync at 2 AM |

## Related tasks

- [Navigation Basics](../getting-started/navigation-basics) — customise columns and page width.
- [Data Dictionary](../reference/data-dictionary) — definitions of LEI fields.
- [Statuses & States](../reference/statuses-and-states) — entity and registration status definitions.
