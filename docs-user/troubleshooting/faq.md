# FAQ

Frequently asked questions about Axiom.

## General

**Q: What is Axiom?**

Axiom is a financial services static data management platform that provides reference data for
countries, currencies, legal entities, financial instruments, accounts, and settlement instructions.

**Q: Who can use Axiom?**

Access is restricted to registered and approved users. Contact your administrator to request access.

**Q: How do I change the display language?**

Click your user profile in the top-right corner and select your preferred language. See
[Navigation Basics](../getting-started/navigation-basics) for details.

**Q: How often is LEI data updated?**

LEI data is synchronised from GLEIF once per day at 2 AM. The dataset contains 3.2 million+
records.

**Q: How do I report a data error?**

If you believe a record contains incorrect data, contact your Axiom administrator. Note that LEI
data is sourced from GLEIF and can only be corrected at the source.

## Access and accounts

**Q: How do I register for an account?**

Click **Sign In** on the Axiom login page, then follow the link to register a new account.
Your registration will be reviewed and approved by an administrator before you can sign in.
See [Sign In & Access](../getting-started/sign-in-and-access).

**Q: How long does account approval take?**

This depends on your organisation's process. Contact your Axiom administrator if your account
remains in Pending status for an extended period.

**Q: I forgot my password. How do I reset it?**

Use the **Forgot password** link on the login page to request a password reset email.

**Q: Can I use Axiom in a language other than English?**

Yes. Axiom supports multiple display languages. Click your user profile and select a language.
Available languages include English, French, German, Spanish, Italian, Dutch, Portuguese, Japanese,
Chinese, and Arabic.

## Data and search

**Q: How do I search within this documentation?**

Press **⌘ K** (macOS) or **Ctrl + K** (Windows / Linux) anywhere in the documentation site to open the
search modal. Type your query to instantly search across all pages. Use arrow keys to navigate results, press
**Enter** to open a page, and press **Escape** to close the modal. You can also click the **Search** button in the
top navigation bar of the documentation site.

**Q: Why does my search return no results?**

Try a shorter or partial search term. For LEI records, ensure the LEI code is exactly 20
characters. For countries, try the alpha-2 code (for example, `GB`) instead of the full name.

**Q: Why does the record count differ from what I see on the GLEIF portal?**

Axiom performs a daily full sync. Records published or updated after the last sync will appear
the following day. Admin users can trigger a manual sync if an urgent update is needed.

**Q: Can I export data from Axiom?**

Export functionality is not available in the current version. Contact your administrator if you
need bulk data access.

**Q: Why is a country or currency not showing in the list?**

Some records may be set to inactive. Check whether any filters are active; click **Clear Filters**
to show all records.

## Interface and preferences

**Q: How do I save my column preferences?**

Open the **Columns** panel on any list page, adjust your selection, then click **Save as default**.
Your preferences are stored on your account and apply across devices.

**Q: Why did my saved preferences reset?**

Preferences are saved to your user account and require you to be signed in. If you were not signed
in when saving, the preference was stored locally and may have been cleared with your browser data.

**Q: What does the Expand / Normal toggle do?**

It switches the page between a wider full-width table layout and a standard narrower layout. On
pages with many columns (such as LEI Records), the expanded view is recommended.

**Q: How do I switch between light and dark mode?**

Click the theme toggle icon (🌙 / ☀️) in the top navigation bar. Your preference is saved
automatically.

## Admin

**Q: How do I approve a new user?**

Go to **Admin → User Approvals** and click **Approve** next to the user. See
[User Approvals](../admin/user-approvals) for the full workflow.

**Q: How do I trigger a manual data sync?**

Go to **Admin → Sync Triggers**, select the dataset, and click **Trigger Sync**. See
[Sync Triggers](../admin/sync-triggers) for details.

**Q: What happens if a sync fails?**

The sync status changes to `FAILED`. You can re-trigger the sync from the Sync Triggers page.
If failures persist, contact your support team.

## Related pages

- [Common Errors](./common-errors)
- [Navigation Basics](../getting-started/navigation-basics)
