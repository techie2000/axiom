# Entities

## Goal

View and search legal entity master data in Axiom.

## Prerequisites

- You are signed in to Axiom. See [Sign In & Access](../getting-started/sign-in-and-access).
- Your role includes access to the **Entities** module.

## Background

An entity in Axiom represents a legal organisation or company as defined in your firm's master data.
Each entity can be linked to one or more LEI (Legal Entity Identifier) records sourced from GLEIF,
providing a globally recognised identifier for use in financial transactions and regulatory reporting.

## Steps

### Search for an entity

1. Click **Entities** in the top navigation.
2. Use the **Search** bar to filter entities by name or internal identifier.
3. Results update automatically as you type.

### Filter entities

Use the filter controls in the filter bar to narrow the entity list:

- **Status** — filter by entity status (`ACTIVE`, `INACTIVE`, and others as applicable).

Click **Clear Filters** to reset all active filters.

### View entity details

1. Click a row in the entity table to open the detail panel.
2. The panel shows:
   - **Entity information** — name, status, and internal identifiers.
   - **LEI data** — associated LEI code and key GLEIF data if an LEI is linked.
3. Press **Escape** or click **Close** to dismiss the panel.

### Navigate to the linked LEI record

If the entity has an associated LEI, click the LEI code in the detail panel to jump directly to
the full LEI record in the [LEI Records](./lei-records) module.

## Fields

| Field | Description | Example |
| --- | --- | --- |
| Name | Legal name of the entity | `Acme Trading Ltd` |
| Status | Current operational status | `ACTIVE` |
| LEI | Linked 20-character Legal Entity Identifier | `2138005O9XJIJN4JPN90` |
| Internal ID | Firm-assigned internal identifier | `ENT-0042` |

## Expected result

You can find any entity by name, check its current status, and navigate to the associated GLEIF
LEI record when an LEI is available.

## Common issues

| Issue | Possible cause | Resolution |
| --- | --- | --- |
| Entity not found | Search term too specific or entity is inactive | Try a shorter partial name; check the Status filter |
| No LEI shown | The entity may not yet have an LEI assigned | Contact your data operations team |
| Status filter not narrowing results | Filter may not be active | Confirm the filter dropdown shows the expected value |

## Related tasks

- [LEI Records](./lei-records) — search the full GLEIF LEI dataset.
- [Data Dictionary](../reference/data-dictionary) — field definitions for entity records.
- [Statuses & States](../reference/statuses-and-states) — entity status values and meanings.
