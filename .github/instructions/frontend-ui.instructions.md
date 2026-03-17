---
description: 'Frontend and UI development guidelines for the Axiom project'
applyTo: 'frontend/**/*.tsx,frontend/**/*.ts,frontend/**/*.jsx,frontend/**/*.js'
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
