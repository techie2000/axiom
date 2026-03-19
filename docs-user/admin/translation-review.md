# Translation Review

## Goal

Review and approve (or reject) community-submitted translations for the Axiom interface.

## Prerequisites

- You are signed in to Axiom with the **Admin** role.

## Background

Axiom supports multiple display languages. When a user submits a translation for a UI string, it
enters a **pending** review queue. An admin must approve each submission before it becomes live in
the interface. Rejected submissions are not shown to end users.

## Steps

### View pending translations

1. Click **Admin** in the top navigation.
2. Select **Translations** from the admin menu.
3. The page shows a list of translation submissions grouped by language.
4. The **Status** column shows whether each item is `pending`, `approved`, or `rejected`.

### Approve a translation

1. Locate the pending translation you want to approve.
2. Review the **Key**, **Language**, and **Proposed Value** columns to confirm accuracy.
3. Click **Approve**.
4. The status changes to `approved`. The translation will appear in the interface on the next
   page refresh for users with that language selected.

### Reject a translation

1. Locate the pending translation you want to reject.
2. Click **Reject**.
3. Optionally add a rejection note to explain the reason.
4. The status changes to `rejected`. The translation is not applied to the interface.

### Filter by language or status

Use the filter controls at the top of the page to:

- Show only translations for a specific language.
- Show only `pending`, `approved`, or `rejected` items.

Click **Clear Filters** to reset to the full list.

## Expected result

Approved translations are live for users who have selected the corresponding language.
Rejected translations are recorded for audit purposes but are not displayed.

## Common issues

| Issue | Possible cause | Resolution |
| --- | --- | --- |
| No pending translations listed | All submissions have already been reviewed | Check the status filter; it may be set to Pending only |
| Translation looks incorrect after approval | The submitted value contained an error | Reject and ask the contributor to resubmit |
| Changes not visible immediately | Browser may be serving cached strings | Ask the user to hard-refresh their browser |

## Related tasks

- [User Approvals](./user-approvals) — approve new user registrations.
- [Permissions & Roles](../reference/permissions-and-roles) — admin role requirements.
