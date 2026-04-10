# Sync Triggers

## Goal

Manually trigger a data synchronisation for LEI or master data when needed outside the normal
daily schedule.

## Prerequisites

- You are signed in to Axiom with the **Admin** role.

## Background

Axiom runs an automated daily sync at 2 AM to pull the latest data from GLEIF and other upstream
sources. Use a manual sync trigger when:

- An urgent data update is required before the next scheduled sync.
- A scheduled sync has failed and needs to be re-run.
- You are setting up a new environment and need to populate data immediately.
- An upstream data source has published a correction that you need to apply sooner.

The LEI sync automatically pre-synchronises four GLEIF reference code lists (registration
authorities, entity legal forms, organizational roles, and legal jurisdictions) before processing
LEI Level 1/2 data. These reference lists ensure coded fields in LEI records display their
full human-readable names in the UI.

## Steps

### Trigger a sync

1. Click **Admin** in the top navigation.
2. Select **Sync Triggers** from the admin menu.
3. The page lists available sync jobs, for example **LEI Full Sync** or **Master Data**.
4. Review the **Last Run** and **Status** columns to see when each job last ran and whether it
   succeeded.
5. Click **Trigger Sync** next to the job you want to run.
6. A confirmation prompt appears. Click **Confirm** to proceed.
7. The job status changes to `IN_PROGRESS`.

### Monitor sync progress

After triggering a sync:

1. Stay on the Sync Triggers page. The status column updates automatically.
2. The status will transition through `IN_PROGRESS` → `COMPLETED` (or `FAILED`).
3. If the job reaches `FAILED`, review the failure category shown on the page and check with
   your data operations team if the issue persists.

### Re-run a failed sync

1. Locate the failed sync job on the Sync Triggers page.
2. Click **Trigger Sync** to start a new run.
3. If failures recur, escalate to your Axiom administrator or support team.

## Expected result

The sync job completes with status `COMPLETED`. Updated data is available in the relevant module
(for example, new or amended LEI records appear in the [LEI Records](../workflows/lei-records)
page).

## Common issues

| Issue | Possible cause | Resolution |
| --- | --- | --- |
| Sync shows FAILED immediately | Upstream source is unavailable | Wait a few minutes and try again; check GLEIF status if LEI sync |
| Status does not update | Page may not be auto-refreshing | Manually refresh the page |
| Trigger button is disabled | Another sync for that job is already running | Wait for the current run to complete |
| Data not appearing after COMPLETED | Cache delay or delta processing | Allow a few minutes; hard-refresh the target module page |

## Related tasks

- [LEI Records](../workflows/lei-records) — view LEI data after a sync completes.
- [Statuses & States](../reference/statuses-and-states) — file processing status values.
- [Permissions & Roles](../reference/permissions-and-roles) — admin role required.
