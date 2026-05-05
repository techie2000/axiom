# User-Entity Links

## Goal

Grant and manage entity-scoped access links between users and LEI entities.

## Prerequisites

- You are signed in to Axiom with an **Admin** role.
- You can access **Admin → User-Entity Links**.
- You know the target user and LEI before granting access.

## When to use this page

Use **User-Entity Links** when you need to:

- grant a user access to a specific LEI entity,
- update role, expiry, or notes for an existing link,
- revoke access that is no longer valid,
- restore a link that was revoked by mistake.

## Steps

### Grant a new link

1. Open **Admin → User-Entity Links**.
2. Click **Grant Access**.
3. Select a user.
4. Enter a valid 20-character LEI.
5. Choose role and optional expiry date.
6. Optional: select **Entity hierarchy scope** to include child entities (direct or all descendants).
7. Add notes if needed.
8. Click **Grant**.

Expected result: A new active link appears in the table.

#### Understanding Entity Hierarchy Scope

- **None (entity only)**: Access is limited to the named entity only.
- **Direct children only**: Access includes the entity and its immediate children (one level deep).
- **All descendants**: Access includes the entity and all descendants (full tree hierarchy).

**Privilege precedence**: When a user has multiple roles across a parent and child
entity (for example, `entity_admin` at parent, `viewer` at child), the **most restrictive role
applies** at that level. In this example, the user would be a `viewer` when accessing
the child entity.

### Edit an existing link

1. Find the link in the table.
2. Open actions using either:
   - **Edit** in the row action buttons, or
   - **Right-click** the row and choose **Edit**.
3. Update role, expiry date, children scope (`none`, `direct`, or `all`), or notes.
4. Click **Save**.

Expected result: The row reflects updated values.

### Revoke a link

1. Find the link in the table.
2. Open actions using either:
   - **Revoke** in the row action buttons, or
   - **Right-click** the row and choose **Revoke**.
3. Confirm the action.

Expected result: The link is marked revoked and is excluded when **Active only** is enabled.

### Unrevoke a link

1. Find a revoked link in the table (toggle **Active only** off if needed).
2. Open actions using either:
   - **Unrevoke** in the row action buttons, or
   - **Right-click** the row and choose **Unrevoke**.
3. Confirm the action.

Expected result: The link is restored and becomes active again if it has not expired.

## Table controls

- **Filter by User ID**: show links for a specific user.
- **Filter by LEI**: show links for a specific LEI.
- **Active only**: toggle between only active links and all links (including revoked).
- **Status** column: shows whether links are `active`, `expired`, or `revoked`.

## Validation behavior

- LEI values are validated when granting access.
- If a 20-character LEI is not found, an inline error is shown.
- The **Grant** button remains disabled until the LEI is valid and found.
- Expiry dates must use `yyyy-mm-dd` format.
- If user lookup is unavailable, you can still provide a valid user ID directly.

## Common issues

| Issue | Likely cause | Resolution |
| --- | --- | --- |
| Grant fails for LEI | LEI is invalid or not found | Verify LEI exists and has 20 characters |
| Date rejected | Wrong date format | Use `yyyy-mm-dd` |
| User list empty | Authorization/API issue | Re-authenticate as admin and retry |

## Related tasks

- [User Approvals](./user-approvals) — approve newly registered users.
- [Provisional LEI](./provisional-lei) — manage provisional LEI lifecycle.
- [LEI Records](../workflows/lei-records) — review official LEI records.
