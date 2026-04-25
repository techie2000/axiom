# Frontend Agent Instructions

> **Read first:** Also consult the root [`AGENTS.md`](../AGENTS.md) for project-wide conventions,
> ADR standards, diagram guidelines, and PR/CI workflows.

This file provides frontend-specific coding standards for the Axiom Next.js/React frontend.
It is the canonical reference for AI agents working in the `frontend/` directory.

---

# Frontend and UI Development Guidelines

## Date and Time Formatting

### ISO 8601 Date Format (Required)

**Always use ISO 8601 date format (yyyy-mm-dd) for displaying dates to users.**

This international standard is unambiguous and widely recognized globally, avoiding confusion between DD/MM/YYYY
(European) and MM/DD/YYYY (American) formats.

#### ✅ CORRECT Examples

```typescript
// Date only (yyyy-mm-dd) with Go zero date handling
const formatDate = (dateString: string | null) => {
  if (!dateString || dateString.startsWith('0001-')) return '-'
  return new Date(dateString).toISOString().split('T')[0]
}
// Output: "2026-02-12" or "-" for invalid dates

// Date and time (yyyy-mm-dd HH:mm:ss) with Go zero date handling
const formatDateTime = (dateString: string | null) => {
  if (!dateString || dateString.startsWith('0001-')) return 'Never'
  return new Date(dateString).toISOString().replace('T', ' ').substring(0, 19)
}
// Output: "2026-02-12 14:30:45" or "Never" for invalid dates

// In React components - inline version
<td>
  {record.last_update_date && !record.last_update_date.startsWith('0001-')
    ? new Date(record.last_update_date).toISOString().split('T')[0]
    : '-'}
</td>
```

**Important**: Go's `time.Time` zero value serializes to `"0001-01-01T00:00:00Z"` instead of `null`.
Always check for dates starting with `'0001-'` and treat them as "no date" by displaying `-` or `Never`.

#### ❌ INCORRECT Examples

```typescript
// DON'T use locale-specific formatting
new Date(dateString).toLocaleDateString()  // ❌ Outputs: "2/12/2026" (ambiguous!)
new Date(dateString).toLocaleString()     // ❌ Locale-dependent
new Date(dateString).toDateString()       // ❌ Outputs: "Wed Feb 12 2026" (verbose)
```

### Number Formatting

For numbers (not dates), using `.toLocaleString()` is acceptable for thousand separators:

```typescript
// ✅ CORRECT for numbers
<p>{totalRecords.toLocaleString()}</p>  // 3,211,232
<p>{amount.toLocaleString()}</p>        // 1,234,567.89
```

## React and TypeScript Best Practices

### Component Structure

- Use functional components with TypeScript
- Define interfaces for all props and data structures
- Use `'use client'` directive when component needs client-side interactivity

### State Management

- Use `useState` for local component state
- Use `useEffect` for side effects and data fetching
- Clean up effects with return functions when necessary

### API Calls

- Always use environment variables for API base URLs
- Handle loading, error, and success states explicitly
- Use try-catch blocks for all async operations

```typescript
const API_BASE_URL = typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080')
  : 'http://backend:8080'
```

### Error Handling

- Display user-friendly error messages
- Differentiate between warning notices and critical errors
- Provide actionable guidance when possible

## Styling Guidelines

### Tailwind CSS Usage

- Use Tailwind utility classes consistently
- Follow the glassmorphism design pattern: `bg-white/5 backdrop-blur-sm border-2 border-white/10`
- Use opacity utilities for secondary text: `opacity-70`

### Dark Mode Support

- All components must support dark mode by default
- Use transparent backgrounds with opacity: `bg-white/5`
- Avoid hardcoded light-mode colors like `bg-white`, `bg-gray-50`, `text-gray-900`
- For dark utility panels, overlays, dropdowns, and dev helper surfaces, prefer `zinc`/`neutral`
  tokens (for example `dark:bg-zinc-900`, `dark:border-zinc-700`, `dark:text-zinc-100`) over cool
  `gray`/`slate` tones when a blue cast would conflict with the adopted black/grey visual direction.
- Include `<ThemeToggle />` component in page headers
- **Dropdowns/Select Elements**: Add explicit dark styling to both select and option elements:

  ```tsx
  <select className="bg-white/5 text-white border-white/20">
    <option className="bg-gray-800 text-white">Option 1</option>
    <option className="bg-gray-800 text-white">Option 2</option>
  </select>
  ```

### Theme Palette Consistency Standard (Required)

- New pages must follow the established app palette in both light and dark modes.
- Do not use page-local bright/legacy blue backgrounds for dark-mode page shells, cards, table containers, or filter bars.
- Prefer neutral dark surfaces consistent with existing pages, for example:
  - page shell: `dark:from-slate-950 dark:to-slate-900`
  - card/surface: `dark:bg-slate-900/60` with `dark:border-slate-700/50`
  - row hover: `dark:hover:bg-white/5` (or approved equivalent)
- Reserve blue for intent emphasis (primary actions, links, focus rings), not dominant dark-mode background surfaces.
- Before merge, compare new pages against reference pages (`lei-records`,
  `countries`, `currencies`, `languages`) in both themes.

### UI Element Visibility Checklist

**CRITICAL**: Always verify visibility when implementing or modifying UI elements. Complete this checklist for
EVERY visual change:

#### Mandatory Visibility Checks

- [ ] **Light Mode Visibility** - Verify all elements are clearly visible with sufficient contrast
  - Text colors must be dark enough on light backgrounds (`text-gray-900`, not `text-gray-500`)
  - Borders must be visible (`border-gray-200` minimum)
  - Shadows should enhance but not overwhelm (`shadow-sm`, `shadow-md`)
  - Status indicators (badges, icons) must stand out

- [ ] **Dark Mode Visibility** - Ensure elements don't disappear or blend into dark backgrounds
  - Text colors must be light enough (`text-gray-100`, `text-white`)
  - Borders need contrast (`border-white/10` minimum)
  - Backgrounds should use transparency for depth (`bg-white/5`, `bg-gray-800`)
  - Avoid pure black backgrounds (use `bg-gray-900` instead)

- [ ] **Color Contrast Ratios** - Meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
  - Use online contrast checkers for verification
  - Test with browser DevTools contrast inspection
  - Provide alternative indicators beyond color alone

- [ ] **Interactive Element States** - Test ALL states in both light and dark modes
  - Default state clearly visible
  - Hover state shows clear feedback (`hover:bg-blue-50`, `dark:hover:bg-white/5`)
  - Focus state visible for keyboard navigation (`focus:ring-2`, `focus:ring-blue-500`)
  - Disabled state clearly distinguishable (`disabled:opacity-50`, `disabled:cursor-not-allowed`)
  - Active/pressed state provides tactile feedback

- [ ] **Loading and Progress Indicators** - Ensure visibility during async operations
  - Spinners must be visible in both modes (use contrasting border colors)
  - Loading overlays should dim content but remain translucent (`bg-white/70`, `dark:bg-gray-900/70`)
  - Progress text must have strong contrast (`text-gray-900`, `dark:text-gray-100`)
  - Consider adding a container card for spinners (`bg-white`, `dark:bg-gray-800` with `shadow-lg`)

- [ ] **Status Badges and Indicators** - Clear visual distinction for all states
  - Active/success: `bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`
  - Warning: `bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200`
  - Error: `bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`
  - Inactive/neutral: `bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200`
  - Use icons alongside colors for better accessibility

- [ ] **Buttons and Clickable Areas** - Obvious interactivity in all modes
  - Primary buttons: Strong color contrast and clear borders
  - Secondary buttons: Visible outline or background
  - Links: Underline or distinct color with hover state
  - Icon buttons: Clear hover/focus indicators
  - Minimum touch target size: 44x44px for mobile

#### Common Visibility Issues to Avoid

❌ **Light Mode Issues**:

- Thin borders that disappear (`border-gray-100` too light)
- Gray text on white (`text-gray-400` insufficient contrast)
- Spinners with only `border-b-2` (not visible enough)
- Subtle shadows that don't provide depth

❌ **Dark Mode Issues**:

- White text on light gray backgrounds (insufficient contrast)
- Pure black backgrounds (`bg-black` too harsh)
- Missing borders on dark cards (elements blend together)
- Invisible focus indicators

#### Testing Tools

- Browser DevTools Inspector (Accessibility tab shows contrast ratios)
- WAVE browser extension for accessibility testing
- Manual testing: Toggle between light/dark modes for every change
- Test on actual devices when possible (not just DevTools responsive mode)

#### Example: Proper Loading Spinner Implementation

```tsx
{/* ✅ CORRECT: Visible in both modes */}
{loading && (
  <div
    className="absolute inset-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm z-50 flex items-center justify-center"
  >
    <div className="bg-white dark:bg-gray-800 px-6 py-4 rounded-lg shadow-lg border-2 border-blue-500">
      <div
        className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-400"
      ></div>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-2">
        Loading...
      </p>
    </div>
  </div>
)}

{/* ❌ INCORRECT: Not visible in light mode */}
{loading && (
  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
)}
```

### Responsive Design

- Use responsive grid classes: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Mobile-first approach with breakpoints
- Ensure tables are scrollable on mobile: `overflow-x-auto`

### Filter Bar Consistency (Required)

- Keep page structure consistent: **Header → Info/Error Alert (if any) → Stats Cards → Filter Bar → Data Table**.
- Do **not** place filter controls above stats cards on list/report pages.
- Filter controls must be wrapped in a visible bordered container (LEI pattern), e.g.
  `bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg p-6`.
- Provide a `Clear Filters` action whenever a page has two or more filters (search counts as a filter).
- Show `Clear Filters` only when at least one filter is active (LEI Records behavior).
- `Clear Filters` should reset all filter inputs to default values in one click.
- For dark mode readability, all `<select>` controls must style both the `<select>` and each `<option>` explicitly.
- Search inputs with long placeholder guidance must show a tooltip when placeholder text is clipped.
- Use shared component `frontend/app/components/SearchInputWithOverflowTooltip.tsx` for search/filter text inputs.
- Do not implement page-specific placeholder tooltip logic; keep behavior centralized and reusable.

### Column Selector Standard (Required)

- Any page with a `Columns` control must list **all table columns** (core + optional), not only optional columns.
- Core columns may be toggled off by users; preserve usability by defining a `defaultVisible`
  preset and a `Reset Default` action.
- Include `Select All` and `Reset Default` actions in the selector.
- The `Columns` count should reflect current visible column count.
- Use the LEI Records pattern as the baseline implementation for grouped or ungrouped column selectors.
- **Column visibility must be backed by `useUserPreference`** (see User Preference Standard below).
- All visible selector labels/actions must be rendered through i18n keys (`t('...')`).
  Do not hardcode user-facing labels such as `Save as default`, `Select All`, `Reset`, `Columns`, or group names.
- Keep icons/decorations outside translation keys where possible (e.g., render `aria-hidden` icon + translated text)
  so translators only translate semantic text.
- The selector header action row must use a stable split layout: left group for selection controls, right-aligned
  persistent save action. Avoid `ml-auto` + `flex-wrap` combinations that misalign under longer translations.
- Dark/light mode styling must be parity-tested for selector container, sticky header, action buttons, group headers,
  checkbox rows, hover/focus states, and scrollable regions. No page-specific theme shortcuts.
- Prefer a shared column selector component in `frontend/app/components/` for repeated selector UI patterns.
  If a page temporarily inlines selector markup, it must match the shared visual and accessibility behavior exactly.

### i18n Label Standard (Required)

Every user-visible label — including table column headers, modal field labels, detail-panel field
names, and dynamic label functions — **must** use `t('...')` with a key from `common.json`.
Do **not** hardcode English strings in JSX or in helper functions that compute labels.

**Column header labels** — When a `ColumnConfig.labelKey` already maps to the right translation key
(`leiRecords.columns.labels.*`), the default `return t(column.labelKey)` path in `getColumnLabel`
covers it. Do **not** add special-case `if (column.key === '…') return 'English literal'` branches
for columns whose `labelKey` is already correct.

**Modal / detail-panel labels** — Every `<span>` or `<label>` that names a field must use `t(...)`:

```tsx
// ❌ Hardcoded — will not be translated
<span className="...">Legal Jurisdiction</span>

// ✅ i18n — add key to common.json then use t()
<span className="...">{t('leiRecords.columns.labels.legalJurisdiction')}</span>
```

**Adding new fields**: when wiring a new column or modal field:

1. Add the translation key to `frontend/public/locales/en/common.json`
   under the appropriate namespace (e.g. `leiRecords.columns.labels.*`).
2. Set the column's `labelKey` to that full dotted key path.
3. Render via `t(column.labelKey)` (table) and `t('the.key')` (modal) — never a string literal.
4. Run `npm run i18n:verify` to confirm no missing keys.

### Table Width Toggle Standard (Required)

- Pages with wide data tables and optional columns must provide an `Expand/Normal` width toggle in the page header.
- Use `max-w-full` when expanded and `max-w-7xl` when normal, with `transition-all duration-300`
  for consistent behavior.
- Default to expanded width (`expandedWidth = true`) on pages where selected optional columns would
  otherwise force immediate horizontal scrolling.
- Keep horizontal scrolling as a fallback only; do not rely on horizontal scrolling as the primary
  way to access newly enabled columns.
- **Page width must be backed by `useUserPreference`** (see User Preference Standard below).

### User Preference Standard (Required)

Any page-level setting that a user may reasonably want preserved across sessions and devices
**must** be wired through the `useUserPreference` hook and accompanied by a `PreferenceSavePrompt`
toast. Currently mandatory for all pages that expose an `Expand/Normal` width toggle or a column
selector.

#### Key rules

- Import `useUserPreference` from `frontend/app/lib/useUserPreference.ts`.
- Import `PreferenceSavePrompt` from `frontend/app/components/PreferenceSavePrompt.tsx`.
- Use the page's URL slug as the `page_key` (e.g. `'countries'`, `'currencies'`, `'languages'`).
  Use `'global'` only for truly cross-page preferences such as `theme`.
- Compute `DEFAULT_VISIBLE_KEYS` **outside** the component (module-level constant) so it is stable.
- Maintain two layers of state:
  - **Pending local state** – applied immediately to keep the UI responsive.
  - **Saved preference** – persisted via `setStoredExpanded` / `setStoredColumns` only when the
    user confirms the `PreferenceSavePrompt`.
- Use `effectiveExpandedWidth = localExpanded ?? expandedWidth` (pending takes priority).
- Place `<PreferenceSavePrompt>` elements **outside** the `max-w-*` container so they are not
  clipped by overflow or max-width styles.
- Clear pending refs and local state inside `handleSave*` callbacks.
- Do **not** clear local state in `handleDismiss*` callbacks — the UI change persists for the
  session even when the user declines to save.
- For preference-backed toggles (including `Expand/Normal` width), showing a `PreferenceSavePrompt`
  after local state changes is mandatory.

#### Quick-start

```tsx
// 1. Expanded width preference
const [storedExpanded, setStoredExpanded] = useUserPreference('my-page', 'expanded_width', 'true')
const expandedWidth = storedExpanded === 'true'
const [localExpanded, setLocalExpanded] = useState<boolean | null>(null)
const [showWidthPrompt, setShowWidthPrompt] = useState(false)
const pendingExpanded = useRef<boolean | null>(null)
const effectiveExpandedWidth = localExpanded ?? expandedWidth

const handleSetExpandedWidth = useCallback((value: boolean) => {
  setLocalExpanded(value); pendingExpanded.current = value; setShowWidthPrompt(true)
}, [])
const handleSaveWidth = useCallback(() => {
  if (pendingExpanded.current !== null) {
    setStoredExpanded(String(pendingExpanded.current))
    setLocalExpanded(null); pendingExpanded.current = null
  }
  setShowWidthPrompt(false)
}, [setStoredExpanded])
const handleDismissWidth = useCallback(() => { setShowWidthPrompt(false) }, [])

// 2. Column visibility preference (column-selector pages only)
const DEFAULT_VISIBLE_KEYS = AVAILABLE_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key).join(',')
const [storedColumns, setStoredColumns] = useUserPreference('my-page', 'visible_columns', DEFAULT_VISIBLE_KEYS)
const visibleColumns = useMemo(() => new Set(storedColumns.split(',').filter(Boolean)), [storedColumns])
const [localColumns, setLocalColumns] = useState<Set<MyColumnKey> | null>(null)
const [showColumnsPrompt, setShowColumnsPrompt] = useState(false)
const pendingColumns = useRef<Set<MyColumnKey> | null>(null)
const effectiveVisibleColumns = localColumns ?? visibleColumns
```

See docs/ui-patterns.md (User Preferences section) for the full
step-by-step guide and integration checklist.

#### Reference implementations

| File | Preferences wired |
| ---- | ----------------- |
| `frontend/app/lei-records/page.tsx` | `expanded_width`, `visible_columns` |
| `frontend/app/countries/page.tsx` | `expanded_width`, `visible_columns` |
| `frontend/app/currencies/page.tsx` | `expanded_width` |
| `frontend/app/languages/page.tsx` | `expanded_width` |

### Live Preference Reactivity (Required)

- Preference toggles must apply immediately across mounted components and pages.
- Any `useUserPreference` write path must emit a global client event
  (for example `axiom:preference-updated`) with `pageKey`,
  `preferenceKey`, and `value`.
- Any `useUserPreference` read path must subscribe to that event and update
  local state when the same preference key changes elsewhere.
- Do not rely on page refresh or remount to pick up updated preferences.
- Keep the server persistence call asynchronous and best-effort; UI state must update first.

### Popover Alignment (Required)

- User menus/popovers must adapt placement to viewport position and
  document direction so they stay inside visible content bounds.
- Avoid hardcoded single-edge anchoring (`right-0` only or `left-0` only) for shared popovers.
- Prefer dynamic alignment at open time:
  - anchor right when trigger is on right side of viewport;
  - anchor left when trigger is on left side of viewport.
- Apply a viewport-safe max width (for example `max-w-[calc(100vw-1rem)]`) to prevent overflow on narrow screens.
- Verify both LTR and RTL layouts for overflow, clipping, and visual containment in normal/expanded page-width modes.

### Wide Table Scroll & Freeze Standard (Required)

- Wide data tables must provide a **top horizontal scrollbar** synchronized with the main table body scrollbar.
- Sticky/fixed headers must stay horizontally synchronized with the data body at all times
  (single shared scroll position).
- Table header rows/cells must remain visible at the top of the viewport while vertically scrolling
  the page (`sticky top-0` with explicit background and z-index).
- When any filter is active on a wide-table page, render a sticky **Active Filters** summary bar
  above the table header that remains visible during vertical scroll.
- The Active Filters bar must show removable filter chips and include a single **Clear All** action (LEI pattern).
- The sticky header offset must account for the Active Filters bar height so header and bar do not overlap.
- Freeze primary identity columns using sticky positioning so key context remains
  visible during horizontal scrolling.
- For LEI-style entity tables, freeze `LEI` and `Legal Name` by default when visible.
- Apply the same sticky/frozen behavior consistently to both header (`th`) and body (`td`) cells.
- Ensure frozen cells define explicit background and z-index layers so content
  does not bleed through during scroll.
- Frozen column widths and left offsets must be derived from measured rendered header widths
  (not hard-coded constants alone) to prevent seam drift during horizontal scroll.
- Add an explicit light+dark separator seam on frozen columns
  (for example border or inset shadow)
  so horizontally scrolled cells cannot bleed through divider boundaries.
- Use the **same seam rendering technique** for both frozen header (`th`) and body (`td`) cells;
  do not mix different seam primitives between header and body.
- Prefer an **inset right-edge seam** (for example an inset box-shadow) rendered inside frozen cells
  over offset pseudo-elements.
- Avoid negative-offset pseudo-element seams (`right: -1px` style patterns) on frozen cells because
  clipping and sub-pixel scroll can create header/body seam-width mismatch and reintroduce bleed.

### Wide Table UX Baseline (Required)

- For any page with table overflow risk (many columns or long values), implement the full baseline
  by default: `Expand/Normal` width toggle, top synced horizontal scrollbar, sticky/fixed header
  on vertical scroll, and sticky Active Filters bar when filters are active.
- Keep behavior consistent with LEI/Countries/Currencies/Languages implementations; do not create
  alternate page-specific variants unless explicitly required.
- Use shared component `frontend/app/components/SyncedWideTable.tsx` for top-scrollbar
  synchronization and sticky/fixed header behavior; do not duplicate this scaffolding per page.
- Horizontal overflow detection must be based on actual rendered table width vs. container width;
  do not rely on static assumptions.
- Table wrapper styles must not clip sticky/fixed elements (`overflow-hidden` should not block
  sticky headers or top scrollbars).
- Preserve z-index layering order: Active Filters bar above sticky header, sticky header above
  table body, dropdowns/modals above all table layers.
- If a page has filters, include `Clear Filters`; if active filters are displayed in sticky summary
  chips, include `Clear All` there as well.

### Keyboard Shortcut Baseline (Required)

- Use consistent keyboard shortcuts for interactive overlays across pages (column selectors,
  dropdown panels, popovers, dialogs).
- Pressing `Escape` must close the top-most open overlay element first.
- Implement keyboard handlers with proper cleanup (`addEventListener`/`removeEventListener`)
  to avoid leaks and duplicate bindings.
- Do not create page-specific shortcut behavior that conflicts with existing LEI patterns unless explicitly required.

### Table Row Hover Contrast Standard (Required)

- Data table rows must provide clearly visible hover contrast in light mode.
- Use `hover:bg-blue-50` for light mode row hover states (or stronger approved equivalent), not subtle gray shades.
- Preserve dark mode row hover behavior (for example, `dark:hover:bg-white/10` or `dark:hover:bg-white/5`).
- Include `transition-colors` on interactive table rows for consistent visual feedback.

### Sortable Header Standard (Required)

- Interactive review/list tables where users compare values must support sorting on data columns.
- Sortable headers must always show a visual affordance and display clear direction arrows for active sort state.
- Use shared `SortableHeaderCell` for consistency; avoid page-local sortable header implementations.
- Keep action-only columns (for example `Actions`) non-sortable.
- Use client-side sorting for loaded rows unless server-side sorting is explicitly required.

### Table Cell Content Visibility Standard (Required)

- Do not truncate critical table data values by default (avoid `truncate` for primary business fields).
- Cells containing potentially long values (for example description, names, free-text references)
  must wrap and expand row height.
- Use wrapping classes such as `whitespace-normal break-words leading-relaxed` to keep full values visible.
- Use top alignment (`align-top`) on multi-line cells to preserve readability across rows.

### Protected API Fallback Standard (Required)

- Pages backed by protected APIs must attempt authenticated fetch using existing client token keys
  (`token`, `jwt`, `authToken`, `access_token`).
- On `401`/`403` or API unavailability, render approved sample data instead of an empty/broken page.
- Always show a clear data-source banner indicating whether data is from API (`✅ Data Source`) or
  sample fallback (`📋 Notice`).
- Sample records must use realistic but non-sensitive values and must not include restricted tenant-specific naming.

### Virtual/Derived Columns Standard (Required)

- Prefer **virtual/derived UI columns** for deterministic display data (for example, country flag
  emoji from ISO alpha-2 country code).
- Do not persist deterministic presentation-only fields in database schemas or initial seed data
  unless there is a clear business requirement.
- Implement derived value logic in a reusable utility and consume it across pages to ensure consistency.
- For country flags, use the shared helper in `frontend/app/lib/country-flag.ts` instead of
  duplicating conversion logic.
- Render country flags via shared component `frontend/app/components/CountryFlag.tsx` to ensure
  consistent display across OS/browser font differences.
- Do not define page-local helpers such as `getFlagEmoji*`, `getFlagImageUrl*`, or
  `renderCountryFlag*`; import and use the shared utility/component.
- If a page does not yet have a finalized table/list layout (for example, placeholder/coming-soon
  pages), defer derived column rendering until the page schema is defined.

### Code vs Name Display Standard (Required)

- When reference data has both machine codes and human-readable names (for example: continent,
  language, legal form, region), provide a single page-level toggle to switch display mode between
  names and codes.
- Reuse the LEI pattern text and behavior (`🏷️ Display: Names` / `🏷️ Display: Codes`) for
  consistency unless a page has explicit UX requirements.
- Apply the selected mode consistently to table headers, table cells, and filter option labels
  that render those reference values.
- Keep filter query values stable (code-backed where possible); only the visible labels should change with display mode.

### Landing Cards Standard (Required)

- Cards within the same landing-page section must use a shared component and identical interaction/visual behavior.
- In the **Master Data Management** section, cards (Instruments, Accounts, SSI, Code Mappings) must
  keep consistent structure:
  title, description, single `Protected` badge, icon placement, min height, and hover behavior.
- Do not add special-case badges or card-specific layout differences within the same section
  unless explicitly requested.

### Status Label Formatting Standard (Required)

- Do not render raw backend enum values directly in user-facing UI (for example `IN_PROGRESS`, `FAILED`, `DAILY_FULL`).
- Use shared formatter `frontend/app/lib/status-label.ts` for status labels (`formatStatusLabel`)
  across pages/components.
- Prefer shared utilities over per-page inline status-format helpers to keep capitalization and wording consistent.
- Keep status **logic** based on original enum values and apply formatting only at render time.

```tsx
<select className="bg-white dark:bg-white/5 text-gray-900 dark:text-white border-gray-300 dark:border-white/20">
  <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="">All</option>
</select>
```

## Accessibility

### WCAG 2.2 AA Baseline (Required)

The Axiom frontend targets **WCAG 2.2 Level AA**. Every pull request that touches shared components
or adds new interactive elements must satisfy the criteria below. The full developer reference is at
`docs/accessibility/WCAG_COMPLIANCE.md`.

#### SC 1.4.3 — Contrast (Minimum)

- Normal text must achieve **≥ 4.5:1** contrast against its background.
- Large/bold text (≥ 18 pt or ≥ 14 pt bold) must achieve **≥ 3:1**.
- **Always use** `text-blue-600 dark:text-blue-400` for links and interactive text.
- **Never use** `text-blue-400` on light/white backgrounds — its contrast ratio (~3.0:1) fails for
  normal text.
- **Never use** `opacity-*` to dim text without first verifying the resulting contrast ratio.

```tsx
// ✅ CORRECT — 4.84:1 on white
<Link className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 ...">
  ← Back to Home
</Link>

// ❌ INCORRECT — ~3.0:1 on white
<Link className="text-blue-400 hover:text-blue-300 ...">← Back to Home</Link>
```

#### SC 1.4.11 — Non-text Contrast

- UI component boundaries (button borders, input borders, focus indicators) need **≥ 3:1** contrast.
- Icon-only controls must use `border-gray-400/50 dark:border-white/20` — NOT `border-white/20` alone
  (the latter is invisible on light backgrounds).

#### SC 2.4.7 / 2.4.11 — Focus Visible

Every focusable element must show a **visible keyboard focus ring**. Use `focus-visible:` to avoid
displaying the ring on mouse clicks:

```tsx
// Standard — apply to buttons, links, and most interactive elements
className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"

// Compact — use in tight layouts (toolbars, table header cells)
className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
```

- **Never** add `focus:outline-none` without a replacement focus indicator.
- Do **not** use `focus:ring-*` alone — pair with `focus-visible:ring-*` so the ring only appears on
  keyboard focus.

#### Loading Spinners (Required)

```tsx
// ✅ CORRECT — full ring, both modes, screen reader label
<div
  className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-400"
  role="status"
  aria-label="Loading..."
/>

// ❌ INCORRECT — single edge, nearly invisible on white backgrounds
<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
```

#### Icon-only Buttons (Required)

```tsx
// ✅ CORRECT — visible border both themes, aria-label, focus ring
<button
  aria-label="Switch to dark mode"
  className="h-9 w-9 border border-gray-400/50 dark:border-white/20
             hover:bg-white/20 transition-all rounded-lg
             focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
>
  🌙
</button>

// ❌ INCORRECT — invisible border on light bg, title-only is inaccessible, no focus ring
<button className="border border-white/20" title="Switch to dark mode">🌙</button>
```

#### WCAG PR Checklist

Add this block to your PR description whenever you touch interactive UI elements:

```markdown
## Accessibility Checklist

- [ ] All new text uses colours with ≥ 4.5:1 contrast on their background.
- [ ] All new interactive elements have a `focus-visible:ring-*` focus indicator.
- [ ] Icon-only buttons carry an `aria-label` attribute.
- [ ] Loading indicators use the full-ring spinner with `role="status"` and `aria-label`.
- [ ] UI tested visually in both light and dark themes.
- [ ] No new uses of `text-blue-400` on light-mode backgrounds.
- [ ] No new uses of `border-white/20` as the sole border in light mode.
```

### ARIA Labels

- Use semantic HTML elements (`<button>`, `<nav>`, `<main>`)
- Add `aria-label` for icon-only buttons
- Use proper heading hierarchy (`<h1>`, `<h2>`, etc.)

### Keyboard Navigation

- Ensure all interactive elements are keyboard accessible
- Use `:focus` styles for focus indicators
- Disable buttons appropriately with `disabled` attribute

#### Keyboard Shortcuts (Required)

**All popups, modals, dropdowns, and overlays MUST support ESC key to close.**

Users should never be forced to use the mouse to close UI elements. Implement keyboard shortcuts
for all interactive overlays:

##### ✅ REQUIRED Implementation Pattern

```typescript
// ESC key handler to close popups/modals/dropdowns
useEffect(() => {
  const handleEscapeKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      // Close in priority order: modal -> selector -> dropdown
      if (selectedRecord) {
        setSelectedRecord(null)  // Close modal
      } else if (showColumnSelector) {
        setShowColumnSelector(false)  // Close popup
      } else if (showDropdown) {
        setShowDropdown(false)  // Close dropdown
      }
    }
  }
  document.addEventListener('keydown', handleEscapeKey)
  return () => document.removeEventListener('keydown', handleEscapeKey)
}, [selectedRecord, showColumnSelector, showDropdown])
```

##### UI Elements Requiring ESC Key Support

- ✅ Modals/Dialogs (highest priority)
- ✅ Column selector popups
- ✅ Dropdown menus
- ✅ Search filters
- ✅ Date pickers
- ✅ Any overlay that obscures main content

##### Priority Order

When multiple overlays are open, close them in order of importance:

1. Modal dialogs (most important)
2. Popups and selectors
3. Dropdowns (least important)

This ensures users can progressively dismiss UI layers without confusion.

##### Example: LEI Records Page Implementation

```typescript
// Full implementation from lei-records/page.tsx
const [selectedRecord, setSelectedRecord] = useState<LEIRecord | null>(null)
const [showColumnSelector, setShowColumnSelector] = useState(false)
const [showCountryDropdown, setShowCountryDropdown] = useState(false)

// Close popups with Escape key
useEffect(() => {
  const handleEscapeKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      // Close in priority order: modal -> column selector -> country dropdown
      if (selectedRecord) {
        setSelectedRecord(null)
      } else if (showColumnSelector) {
        setShowColumnSelector(false)
      } else if (showCountryDropdown) {
        setShowCountryDropdown(false)
      }
    }
  }
  document.addEventListener('keydown', handleEscapeKey)
  return () => document.removeEventListener('keydown', handleEscapeKey)
}, [selectedRecord, showColumnSelector, showCountryDropdown])
```

##### Testing Checklist

When implementing ESC key support:

- [ ] ESC closes modal from any focused element inside it
- [ ] ESC closes popup when focused anywhere on page
- [ ] ESC works with multiple overlays (closes in correct order)
- [ ] Event listener properly cleaned up on unmount
- [ ] Dependencies array includes all state variables checked in handler

### Form Accessibility

- Use `<label>` elements for all form inputs
- Include placeholder text as guidance
- Show validation errors clearly

## Performance

### Component Optimization

- Use React.memo for expensive re-renders
- Implement pagination for large data sets
- Lazy load components when appropriate

### Asset Optimization

- Use Next.js Image component for images
- Minimize bundle size by importing only what's needed
- Use dynamic imports for heavy components

## Code Organization

### File Structure

- One component per file
- Co-locate related components in subdirectories
- Use descriptive, kebab-case filenames

### Import Organization

```typescript
// 1. React and Next.js imports
import { useState, useEffect } from 'react'
import Link from 'next/link'

// 2. Third-party imports
import ThemeToggle from '../components/ThemeToggle'

// 3. Types and interfaces
interface MyData {
  id: string
  name: string
}

// 4. Component definition
export default function MyComponent() {
  // ...
}
```

### Naming Conventions

- Components: PascalCase (e.g., `ThemeToggle.tsx`)
- Variables and functions: camelCase (e.g., `fetchRecords`, `currentPage`)
- Constants: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`, `PAGE_SIZE`)
- Interfaces: PascalCase with descriptive names (e.g., `LEIRecord`, `ProcessingStatus`)

## Testing Guidelines

### Component Testing

- Test user interactions
- Test loading and error states
- Test accessibility features

### API Integration Testing

- Mock API responses in tests
- Test error handling
- Verify data transformations

## Documentation

### Code Comments

- Follow the self-explanatory code guidelines
- Document complex business logic
- Explain non-obvious TypeScript types

### Component Documentation

- Add JSDoc comments for reusable components
- Document props with descriptions
- Include usage examples for shared components

## Security

### XSS Prevention

- Never use `dangerouslySetInnerHTML` without sanitization
- Validate and sanitize all user inputs
- Use parameterized queries for API calls

### Authentication

- Store tokens securely (httpOnly cookies preferred)
- Include authentication headers in protected API calls
- Handle token expiration gracefully

## Reusable Components (REQUIRED)

**Always** use the shared components from `frontend/app/components/` — do **not** duplicate inline
markup that already exists as a component. See the full reference in
docs/ui-patterns.md.
Keep this as plain text (not a markdown link) because the prompts diagnostics
provider can report a false missing-file error.

### PageHeader

Every page must use `PageHeader`. It includes the back link, `ThemeToggle`, title, and subtitle.
Do **not** import `ThemeToggle` separately on pages that use `PageHeader`.

```tsx
import PageHeader from '../components/PageHeader'

<PageHeader
  title="Countries"
  subtitle="Browse ISO 3166 country codes and reference data"
/>

// With extra controls
<PageHeader
  title="LEI Records"
  actions={<button onClick={refresh}>🔄 Refresh</button>}
/>
```

### LoadingSpinner

Use instead of the inline spinner div:

```tsx
import LoadingSpinner from '../components/LoadingSpinner'

// ✅ CORRECT
if (loading && records.length === 0) {
  return <LoadingSpinner message="Loading records..." />
}

// ❌ WRONG — do not copy this pattern
if (loading) {
  return (
    <div className="text-center py-20">
      <div className="inline-block animate-spin ..."></div>
    </div>
  )
}
```

### Alert

Use instead of the inline coloured `div/p` pattern for errors and notices:

```tsx
import Alert from '../components/Alert'

// ✅ CORRECT
{error && (
  <Alert variant="error" title="⚠️ Error:" className="mb-6">
    {error}
  </Alert>
)}

// ❌ WRONG — do not copy this pattern
{error && (
  <div className="mb-6 p-4 rounded-lg border bg-red-50 border-red-200 ...">
    <p className="text-red-800 ...">...</p>
  </div>
)}
```

Variants: `info | warning | error | success`

### Badge

Use instead of raw `<span>` chips for codes and status labels:

```tsx
import Badge from '../components/Badge'

// ✅ CORRECT
<Badge variant="blue" mono>{country.alpha2}</Badge>
<Badge variant="green" shape="pill">✓ Active</Badge>

// ❌ WRONG — do not copy this pattern
<span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 ... rounded font-mono">
  {country.alpha2}
</span>
```

Variants: `blue | green | red | yellow | orange | purple | gray`

### StatCard

Use instead of the repeated metric card `div` pattern:

```tsx
import StatCard from '../components/StatCard'

// ✅ CORRECT
<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
  <StatCard title="Total" value={records.length} />
  <StatCard title="Active" value={activeCount} accent="green" />
</div>

// ❌ WRONG — do not copy this pattern
<div className="bg-white dark:bg-white/5 rounded-lg shadow p-6 border-2 border-gray-200 ...">
  <h3 className="text-sm font-medium text-gray-600 ...">Total</h3>
  <p className="text-3xl font-bold text-gray-900 ... mt-2">{records.length}</p>
</div>
```

---

## Common Patterns

### Pagination

```typescript
const [currentPage, setCurrentPage] = useState(1)
const [pageSize] = useState(50)

const fetchRecords = async () => {
  const offset = (currentPage - 1) * pageSize
  const response = await fetch(
    `${API_BASE_URL}/api/v1/resource?limit=${pageSize}&offset=${offset}`
  )
  // ...
}
```

### Search and Filters

```typescript
const [searchTerm, setSearchTerm] = useState('')
const [filters, setFilters] = useState({})

useEffect(() => {
  fetchRecords()
}, [currentPage, searchTerm, filters])  // Re-fetch when filters change
```

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [ISO 8601 Date Format](https://en.wikipedia.org/wiki/ISO_8601)
- [WCAG 2.2 Specification](https://www.w3.org/TR/WCAG22/)
- [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)
- [Understanding SC 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [Understanding SC 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- [Understanding SC 2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- Axiom WCAG Compliance Guide: docs/accessibility/WCAG_COMPLIANCE.md
- Axiom UI Patterns Guide: docs/ui-patterns.md

---

## Summary

- **Dates**: Always ISO 8601 format (yyyy-mm-dd) - NEVER use toLocaleDateString()
- **Styling**: Glassmorphism dark mode by default
- **TypeScript**: Strong typing for all data structures
- **Accessibility**: Semantic HTML and keyboard navigation
- **Performance**: Pagination and lazy loading for large datasets
- **Components**: Always use shared components — never duplicate inline markup

---

# i18n Instructions for Axiom Frontend

## Locale File Rules

### ❌ NEVER hardcode English strings in non-English locale files

Every string added to `frontend/public/locales/en/common.json` should either be **absent** from all other locale
files (allowing i18next `fallbackLng: 'en'` to serve it automatically) or referenced via `$t()` nesting.

**Anti-pattern — do NOT copy English literals into other locales:**

```json
// ❌ BAD — de/common.json
"stale": {
  "badge": "STALE",
  "noneFound": "No stale translation rows found."
}
```

**Correct alternatives:**

1. **Omit the key entirely** — i18next falls back to `en` automatically.
2. **Use `$t()` nesting** to reference the English key:

```json
// ✅ GOOD — de/common.json (reference en via $t nesting)
"stale": {
  "badge": "$t(admin.translations.stale.badge)"
}
```

> **Rule of thumb**: If the value in a non-English locale file is identical to the English value, it should not
> be in that file at all.

### Use `$t()` nesting to deduplicate strings shared across sections

When the same label is used in multiple i18n keys (e.g. a stat card label that mirrors a filter chip label),
define it once in a canonical location and reference it everywhere else:

```json
// ✅ en/common.json — canonical location
"common": {
  "filteredResults": "Filtered Results"
},
"currencies": {
  "stats": {
    "filteredResults": "$t(common.filteredResults)"
  },
  "filters": {
    "alertClsAllowed": "ALERT CLS Allowed"
  }
},
"currencies.stats.alertClsAllowed": "$t(currencies.filters.alertClsAllowed)"
```

Non-English locales only need to translate the **canonical** key; all `$t()` references resolve automatically.

### Non-English locale files must NOT contain these patterns

Run a search before committing — if any of the following appear verbatim in a non-English locale file,
they are almost certainly an untranslated English string that should be removed or replaced with `$t()`:

- Strings ending in `.` inside a non-English string value
- English phrases like `"Failed to"`, `"No ... found"`, `"← Prev"`, `"Next →"`, `"of {{count}}"`
- Any string value that is byte-for-byte identical to the English locale value for the same key

---

## Component / TypeScript Rules

### Shift-left Requirement (MANDATORY)

Internationalisation is required from the first implementation pass, not as a later cleanup.

- For any frontend behavior/UI change, add `t('...')` keys in the same PR.
- Do not ship new user-facing literals with TODOs to internationalise later.
- Treat missing i18n as a blocking issue for completion, not a review-time enhancement.
- Before marking work done, run i18n checks alongside lint/tests.

### Every visible user-facing string must go through `t()`

```tsx
// ❌ BAD
<span>English Default</span>
<p>Failed to load translations</p>

// ✅ GOOD
<span>{t('admin.translations.englishDefaultLabel')}</span>
<p>{t('admin.translations.errors.loadFailed')}</p>
```

### Add keys to `en/common.json` first, then reference them

1. Add the English string to the canonical English locale file.
2. Add the i18n key call in the component.
3. **Do not** copy the English string into other locale files — let fallback or the approval workflow handle it.

### Using `useTranslation`

```tsx
import { useTranslation } from 'react-i18next'

export default function MyComponent() {
  const { t } = useTranslation('common')
  return <h1>{t('admin.translations.title')}</h1>
}
```

---

## Keeping Locale Files Clean

### Detect and remove stale keys

Use the **Cleanup Stale** button on the `/admin/translations` page, or run:

```powershell
# PowerShell — list keys present in de/common.json that are absent from en/common.json
$en = (Get-Content frontend/public/locales/en/common.json | ConvertFrom-Json)
$de = (Get-Content frontend/public/locales/de/common.json | ConvertFrom-Json)
# ... diff logic
```

The `cleanup-stale-translations.ps1` script automates this.

### When you add a new i18n feature

Checklist before merging:

- [ ] New keys added to `en/common.json` only
- [ ] No English literal values copied to any other locale file
- [ ] Duplicated strings use `$t()` nesting in `en/common.json`
- [ ] Component uses `t('key')` — no raw English strings in JSX
- [ ] Run `pnpm tsc --noEmit` to catch any TypeScript errors
- [ ] Verify the dev panel (`I18nMissingTranslationsDevTool`) shows no unexpected missing-key warnings on the affected pages

---

## i18next `$t()` Nesting Reference

| Pattern | Purpose |
| --- | --- |
| `"$t(some.other.key)"` | Fully replace this value with the resolved value of `some.other.key` |
| `"Prefix: $t(key)"` | Interpolate another key inline |
| `"$t(ns:key)"` | Reference a key in a different namespace |

> i18next resolves `$t()` references **before** interpolation — safe to combine with `{{variable}}`.

---

## Fallback Language Behaviour

The Axiom i18next config sets `fallbackLng: 'en'`. This means:

- Any key **missing** from the active locale file is automatically served from `en/common.json`.
- Any key whose value starts with `$t(...)` resolves to the referenced key in the **same** locale first, then
  falls back to `en`.

This is **intentional** — you do not need to provide a translation for every key in every locale. Leave new keys
absent in non-English locales until a real human translation is approved via the admin UI.

---

# Test-Driven Maintenance Instructions

## Core Principle

**Every functional code change MUST be accompanied by corresponding test updates or new test cases.**

**Feature work is not complete until tests exist for the new behavior.**

This is mandatory for:

- New features
- New endpoints
- New repository or service logic
- New UI behaviors
- Bug fixes that change observable behavior

If a change introduces behavior and no automated test is added,
the work should be treated as incomplete unless the user explicitly says to skip tests.

## Mandatory Test Update Rules

### When to Update Tests

**ALWAYS update or create tests when:**

1. **Adding New Functions/Methods**
   - Create new test function with table-driven test cases
   - Test both happy path and error conditions
   - Include edge cases and boundary conditions
   - Add benchmarks for performance-critical code

2. **Adding New Feature Behavior**
    - Add or update automated tests in the closest existing test suite for that module or feature
    - Cover the primary success path, failure path, and at least one edge case
    - Verify any new public/API-visible behavior, not just internal helpers
    - Do not rely on manual verification alone when automated coverage is feasible

3. **Modifying Existing Functions**
   - Update existing test cases to match new behavior
   - Add new test cases for new functionality
   - Verify all existing tests still pass
   - Update test descriptions/comments if behavior changed

4. **Changing Function Signatures**
   - Update all test calls to match new signature
   - Add tests for new parameters
   - Verify backward compatibility if applicable

5. **Modifying Return Values**
   - Update all test assertions to expect new return values
   - Test new error conditions
   - Update expected JSON output files in `testdata/` if applicable

6. **Changing Validation Logic**
   - Add test cases for new validation rules
   - Update existing validation tests
   - Test both valid and invalid inputs

7. **Modifying Configuration**
   - Update `internal/config/config_test.go`
   - Test new environment variables
   - Test new default values
   - Update validation test cases

8. **Changing Frontend Behavior**
    - Add or update Vitest coverage in the nearest existing `*.test.ts` or `*.test.tsx` file
    - Prefer testing user-visible behavior, transformation logic, and state transitions over implementation details
    - When UI logic is hard to test directly, extract a pure helper and test that helper with Vitest
    - For i18n, filtering, formatting, preferences, and null-handling changes,
      add focused regression tests for the changed path
    - If the area already has a test file, extend it instead of creating a disconnected new pattern

9. **Changing Backend Data Contracts Used by the Frontend**
     - Treat added, removed, or renamed API fields as a frontend-impacting change
     - Update frontend types/interfaces and verify both list and detail surfaces for affected domains
     - For LEI pages, review `frontend/app/lei-records/page.tsx` table columns and detail modal sections
     - Add or update focused frontend tests for formatting/normalization paths touched by new fields
     - Do not merge backend field changes that are not represented or intentionally hidden in the UI

## Test File Organization

### Test Data Files (`testdata/`)

When adding test data:

- Use descriptive filenames: `valid_[scenario].csv`, `invalid_[reason].csv`
- Create matching `*_expected.json` for valid cases
- Document in TESTING.md what the test data validates

### Test Naming Convention

```go
func Test[FunctionName][Scenario](t *testing.T) {
    // Test implementation
}
```

Examples:

- `TestParseValidBasicCSV`
- `TestParseInvalidHeaderOnly`
- `TestToJSONEmptyFields`

### Frontend Test Placement

For frontend code, prefer colocated Vitest files near the feature they cover:

- `frontend/app/lib/example.ts` -> `frontend/app/lib/example.test.ts`
- `frontend/app/components/Widget.tsx` -> `frontend/app/components/Widget.test.ts`
- `frontend/app/feature/helpers.ts` -> `frontend/app/feature/helpers.test.ts`

Use the nearest existing test pattern in the folder before introducing a new file shape.

### Frontend Test Expectations

The current frontend test harness uses Vitest.

When changing frontend behavior:

- Add a success-path test for the expected user-visible or helper outcome
- Add a failure, validation, or guard-path test when the logic can reject or normalize input
- Add at least one edge-case regression test for the changed behavior
- Prefer deterministic helper tests over brittle rendering tests when no DOM-specific harness is needed
- Avoid snapshot-only coverage for new logic

Good candidates for frontend automated tests in this repository include:

- normalization helpers
- formatting utilities
- docs link builders
- preference/state transformation helpers
- null-like value handling
- component logic that can be exercised without browser-only dependencies

## ADR-003 Contract Validation

**CRITICAL**: All tests must validate ADR-003 contracts:

1. **String Values Only** - No type coercion (test that `"30"` stays `"30"`, not `30`)
2. **Empty String Not Null** - Empty fields become `""`, never `null`
3. **Array Structure** - Single row produces array, not object
4. **Row Order Preservation** - Test that row order is maintained
5. **Strict Parsing** - Test that invalid files are rejected (not silently fixed)

## Test Execution Workflow

## Pull Request Expectation

When a PR adds or changes feature behavior, reviewers should be able to see test evidence in the diff.

Minimum expectation:

- Production code change and corresponding test change appear in the same PR
- Tests exercise the new or changed behavior directly
- Validation commands are included in the PR summary or agent response

**Before committing code:**

1. Run tests for the modified module:

   ```bash
   go test ./internal/[module] -v
   ```

2. Run all tests:

   ```bash
   go test ./... -v
   ```

3. Check coverage:

   ```bash
   go test -cover ./...
   ```

4. Verify no coverage regressions (aim for >70% per module)

### Frontend Validation Workflow

For frontend behavior changes, run the nearest relevant automated checks before commit:

1. Run frontend tests:

    ```bash
    cd frontend && npm test
    ```

2. Run frontend lint when the change touches application code:

    ```bash
    cd frontend && npm run lint
    ```

3. Run targeted verification scripts when relevant to the feature area:

    ```bash
    cd frontend && npm run i18n:verify
    ```

If a full frontend test run is too expensive for a narrow change,
run the most relevant test file or document why only a narrower validation was used.

## Examples

### Example 1: Adding New Parser Feature

**Code Change:**

```go
// Added support for custom delimiter
func ParseWithDelimiter(filepath string, delimiter rune) ([]map[string]string, error) {
    // implementation
}
```

**Required Test:**

```go
func TestParseWithCustomDelimiter(t *testing.T) {
    tests := []struct {
        name      string
        delimiter rune
        wantErr   bool
    }{
        {"comma", ',', false},
        {"tab", '\t', false},
        {"pipe", '|', false},
        {"invalid", '\n', true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := ParseWithDelimiter("testdata/valid_basic.csv", tt.delimiter)
            if (err != nil) != tt.wantErr {
                t.Errorf("ParseWithDelimiter() error = %v, wantErr %v", err, tt.wantErr)
            }
            // Additional assertions...
        })
    }
}
```

### Example 2: Modifying Validation Logic

**Code Change:**

```go
// Added port range validation
func ValidatePort(port int) error {
    if port < 1 || port > 65535 {
        return fmt.Errorf("port must be between 1 and 65535, got %d", port)
    }
    return nil
}
```

**Required Test Update:**

```go
func TestValidateQueuePortRange(t *testing.T) {
    tests := []struct {
        name    string
        port    int
        wantErr bool
    }{
        {"valid_min", 1, false},
        {"valid_mid", 5672, false},
        {"valid_max", 65535, false},
        {"invalid_zero", 0, true},
        {"invalid_negative", -1, true},
        {"invalid_high", 65536, true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := ValidatePort(tt.port)
            if (err != nil) != tt.wantErr {
                t.Errorf("ValidatePort(%d) error = %v, wantErr %v", tt.port, err, tt.wantErr)
            }
        })
    }
}
```

### Example 3: Updating Test Data

**Code Change:**

```go
// Changed behavior: now preserves leading/trailing spaces in fields
```

**Required Updates:**

1. Update `testdata/valid_quoted_expected.json` with spaces
2. Add new test case:

```go
func TestParsePreservesSpaces(t *testing.T) {
    // Test that " value " stays as " value " not "value"
}
```

## Test Coverage Goals

- **Config Module**: >80% (validates all configuration paths)
- **Parser Module**: >70% (covers all CSV parsing scenarios)
- **Converter Module**: >75% (covers all JSON conversion paths)
- **New Modules**: >60% minimum for first implementation

## Continuous Integration

Tests must pass before merging:

- All existing tests pass
- New tests added for new functionality
- Coverage maintained or improved
- No skipped tests without documented reason

## Common Mistakes to Avoid

❌ **DON'T:**

- Skip tests because "it's a small change"
- Only test happy path (always test error conditions)
- Use hardcoded values that might change (use testdata files)
- Commit code without running full test suite
- Ignore test failures in other modules

✅ **DO:**

- Write tests first (TDD) when possible
- Test error conditions thoroughly
- Use table-driven tests for multiple scenarios
- Update TESTING.md when adding new test categories
- Run tests locally before pushing

## Summary Checklist

Before every commit:

- [ ] New functions have new test cases
- [ ] Modified functions have updated test cases
- [ ] All tests pass: `go test ./... -v`
- [ ] Coverage maintained: `go test -cover ./...`
- [ ] Test data files updated if behavior changed
- [ ] TESTING.md updated if new test categories added
- [ ] ADR-003 contracts validated in tests

**Remember: Tests are documentation. They explain what the code does and prove it works correctly.**
