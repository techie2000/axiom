# Common Errors

This page lists common errors users encounter in Axiom and how to resolve them.

## Authentication errors

| Error | Cause | Resolution |
| --- | --- | --- |
| "Invalid credentials" | Wrong email or password | Check your email and password; passwords are case-sensitive |
| "Account pending approval" | New account awaiting admin review | Contact your Axiom administrator |
| "Session expired" | Your session timed out | Sign in again |
| Redirect loop on login | Cookie or session conflict | Clear your browser cookies and try again |
| Registration confirmation email not received | Email delivery issue or spam filter | Check your spam folder; contact your administrator |

## Search and data errors

| Error | Cause | Resolution |
| --- | --- | --- |
| "No results found" | Search term too specific or misspelled | Try a shorter or partial search term |
| Stale or outdated data | Daily sync not yet completed | Data syncs at 2 AM; check the last updated timestamp |
| Table not loading | Network connectivity issue | Refresh the page; check your internet connection |
| Record count differs from source | Delta records may be queued | Axiom performs a daily full sync; allow up to 24 hours |
| Columns missing from the table | Columns are hidden in your selection | Open the Columns panel and enable the missing columns |

## LEI Records errors

| Error | Cause | Resolution |
| --- | --- | --- |
| LEI code returns no results | The code may be invalid or the record is not yet synced | Verify the code on the GLEIF portal; check the last sync date |
| Record shows LAPSED status | LEI registration has expired | Contact the entity to renew their LEI registration |
| Other names section is empty | Entity has no alternative names on file at GLEIF | This is normal; data reflects the GLEIF registry |

## SSI errors

| Error | Cause | Resolution |
| --- | --- | --- |
| SSI not found | Record may be inactive or not yet loaded | Try searching with a partial name; check if the status filter is set |
| Missing columns | Columns may be hidden | Open the Columns panel and enable the columns you need |

## Preferences and display errors

| Error | Cause | Resolution |
| --- | --- | --- |
| Column preferences not saved | Browser local storage may have been cleared | Re-open the Columns panel and click Save as default again |
| Language reverts after reload | Preference not persisted to your profile | Ensure you are signed in; save the preference while logged in |
| Dark/light mode reverts | Theme preference not saved | Toggle the theme; if signed in your preference is saved automatically |

## Admin errors

| Error | Cause | Resolution |
| --- | --- | --- |
| Sync shows FAILED | Upstream data source unavailable | Wait a few minutes and re-trigger the sync |
| Translation not appearing after approval | Browser cache serving old strings | Ask the affected user to hard-refresh their browser |
| Cannot approve user | Session may have expired | Refresh the page and sign in again if required |

## Related pages

- [Sign In & Access](../getting-started/sign-in-and-access)
- [FAQ](./faq)
