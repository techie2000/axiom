# Provisional LEI

## Goal

Issue and manage Axiom provisional LEI records for entities that do not yet have an official GLEIF LEI.

## Prerequisites

- You are signed in to Axiom with an **Admin** role.
- You can access **Admin → Provisional LEIs**.
- If you plan to complete succession, you have the official LEI value ready.

## When to use this page

Use **Provisional LEI** when onboarding or linking an entity that needs a temporary identifier before an
official LEI is available.

Provisional records:

- are flagged as provisional in Axiom,
- can be edited while active,
- can be linked later to the final official LEI.

## Steps

### Create a provisional LEI

1. Open **Admin → Provisional LEIs**.
2. Click **New Provisional LEI**.
3. Enter at minimum:
   - **Legal Name** (required)
   - **Source** (recommended, for auditability)
   - **Country / City / Jurisdiction** (recommended)
4. Click **Save**.

Expected result: A new row appears with a generated LEI, status, source, and date fields.

### Edit an existing provisional LEI

1. Find the record in the table.
2. Open actions using either:
   - **Edit** in the row action buttons, or
   - **Right-click** the row and choose **Edit**.
3. Update the fields you need (for example legal name, status, source, location values).
4. Click **Save**.

Expected result: The row updates and the change is visible in the table.

### Clone a provisional LEI

Use clone to speed up entry when creating entities with similar details.

1. Find a similar record in the table.
2. Open actions using either:
   - **Clone** in the row action buttons, or
   - **Right-click** the row and choose **Clone**.
3. Review and adjust prefilled values in the create form.
4. Click **Save**.

Expected result: A new provisional LEI is created using the copied values as a starting point.

### Link a provisional LEI to an official LEI

1. In the row for the provisional record, open actions using either:
   - **Link to Official LEI** in the row action buttons, or
   - **Right-click** the row and choose **Link to Official LEI**.
2. Enter the 20-character official LEI.
3. Save the action.

Expected result: The record stores the successor LEI reference and is marked as merged/succeeded.

## Table controls

The provisional table supports the same usability controls as other data tables:

- **Columns**: choose visible columns.
- **Expanded / Normal**: switch page width for dense tables.
- **Display: Codes / Names**: toggle location rendering where name metadata exists.

Each control supports **Save as default** with undo, so personal preferences persist.

### Columns selector behavior

The columns selector supports grouped toggles matching LEI Records behavior:

- Group header rows show tri-state selection (`☑`, `◐`, `☐`).
- Group header rows show selected/total counts (for example `3/7`).
- **Select All** and **Reset to Default** controls are available in the selector header.
- **Parent LEI** is included in the default visible column set.

### Sort

Click any column heading to sort the table by that column. Click again to reverse the direction.
An arrow indicator shows the active sort column and direction.

### Filter

A filter bar is shown above the table. Use it to narrow the displayed records:

- **Search** — matches against legal name, LEI code, source, or notes (case-insensitive).
- **Status** — restricts results to a specific entity status (Active, Inactive, or Merged).
- **Source** — filters to records from a specific provisioning source.
- **Country** — filters to legal address country code/name (for example show only `GB`).

When one or more filters are active, a **Clear Filters** button resets all filters at once.
The record count in the header updates to show how many records match the current filters.

### Parent LEI and Child LEI columns

The **Parent LEI** and **Child LEI** columns display relationship data drawn from the LEI level-2
relationship records. These values are hydrated at query time and may be blank if no relationship
record exists for that provisional entity.

## Common issues

| Issue | Likely cause | Resolution |
| --- | --- | --- |
| Record saves but some values look blank in table | Column is hidden | Open **Columns** and enable the field |
| Cannot create record | Missing required legal name or API validation failure | Provide legal name and verify input format |
| Link to official LEI fails | Official LEI not found or invalid | Verify LEI exists in official LEI records first |

## Related tasks

- [LEI Records](../workflows/lei-records) — search official LEI data.
- [User Approvals](./user-approvals) — manage admin access.
- [Data Dictionary](../reference/data-dictionary) — field definitions.
