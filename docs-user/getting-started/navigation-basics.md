# Navigation Basics

## Goal

Understand the layout of the Axiom application and move confidently between sections.

## Prerequisites

- You are signed in to Axiom. See [Sign In & Access](./sign-in-and-access).

## Application layout

Axiom uses a consistent layout on every page:

| Area | Description |
| --- | --- |
| **Top navigation bar** | Logo, main section links, and your user profile menu |
| **Page header** | Title, subtitle, and page-level actions (for example, Refresh or Columns) |
| **Filter bar** | Search and filter controls specific to the current page |
| **Data table** | Main content area showing records |
| **Pagination controls** | Navigate between pages of results |

## Main navigation sections

The top navigation bar contains links to each module. The modules you see depend on your role.

| Section | What it contains |
| --- | --- |
| Dashboard | Summary cards and quick links |
| Countries | ISO 3166 country reference data |
| Currencies | ISO 4217 currency reference data |
| Languages | BCP 47 language reference data |
| LEI Records | Legal Entity Identifier data from GLEIF |
| Instruments | Financial instrument master data |
| Accounts | Account static data |
| SSI | Standard Settlement Instructions |
| Admin | User and system administration (admin role required) |

## Personalising your experience

### Change the display language

1. Click your user profile in the top-right corner.
2. Select **Language** from the dropdown.
3. Choose your preferred language. The change applies immediately.

### Toggle light/dark mode

1. Click the theme toggle icon (🌙 / ☀️) in the top navigation bar.
2. The interface switches between light and dark mode. Your preference is saved automatically.

### Adjust column visibility

On list pages (for example, LEI Records or Countries):

1. Click the **Columns** button in the page header.
2. Check or uncheck columns to show or hide them.
3. Click **Save as default** to persist your selection across sessions.

### Expand or narrow the page width

1. Click the **Expand / Normal** toggle in the page header to switch between a wider and narrower
   table view.
2. Your preferred width is saved automatically.

## Searching this documentation

The documentation site has a built-in full-text search you can open from anywhere using a keyboard shortcut.

| Platform | Shortcut |
| --- | --- |
| macOS | **⌘ K** (Command + K) |
| Windows / Linux | **Ctrl + K** |

Pressing the shortcut opens a search modal. Type your query and the results update instantly across all
documentation pages. Use the **↑** and **↓** arrow keys to move between results, press **Enter** to open a result,
and press **Escape** to close the search modal without navigating away.

You can also open the search modal by clicking the **Search** button that appears in the top navigation bar of the
documentation site.

## Searching and filtering application data

Most list pages in the Axiom application provide a search bar and filter controls:

- **Search** — type to filter records by name or code.
- **Filters** — use dropdowns to narrow results by status, country, or other attributes.
- **Clear Filters** — reset all active filters at once.

Results update automatically as you type or change filters.

## Keyboard shortcuts

Axiom provides keyboard shortcuts to speed up navigation and data entry.
The shortcuts are consistent across all pages that support the corresponding feature.

| Shortcut | Action | Pages |
| --- | --- | --- |
| **Ctrl+F** / **⌘F** | Focus the search input | Code Mappings, Countries, Currencies, Languages, LEI Records, Admin → Translations |
| **Esc** | Close the top-most open panel or dropdown | All pages with overlays |

> **Note:** Pressing **Ctrl+F** / **⌘F** on a page that has a search bar will focus that bar and
> select any existing text, so you can start typing immediately. The browser's built-in
> find-in-page dialog is suppressed on these pages.

## Expected result

You can navigate to any module you have access to and locate records using search and filters.

## Common issues

| Issue | Possible cause | Resolution |
| --- | --- | --- |
| A module is not visible in the menu | You may not have the required role | Contact your administrator |
| Saved column preferences are not applied | Browser storage may be cleared | Re-save your preferences |
| Language reverts after logout | Preference not saved to your profile | Ensure you are logged in before saving preferences |

## Related tasks

- [LEI Records](../workflows/lei-records) — search and view Legal Entity Identifier data.
- [Sign In & Access](./sign-in-and-access) — return to login help.
