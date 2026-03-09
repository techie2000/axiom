# UI Patterns Guide

Reusable UI patterns and components for the Axiom frontend. These patterns have been tested and
optimized for performance, accessibility, and user experience.

## Table of Contents

- [User Preferences](#user-preferences)
- [Reusable Components](#reusable-components)
- [Sticky Headers with Smooth Transitions](#sticky-headers-with-smooth-transitions)
- [Frozen Columns Checklist](#frozen-columns-checklist)
- [Brand Theme Asset Switch](#brand-theme-asset-switch)
- [Entry Route Model](#entry-route-model)
- [Best Practices](#best-practices)

---

## User Preferences

Axiom persists per-user UI preferences to the database so they roam across devices and sessions.
This section explains the hook, the save prompt, and the step-by-step process for wiring
preferences into any page.

### Architecture overview

```text
Browser session
  └─ useUserPreference hook (shared module-level cache)
       ├─ on first call  → GET /api/v1/preferences  (one round-trip, then cached)
       ├─ on write       → PUT /api/v1/preferences  (async, best-effort)
       └─ always mirrors → localStorage             (offline / pre-load fallback)
```

When the user is **not logged in** the hook falls back silently to `localStorage` only.

### `useUserPreference` hook

**File:** `frontend/app/lib/useUserPreference.ts`

```tsx
import { useUserPreference } from '../lib/useUserPreference'

// Signature
const [value, setValue, isLoading] = useUserPreference(pageKey, prefKey, defaultValue)
```

#### Parameters

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `pageKey` | `string` | Page identifier (e.g. `'countries'`, `'global'`). Use `'global'` for cross-page preferences. |
| `prefKey` | `string` | Preference name (e.g. `'expanded_width'`, `'visible_columns'`, `'theme'`). |
| `defaultValue` | `string` | Value to use when no preference has been saved yet. |

#### Return values

| Index | Name | Description |
| ----- | ---- | ----------- |
| 0 | `value` | Current preference string (server or localStorage, then default). |
| 1 | `setValue` | Saves locally and persists to server. |
| 2 | `isLoading` | `true` while the initial server fetch is in flight. |

#### Lifecycle

1. **Mount** – if the in-memory cache is not yet populated, fires one `GET /api/v1/preferences`
   and populates the cache with all preferences for the current user.
2. **Write** – `setValue(newValue)` updates React state, the module-level cache, `localStorage`,
   and sends a `PUT /api/v1/preferences` request in the background.
3. **Sign-out** – call `resetPreferencesCache()` so the next login gets fresh server data.

#### `page_key` registry

| Value | Page / context |
| ----- | -------------- |
| `global` | Cross-page (e.g. `theme`) |
| `lei-records` | LEI Records (`/lei-records`) |
| `countries` | Countries (`/countries`) |
| `currencies` | Currencies (`/currencies`) |
| `languages` | Languages (`/languages`) |

Use the URL slug of the page as the `page_key` for any new page.

### `PreferenceSavePrompt` component

**File:** `frontend/app/components/PreferenceSavePrompt.tsx`

An unobtrusive bottom-right toast that asks the user whether to save a changed preference as their
default. It auto-dismisses after **8 seconds** if the user does not interact.

```tsx
import PreferenceSavePrompt from '../components/PreferenceSavePrompt'

<PreferenceSavePrompt
  visible={showWidthPrompt}
  onSave={handleSaveWidth}
  onDismiss={handleDismissWidth}
  label="Save page width as your default?"
/>
```

#### Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `visible` | `boolean` | — | Controls whether the toast is shown. |
| `onSave` | `() => void` | — | Called when user clicks **Save**. Persist the preference here. |
| `onDismiss` | `() => void` | — | Called on **No thanks** or auto-dismiss. |
| `label` | `string` | `'Save this as your default?'` | Message shown inside the toast. |

### Adding preferences to a new page

Follow this pattern to add preference-backed state to any page. The pattern uses two layers:

1. **Pending local state** – applied immediately so the UI is responsive.
2. **Saved preference** – persisted to the server when the user confirms via the prompt.

#### Step-by-step guide

##### 1. Import the hook and prompt

```tsx
import { useCallback, useRef, useState } from 'react'
import PreferenceSavePrompt from '../components/PreferenceSavePrompt'
import { useUserPreference } from '../lib/useUserPreference'
```

##### 2. Wire up `expanded_width` preference

```tsx
// Read the stored preference ('true' | 'false')
const [storedExpanded, setStoredExpanded] = useUserPreference(
  'my-page',           // page_key  ← use the URL slug
  'expanded_width',    // pref_key
  'true',              // default: start expanded
)
const expandedWidth = storedExpanded === 'true'

// Local pending state and prompt flag
const [localExpanded, setLocalExpanded] = useState<boolean | null>(null)
const [showWidthPrompt, setShowWidthPrompt] = useState(false)
const pendingExpanded = useRef<boolean | null>(null)

// Effective value: pending local > saved > default
const effectiveExpandedWidth = localExpanded ?? expandedWidth

// Handler called by the toggle button
const handleSetExpandedWidth = useCallback((value: boolean) => {
  setLocalExpanded(value)
  pendingExpanded.current = value
  setShowWidthPrompt(true)
}, [])

// Confirm save
const handleSaveWidth = useCallback(() => {
  if (pendingExpanded.current !== null) {
    setStoredExpanded(String(pendingExpanded.current))
    setLocalExpanded(null)
    pendingExpanded.current = null
  }
  setShowWidthPrompt(false)
}, [setStoredExpanded])

// Dismiss without saving
const handleDismissWidth = useCallback(() => { setShowWidthPrompt(false) }, [])
```

```tsx
{/* Toggle button */}
<button onClick={() => handleSetExpandedWidth(!effectiveExpandedWidth)}>
  {effectiveExpandedWidth ? '⬅️ Normal' : '↔️ Expand'}
</button>

{/* Width prompt – renders outside the page container so it stays fixed bottom-right */}
<PreferenceSavePrompt
  visible={showWidthPrompt}
  onSave={handleSaveWidth}
  onDismiss={handleDismissWidth}
  label="Save page width as your default?"
/>
```

##### 3. Wire up `visible_columns` preference (column-selector pages only)

```tsx
// Compute the default visible set once at module level (outside the component)
const DEFAULT_VISIBLE_KEYS = AVAILABLE_COLUMNS
  .filter((c) => c.defaultVisible)
  .map((c) => c.key)
  .join(',')

// Inside the component:
const [storedColumns, setStoredColumns] = useUserPreference(
  'my-page',
  'visible_columns',
  DEFAULT_VISIBLE_KEYS,
)

// Derive the Set from the comma-separated string
const visibleColumns = useMemo<Set<MyColumnKey>>(() => {
  if (!storedColumns) return new Set(AVAILABLE_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key))
  return new Set(storedColumns.split(',').filter(Boolean) as MyColumnKey[])
}, [storedColumns])

// Local pending state
const [localColumns, setLocalColumns] = useState<Set<MyColumnKey> | null>(null)
const [showColumnsPrompt, setShowColumnsPrompt] = useState(false)
const pendingColumns = useRef<Set<MyColumnKey> | null>(null)

const effectiveVisibleColumns = localColumns ?? visibleColumns

const handleSetVisibleColumns = useCallback((next: Set<MyColumnKey>) => {
  setLocalColumns(next)
  pendingColumns.current = next
  setShowColumnsPrompt(true)
}, [])

const handleSaveColumns = useCallback(() => {
  if (pendingColumns.current) {
    setStoredColumns(Array.from(pendingColumns.current).join(','))
    setLocalColumns(null)
    pendingColumns.current = null
  }
  setShowColumnsPrompt(false)
}, [setStoredColumns])

const handleDismissColumns = useCallback(() => { setShowColumnsPrompt(false) }, [])
```

```tsx
{/* Columns prompt */}
<PreferenceSavePrompt
  visible={showColumnsPrompt}
  onSave={handleSaveColumns}
  onDismiss={handleDismissColumns}
  label="Save column selection as your default?"
/>
```

##### 4. Place prompts outside the scrollable page container

Both `<PreferenceSavePrompt>` elements use CSS `position: fixed` and must be rendered **outside**
the `max-w-*` container div so they are not clipped:

```tsx
return (
  <div className="min-h-screen p-8">
    <div className={`${effectiveExpandedWidth ? 'max-w-full' : 'max-w-7xl'} mx-auto ...`}>
      {/* page content */}
    </div>

    {/* Prompts live outside the container */}
    <PreferenceSavePrompt visible={showWidthPrompt} onSave={handleSaveWidth} onDismiss={handleDismissWidth} label="Save page width as your default?" />
    <PreferenceSavePrompt visible={showColumnsPrompt} onSave={handleSaveColumns} onDismiss={handleDismissColumns} label="Save column selection as your default?" />
  </div>
)
```

### Integration checklist

When adding preferences to a page, verify each item:

- [ ] Imported `useUserPreference` and `PreferenceSavePrompt`.
- [ ] Used the page's URL slug as `page_key` (e.g. `'countries'`, not `'Countries'`).
- [ ] `DEFAULT_VISIBLE_KEYS` computed **outside** the component function (module-level constant).
- [ ] `effectiveExpandedWidth` / `effectiveVisibleColumns` used everywhere (not the raw stored value).
- [ ] Both `<PreferenceSavePrompt>` elements placed **outside** the `max-w-*` container.
- [ ] `handleSaveWidth` / `handleSaveColumns` clear the pending refs and local state after saving.
- [ ] `handleDismissWidth` / `handleDismissColumns` only hide the prompt (do not clear local state,
  so the UI change persists for this session even if not saved).
- [ ] Verified in both light and dark mode that the toast is visible (it uses a dark semi-transparent
  background that works in all themes).

### Supported pages (current)

| Page | `expanded_width` | `visible_columns` |
| ---- | :--------------: | :---------------: |
| LEI Records | ✅ | ✅ |
| Countries | ✅ | ✅ |
| Currencies | ✅ | — |
| Languages | ✅ | — |

### Sign-out cleanup

When the user signs out, the preference cache must be cleared so the next login does not receive
stale data. `UserBadge` already calls `resetPreferencesCache()` on sign-out:

```tsx
import { resetPreferencesCache } from '../lib/useUserPreference'

// inside sign-out handler:
resetPreferencesCache()
localStorage.removeItem('axiom_token')
localStorage.removeItem('axiom_user')
router.push('/login')
```

---

## Reusable Components

All Axiom pages **must** use the shared components found in `frontend/app/components/` rather than
writing inline one-off markup. This keeps presentation consistent and makes colour-scheme changes a
single-file operation.

### Badge

Coloured label chip for codes, status values, and classification tags.

```tsx
import Badge from '../components/Badge'

// Code chip (mono font, blue)
<Badge variant="blue" mono>{country.alpha2}</Badge>

// Status pill (pill shape, green)
<Badge variant="green" shape="pill">✓ Active</Badge>

// Inactive state
<Badge variant="gray">Inactive</Badge>
```

#### Props

| Prop | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `variant` | `blue \| green \| red \| yellow \| orange \| purple \| gray \| default` | `default` | Colour theme |
| `shape` | `rounded \| pill` | `rounded` | Border radius |
| `mono` | `boolean` | `false` | Use monospace font |
| `className` | `string` | `''` | Extra Tailwind classes |

#### Variant guide

| Variant | Use for |
| ------- | ------- |
| `blue` | Identifiers, ISO codes, system names |
| `green` | Active / allowed / success states |
| `red` | Error states, source codes, sanctioned |
| `yellow` | Warning, caution |
| `orange` | External system identifiers |
| `purple` | Coming-soon / future features |
| `gray` | Inactive / neutral |

---

### Alert

Notification banner for informational, warning, or error messages.

```tsx
import Alert from '../components/Alert'

// Info (default)
<Alert variant="info" title="💡 About Code Mappings:" className="mb-6">
  This table maps codes from external systems to internal identifiers.
</Alert>

// Error
<Alert variant="error" title="⚠️ Error:" className="mb-6">
  {error}
</Alert>

// Warning with conditional rendering
{error && (
  <Alert
    variant={error.includes('No data') ? 'warning' : 'error'}
    title={error.includes('No data') ? '📋 Notice:' : '⚠️ Error:'}
    className="mb-6"
  >
    {error}
  </Alert>
)}
```

#### Props

| Prop | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `variant` | `info \| warning \| error \| success` | `info` | Colour and meaning |
| `title` | `string` | — | Bold prefix text |
| `children` | `ReactNode` | — | Message body (supports JSX) |
| `className` | `string` | `''` | Extra Tailwind classes |

---

### LoadingSpinner

Full-page centred loading indicator. Use at the top of a page component whenever data is still
being fetched and there is nothing to show yet.

```tsx
import LoadingSpinner from '../components/LoadingSpinner'

if (loading && records.length === 0) {
  return <LoadingSpinner message="Loading LEI records..." />
}
```

#### Props

| Prop | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `message` | `string` | `'Loading...'` | Text shown below spinner |

---

### StatCard

Metric display card. Use in a responsive grid to show summary statistics at a glance.

```tsx
import StatCard from '../components/StatCard'

<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
  <StatCard title="Total Mappings" value={mappings.length} />
  <StatCard title="Active Mappings" value={activeMappings.length} accent="green" />
  <StatCard title="Source Systems" value={uniqueSystems.length} />
  <StatCard title="Filtered Results" value={filteredMappings.length} />
</div>
```

#### Props

| Prop | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `title` | `string` | — | Label above the value |
| `value` | `string \| number` | — | Large display value |
| `accent` | `green \| red \| blue \| yellow \| default` | `default` | Border and text colour |

---

### PageHeader

Standard page header — includes back link, page title, subtitle, `ThemeToggle`, and an optional
`actions` slot for per-page controls (e.g. refresh buttons, toggles).

```tsx
import PageHeader from '../components/PageHeader'

// Minimal
<PageHeader
  title="Countries"
  subtitle="Browse ISO 3166 country codes and reference data"
/>

// With custom actions
<PageHeader
  title="LEI Records"
  subtitle="GLEIF Legal Entity Identifiers (ISO 17442)"
  actions={
    <>
      <button onClick={refresh} className="px-4 py-2 bg-blue-600 text-white rounded-lg ...">
        🔄 Refresh
      </button>
    </>
  }
/>
```

#### Props

| Prop | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `title` | `string` | — | Page heading (rendered as `h1`) |
| `subtitle` | `string` | — | Descriptive subtext below the heading |
| `backHref` | `string` | `'/home'` | Destination of the back link |
| `backLabel` | `string` | `'← Back to Home'` | Back link label |
| `actions` | `ReactNode` | — | Extra controls rendered left of `ThemeToggle` |

> **Note:** `ThemeToggle` is always included in `PageHeader`. Do **not** import it separately on
> pages that use `PageHeader`.

---

### Adding New Pages — Checklist

When creating a new Axiom page always use the shared components:

- [ ] Import and use `<PageHeader>` — do **not** repeat the header div/back-link/ThemeToggle pattern
- [ ] Use `<LoadingSpinner>` for the initial load state — do **not** copy the spinner div
- [ ] Use `<Alert>` for error and notice banners — do **not** inline the coloured `div/p` pattern
- [ ] Use `<StatCard>` for metric grids — do **not** repeat the card `div` markup
- [ ] Use `<Badge>` for coloured labels — do **not** use raw `<span className="px-2 py-1 bg-... text-...">` chips

---

## Sticky Headers with Smooth Transitions

**Use Case:** Data tables or lists where column headers must remain visible during vertical
scrolling while preserving horizontal scroll capability.

**Decision Record:** See [ADR-0008](./adr/adr-0008-sticky-headers-with-smooth-transitions.md)

**Live Example:** `frontend/app/lei-records/page.tsx`

### When to Use

✅ Use this pattern when:

- Table has many rows requiring vertical scrolling
- Table has many columns requiring horizontal scrolling
- Users need to maintain column context while scrolling data
- Professional smooth transitions are required

❌ Don't use this pattern when:

- Table fits entirely in viewport (no scrolling needed)
- Only vertical OR horizontal scrolling (pure CSS `position: sticky` works)
- Mobile-first design (consider alternative patterns for small screens)

### Implementation Template

#### 1. Add State and Refs

```tsx
import { useRef, useState, useEffect } from 'react'

// Inside your component
const tableHeaderRef = useRef<HTMLTableSectionElement>(null)
const tableContainerRef = useRef<HTMLDivElement>(null)
const [showStickyHeader, setShowStickyHeader] = useState(false)
const [stickyHeaderStyle, setStickyHeaderStyle] = useState<{
  left: number
  width: number
}>({ left: 0, width: 0 })
```

#### 2. Add Scroll Detection useEffect

```tsx
// Optional: calculate offset if you have fixed elements at top (e.g., filter bar)
const hasFixedTopBar = false // Set to true if you have fixed navbar/filters
const fixedTopBarHeight = 0  // Height in pixels

useEffect(() => {
  const updateDimensionsAndCheckScroll = () => {
    if (!tableContainerRef.current) return
    
    const containerRect = tableContainerRef.current.getBoundingClientRect()
    
    // Update sticky header dimensions to match table
    setStickyHeaderStyle({
      left: containerRect.left,
      width: containerRect.width
    })
    
    // Show sticky header when original header scrolls above viewport
    const topOffset = hasFixedTopBar ? fixedTopBarHeight : 0
    setShowStickyHeader(containerRect.top < topOffset)
  }

  // Run immediately and on every scroll/resize
  updateDimensionsAndCheckScroll()
  
  window.addEventListener('scroll', updateDimensionsAndCheckScroll)
  window.addEventListener('resize', updateDimensionsAndCheckScroll)
  
  return () => {
    window.removeEventListener('scroll', updateDimensionsAndCheckScroll)
    window.removeEventListener('resize', updateDimensionsAndCheckScroll)
  }
}, [hasFixedTopBar, fixedTopBarHeight]) // Add dependencies as needed
```

#### 3. Add Sticky Header JSX

Place this **before** your main table container in the JSX:

```tsx
{/* Sticky Header - Always in DOM, visibility controlled by CSS */}
<div 
  className={`fixed z-30 overflow-x-auto bg-white border-b-2 border-gray-200 
              dark:bg-gray-800 dark:border-gray-700 shadow-lg 
              transition-all duration-300 ease-in-out ${
    showStickyHeader 
      ? 'opacity-100 translate-y-0' 
      : 'opacity-0 -translate-y-4 pointer-events-none'
  }`}
  style={{ 
    top: hasFixedTopBar ? `${fixedTopBarHeight}px` : '0px',
    left: `${stickyHeaderStyle.left}px`,
    width: `${stickyHeaderStyle.width}px`
  }}
>
  <table className="w-full" style={{ tableLayout: 'auto', borderCollapse: 'collapse' }}>
    <thead className="bg-gray-100 dark:bg-gray-800">
      <tr>
        {/* IMPORTANT: This MUST match your original table header exactly */}
        <th className="px-4 py-3 text-left text-xs font-medium uppercase">Column 1</th>
        <th className="px-4 py-3 text-left text-xs font-medium uppercase">Column 2</th>
        {/* ... more columns */}
      </tr>
    </thead>
  </table>
</div>
```

#### 4. Update Original Table Container

```tsx
<div 
  ref={tableContainerRef}
  className="overflow-x-auto bg-white border-2 border-gray-200 dark:bg-gray-800 dark:border-gray-700"
>
  <table className="w-full">
    <thead ref={tableHeaderRef} className="bg-gray-100 dark:bg-gray-800">
      <tr>
        <th className="px-4 py-3 text-left text-xs font-medium uppercase">Column 1</th>
        <th className="px-4 py-3 text-left text-xs font-medium uppercase">Column 2</th>
        {/* ... more columns */}
      </tr>
    </thead>
    <tbody>
      {/* Your table data */}
    </tbody>
  </table>
</div>
```

### Customization Options

#### Transition Speed

Adjust `duration-{time}` in sticky header className:

- `duration-200` - Fast (200ms)
- `duration-300` - Default (300ms) - Recommended
- `duration-500` - Slow (500ms)

#### Transition Effect

Modify the transition classes:

```tsx
{/* Current: Fade + Slide Down */}
className={showStickyHeader 
  ? 'opacity-100 translate-y-0' 
  : 'opacity-0 -translate-y-4 pointer-events-none'
}

{/* Alternative: Fade Only */}
className={showStickyHeader 
  ? 'opacity-100' 
  : 'opacity-0 pointer-events-none'
}

{/* Alternative: Slide from top without fade */}
className={showStickyHeader 
  ? 'translate-y-0' 
  : '-translate-y-full pointer-events-none'
}
```

#### Z-Index Management

If sticky header is hidden behind other fixed elements:

- Increase `z-30` to `z-40` or `z-50`
- Ensure fixed navbars/modals have lower z-index
- Common z-index hierarchy: navbar (z-40), sticky headers (z-30), modals (z-50)

### Dynamic Columns Example

For tables where columns can be shown/hidden dynamically:

```tsx
// State for visible columns
const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(['col1', 'col2']))

// Shared column rendering function
const renderHeaderColumns = () => (
  AVAILABLE_COLUMNS
    .filter(col => visibleColumns.has(col.key))
    .map(column => (
      <th key={column.key} className="px-4 py-3 text-left">
        {column.label}
      </th>
    ))
)

// Use in both headers
<thead className="bg-gray-100">
  <tr>{renderHeaderColumns()}</tr>
</thead>
```

### Clickable Headers (Sorting)

Both headers should support the same interactions:

```tsx
const renderHeaderCell = (column) => (
  <th 
    key={column.key}
    onClick={() => handleSort(column.key)}
    className="px-4 py-3 text-left cursor-pointer hover:bg-gray-200 transition-colors"
  >
    <div className="flex items-center gap-1">
      {column.label}
      {sortField === column.key && (
        <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
      )}
    </div>
  </th>
)

// Use in both headers
<thead>
  <tr>
    {COLUMNS.map(renderHeaderCell)}
  </tr>
</thead>
```

### Performance Optimization

#### Debounce Scroll Handler (Optional)

For extremely heavy pages, add debouncing:

```tsx
import { useCallback } from 'react'

// Debounce utility
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout
  return (...args: any[]) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// In useEffect
const handleScroll = useCallback(
  debounce(() => {
    if (!tableContainerRef.current) return
    // ... rest of logic
  }, 10), // 10ms debounce
  [hasFixedTopBar, fixedTopBarHeight]
)
```

#### RequestAnimationFrame (Alternative)

For even smoother performance:

```tsx
useEffect(() => {
  let rafId: number

  const updateDimensionsAndCheckScroll = () => {
    rafId = requestAnimationFrame(() => {
      if (!tableContainerRef.current) return
      // ... rest of logic
    })
  }

  window.addEventListener('scroll', updateDimensionsAndCheckScroll)
  return () => {
    window.removeEventListener('scroll', updateDimensionsAndCheckScroll)
    cancelAnimationFrame(rafId)
  }
}, [hasFixedTopBar, fixedTopBarHeight])
```

### Accessibility Considerations

- **Keyboard Navigation:** Ensure clickable header cells are keyboard accessible
- **Screen Readers:** Both headers should have identical ARIA labels
- **Focus Management:** Hidden sticky header should not be focusable (`pointer-events-none` prevents this)

Example with ARIA:

```tsx
<th 
  onClick={() => handleSort(column.key)}
  onKeyDown={(e) => e.key === 'Enter' && handleSort(column.key)}
  tabIndex={0}
  role="button"
  aria-label={`Sort by ${column.label}`}
  aria-sort={sortField === column.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
>
  {column.label}
</th>
```

### Troubleshooting

#### Header width doesn't match table

**Problem:** Sticky header is wider/narrower than table  
**Solution:** Ensure `tableContainerRef` is on the direct parent of the table, not a wrapper several levels up

#### Header appears but is invisible

**Problem:** Width or left is 0  
**Solution:** Check that `tableContainerRef.current` exists before `showStickyHeader` becomes true.
Call dimensions update immediately in useEffect.

#### Header doesn't appear at all

**Problem:** `containerRect.top` never goes negative  
**Solution:** Check that you're scrolling the window, not a nested scrollable div. If nested,
attach scroll listener to that element instead.

#### Transition is choppy

**Problem:** Browser reflow during scroll  
**Solution:** Avoid changing layout properties during scroll. Use `transform` and `opacity` only (GPU-accelerated).

#### Header appears too early/late

**Problem:** `topOffset` calculation incorrect  
**Solution:** Measure your fixed top elements accurately. Use `element.offsetHeight` or
`getBoundingClientRect().height`.

---

## Frozen Columns Checklist

Use this checklist for any table with frozen/sticky identity columns (for example `LEI` + `Legal Name`)
to prevent divider drift and bleed-through.

- [ ] Apply sticky/frozen behavior identically to both header (`th`) and body (`td`) cells.
- [ ] Derive frozen column width and left offset from measured rendered header widths (not hard-coded values only).
- [ ] Use explicit background colors on frozen cells in both light and dark mode.
- [ ] Use a consistent z-index stack so frozen body cells stay above scrolling cells, and frozen
  header cells stay above frozen body cells.
- [ ] Render the separator seam using the same primitive for header and body (prefer inset
  right-edge seam inside the cell).
- [ ] Avoid negative-offset seam techniques (such as `right: -1px`) that can create sub-pixel
  mismatch during horizontal scroll.
- [ ] Verify seam behavior in all combinations: light/dark, narrow/expanded width, and after
  small + large horizontal scroll movements.
- [ ] Verify no horizontal content bleeds through the frozen divider boundary at any scroll position.

---

## Brand Theme Asset Switch

Use this when you want to switch the active brand from the current primary set to the prepared
black/white variant.

### Source and generated asset locations

- Primary source: `docs/assets/branding/axiom-logo-source.jfif`
- Alternate source: `docs/assets/branding/axiom-logo-alt-bw-source.jfif`
- Active runtime assets: `frontend/public/branding/*`
- Alternate runtime assets: `frontend/public/branding/alt-bw/*`

### Activate the alternate icon set

Edit `frontend/app/layout.tsx` in `metadata.icons`:

```tsx
icons: {
  icon: [
    { url: '/branding/alt-bw/favicon.ico' },
    { url: '/branding/alt-bw/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    { url: '/branding/alt-bw/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
  ],
  apple: '/branding/alt-bw/apple-touch-icon.png',
},
```

### Activate the alternate landing-page logo

Edit `frontend/app/page.tsx` and set the logo image `src` to:

```tsx
src="/branding/alt-bw/logo.png"
```

### Revert to primary branding

- Restore icon paths in `frontend/app/layout.tsx` back to `/branding/...`
- Restore landing logo `src` in `frontend/app/page.tsx` back to `/branding/logo.png`

---

## Entry Route Model

The frontend uses a two-step entry flow:

- `/` — branding-only entry page with navigation choices.
- `/home` — public reference data hub (countries, currencies, languages, LEI records).
- `/dashboard` — combined all-options module landing (public + protected + acquisition + admin section).

Protected modules remain behind authentication and are reached after sign-in.

### Navigation defaults

- `PageHeader` default back link points to `/home`.
- For mixed-access pages (available to both public and authenticated users), make the back target auth-aware:
  - authenticated user → `/dashboard`
  - public user → `/home`
- For auth-only module pages, use explicit `backHref="/dashboard"` and `backLabel="← Back to Dashboard"`.

### Current `PageHeader` route matrix

| Route | Access model | Back-link behaviour |
| ----- | ------------ | ------------------- |
| `/dashboard` | Auth-only landing | No back link (`showBackLink={false}`) |
| `/home` | Public landing | No back link (`showBackLink={false}`) |
| `/admin/users` | Auth-only | Fixed to `/dashboard` |
| `/accounts` | Auth-only | Fixed to `/dashboard` |
| `/instruments` | Auth-only | Fixed to `/dashboard` |
| `/ssi` | Auth-only | Fixed to `/dashboard` |
| `/code-mappings` | Auth-only | Fixed to `/dashboard` |
| `/countries` | Mixed-access | Auth-aware (`/dashboard` if logged in, else `/home`) |
| `/currencies` | Mixed-access | Auth-aware (`/dashboard` if logged in, else `/home`) |
| `/languages` | Mixed-access | Auth-aware (`/dashboard` if logged in, else `/home`) |
| `/lei` | Mixed-access | Auth-aware (`/dashboard` if logged in, else `/home`) |
| `/lei-records` | Mixed-access | Auth-aware (`/dashboard` if logged in, else `/home`) |

- New pages must declare one of these three models: public landing (no back link),
  auth-only (fixed `/dashboard`), or mixed-access (auth-aware `/dashboard`/`/home`).
- Login success redirects to `/dashboard` for non-bootstrap users.
- `/home` shows `All Modules` only for authenticated users; it routes to `/dashboard`.
- Auth pages may still use explicit links to `/` when they should return to the branding entry.

---

## Best Practices

### General UI Patterns

1. **Prefer CSS Transitions over JavaScript animations** - GPU-accelerated, smoother
2. **Always provide feedback for user actions** - Loading states, hover effects, transitions
3. **Use Tailwind's transition utilities** - Consistent timing functions across app
4. **Test on real devices** - Performance varies significantly on mobile
5. **Consider reduced motion preference** - Respect `prefers-reduced-motion` media query

### Dark Mode Support

All patterns should support dark mode via Tailwind's `dark:` variant:

```tsx
className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
```

### Responsive Design

- Test sticky headers on various viewport sizes
- Consider collapsing columns on mobile
- Ensure horizontal scroll indicators are visible on touch devices

---

## Contributing New Patterns

When adding a new UI pattern to this guide:

1. **Implement and test** in a real feature first
2. **Create an ADR** documenting the decision (if architectural)
3. **Extract the pattern** into a reusable template
4. **Add to this guide** with complete example
5. **Include troubleshooting section** based on actual issues encountered
6. **Test the template** by implementing in a different feature

---

## Related Documentation

- [ADR-0006: Next.js and Tailwind CSS](./adr/adr-0006-nextjs-tailwind-frontend.md)
- [ADR-0008: Sticky Headers with Smooth Transitions](./adr/adr-0008-sticky-headers-with-smooth-transitions.md)
- [ADR-0011: User Preferences](./adr/adr-0011-user-preferences.md)
- [Frontend UI Guidelines](.github/instructions/frontend-ui.instructions.md)
- [Performance Optimization](.github/instructions/performance-optimization.instructions.md)
