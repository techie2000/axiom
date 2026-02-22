# UI Patterns Guide

Reusable UI patterns and components for the Axiom frontend. These patterns have been
tested and optimized for performance, accessibility, and user experience.

## Table of Contents

- [Sticky Headers with Smooth Transitions](#sticky-headers-with-smooth-transitions)
- [Virtual Columns (Derived Display Data)](#virtual-columns-derived-display-data)
- [Protected API Sample Fallback](#protected-api-sample-fallback)
- [Table Cell Content Visibility](#table-cell-content-visibility)
- [Best Practices](#best-practices)

---

## Virtual Columns (Derived Display Data)

Use virtual columns for values that are deterministic and presentation-oriented, rather than storing them in the
database.

### Country Flag Emoji Pattern

- Source of truth: ISO alpha-2 country code (for example, `GB`, `SE`, `JP`)
- Derived value: flag emoji rendered in UI
- Shared helper: `frontend/app/lib/country-flag.ts`

### Why this pattern

- Avoids schema bloat for non-business data
- Keeps seed/reference loads simpler
- Ensures one consistent conversion implementation across pages

### Reuse guidance

- Import and reuse the shared helper anywhere country flags are shown (countries, SSI, accounts, etc.)
- Do not duplicate inline conversion code in page components
- If a module is still in placeholder state (no finalized list/table schema), defer adding the virtual column until
  that schema is defined

---

## Protected API Sample Fallback

Use a consistent fallback strategy for pages that depend on authenticated APIs.

### Why this pattern

- Keeps pages usable when users are not authenticated yet
- Avoids blank/error-only screens during local development and demos
- Provides deterministic UI behavior while still surfacing API/auth status

### Required behavior

- Attempt authenticated fetch using existing token keys (`token`, `jwt`, `authToken`, `access_token`)
- On `401`/`403` or API connectivity failures, load approved sample rows
- Display a visible banner indicating source:
  - `✅ Data Source:` for live API data
  - `📋 Notice:` for sample fallback

### Template

```tsx
const [dataMode, setDataMode] = useState<'api' | 'sample'>('api')
const [infoMessage, setInfoMessage] = useState('')

if (response.ok) {
  setRows(apiRows)
  setDataMode('api')
  setInfoMessage('Loaded from API.')
} else {
  setRows(SAMPLE_ROWS)
  setDataMode('sample')
  setInfoMessage('API requires authentication. Showing sample data.')
}
```

---

## Table Cell Content Visibility

Use wrapping cell styles for fields that can exceed a single line.

### Why this pattern

- Prevents hidden business values in narrow columns
- Keeps sample and live data equally readable
- Allows row height to expand naturally instead of clipping content

### Required behavior

- Avoid `truncate` for primary data fields.
- Use wrapped multi-line cells for long text: `whitespace-normal break-words leading-relaxed align-top`.
- Keep tag/code-style compact cells (`whitespace-nowrap`) only for short fixed-width values.

### Template

```tsx
<td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-normal break-words leading-relaxed align-top">
  {row.description || '—'}
</td>
```

---

## Sticky Headers with Smooth Transitions

**Use Case:** Data tables or lists where column headers must remain visible during
vertical scrolling while preserving horizontal scroll capability.

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
**Solution:** Ensure `tableContainerRef` is on the direct parent of the table, not a wrapper
several levels up

#### Header appears but is invisible

**Problem:** Width or left is 0  
**Solution:** Check that `tableContainerRef.current` exists before `showStickyHeader` becomes
true. Call dimensions update immediately in useEffect.

#### Header doesn't appear at all

**Problem:** `containerRect.top` never goes negative  
**Solution:** Check that you're scrolling the window, not a nested scrollable div. If nested,
attach scroll listener to that element instead.

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

### Table Row Hover Contrast

- Light mode table row hover should be clearly visible: use `hover:bg-blue-50` with `transition-colors`.
- Avoid subtle light hover shades like `hover:bg-gray-50` on primary data rows.
- Keep dark mode hover behavior aligned with current table styles (for example, `dark:hover:bg-white/10`).

Example:

```tsx
<tr className="hover:bg-blue-50 dark:hover:bg-white/10 transition-colors">
  {/* row cells */}
</tr>
```

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
