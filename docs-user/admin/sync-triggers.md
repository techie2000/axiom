# Sync Triggers

## Goal

Manually trigger a data synchronisation for LEI or master data when needed outside the normal
daily schedule.

## Prerequisites

- You are signed in to Axiom with the **Admin** role.

## When to use this

Axiom runs an automated daily sync at 2 AM. Use a manual sync trigger when:

- An urgent data update is required before the next scheduled sync.
- A sync has failed and needs to be re-run.
- You are setting up a new environment and need to populate data immediately.

## Steps

1. Click **Admin** in the top navigation.
2. Select **Sync Triggers** from the admin menu.
3. Choose the dataset to sync (for example, **LEI Full Sync** or **Master Data**).
4. Click **Trigger Sync**.
5. Monitor the sync status on the page. The status updates automatically.

## Related tasks

- [LEI Records](../workflows/lei-records) — view LEI data after syncing.

> **Note:** This page is a stub. Full workflow documentation will be added in Phase 3.
