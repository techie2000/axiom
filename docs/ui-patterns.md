# UI Patterns Guide

Reusable UI patterns and components for the Axiom frontend. These patterns have been tested and optimized for performance, accessibility, and user experience.

## Table of Contents

- [Reusable Components](#reusable-components)
- [Sticky Headers with Smooth Transitions](#sticky-headers-with-smooth-transitions)
- [Best Practices](#best-practices)

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
|------|------|---------|-------------|
| `variant` | `blue \| green \| red \| yellow \| orange \| purple \| gray \| default` | `default` | Colour theme |
| `shape` | `rounded \| pill` | `rounded` | Border radius |
| `mono` | `boolean` | `false` | Use monospace font |
| `className` | `string` | `''` | Extra Tailwind classes |

#### Variant guide

| Variant | Use for |
|---------|---------|
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
|------|------|---------|-------------|
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
|------|------|---------|-------------|
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
|------|------|---------|-------------|
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
|------|------|---------|-------------|
| `title` | `string` | — | Page heading (rendered as `h1`) |
| `subtitle` | `string` | — | Descriptive subtext below the heading |
| `backHref` | `string` | `'/'` | Destination of the back link |
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

**Use Case:** Data tables or lists where column headers must remain visible during vertical scrolling while preserving horizontal scroll capability.

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
**Solution:** Check that `tableContainerRef.current` exists before `showStickyHeader` becomes true. Call dimensions update immediately in useEffect.

#### Header doesn't appear at all
**Problem:** `containerRect.top` never goes negative  
**Solution:** Check that you're scrolling the window, not a nested scrollable div. If nested, attach scroll listener to that element instead.

#### Transition is choppy
**Problem:** Browser reflow during scroll  
**Solution:** Avoid changing layout properties during scroll. Use `transform` and `opacity` only (GPU-accelerated).

#### Header appears too early/late
**Problem:** `topOffset` calculation incorrect  
**Solution:** Measure your fixed top elements accurately. Use `element.offsetHeight` or `getBoundingClientRect().height`.

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
- [Frontend UI Guidelines](.github/instructions/frontend-ui.instructions.md)
- [Performance Optimization](.github/instructions/performance-optimization.instructions.md)
