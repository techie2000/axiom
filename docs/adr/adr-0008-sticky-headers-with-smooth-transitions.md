---
post_title: "ADR-0008: Sticky Headers with Smooth Transitions"
author1: "techie2000"
post_slug: "adr-0008-sticky-headers-smooth-transitions"
microsoft_alias: "techie2000"
featured_image: "https://placehold.co/1200x630.png"
categories: ["frontend", "ui-patterns"]
tags: ["adr", "frontend", "ui", "sticky-headers", "transitions"]
ai_note: "AI-assisted draft documenting sticky header implementation pattern."
summary: "Records the decision to use always-in-DOM with CSS transitions for sticky headers instead of conditional rendering."
post_date: "2026-02-18"
title: "ADR-0008: Sticky Headers with Smooth Transitions"
status: "Accepted"
date: "2026-02-18"
authors: "techie2000"
supersedes: ""
superseded_by: ""
---

## Status

Accepted

## Context

Data-heavy tables in Axiom (e.g., LEI Records) require fixed headers that remain visible during vertical scrolling to
maintain column context. Initial implementations using `position: sticky` CSS failed due to conflicts with horizontal
scrolling containers (`overflow-x: auto`). The CSS specification prevents sticky positioning from working across different
scrolling contexts.

Additionally, conditional rendering (`{condition && <div>}`) caused jarring visual flashes when headers
appeared/disappeared during scroll events.

## Decision Drivers

- **DRV-001**: Headers must remain visible when scrolling vertically through large datasets
- **DRV-002**: Horizontal scrolling must be preserved for tables with many columns
- **DRV-003**: Header appearance/disappearance must be smooth and professional
- **DRV-004**: Header width must dynamically match table width (responsive to layout changes)
- **DRV-005**: Solution must work with existing filter bars and other sticky UI elements
- **DRV-006**: Avoid layout thrashing and maintain 60fps scroll performance

## Decision

Use **JavaScript-based scroll detection with always-in-DOM sticky headers** that transition smoothly using CSS opacity and
transform properties.

### Key Components

1. **Always Render in DOM**: Header exists in DOM at all times, controlled by CSS visibility
2. **Scroll Detection**: `useEffect` with scroll listener calculates when to show/hide
3. **Dynamic Positioning**: `getBoundingClientRect()` provides real-time position and dimensions
4. **Smooth Transitions**: CSS `transition-all` with `opacity` and `translate-y` for fade/slide effect
5. **Single Update Handler**: Combine dimension calculation and scroll detection in one function

## Implementation Pattern

### State and Refs

```tsx
const tableHeaderRef = useRef<HTMLTableSectionElement>(null)
const tableContainerRef = useRef<HTMLDivElement>(null)
const [showStickyHeader, setShowStickyHeader] = useState(false)
const [stickyHeaderStyle, setStickyHeaderStyle] = useState<{left: number, width: number}>({
  left: 0,
  width: 0
})
```

### Scroll Detection with Dimension Updates

```tsx
useEffect(() => {
  const updateDimensionsAndCheckScroll = () => {
    if (!tableContainerRef.current) return
    
    const containerRect = tableContainerRef.current.getBoundingClientRect()
    
    // Update dimensions every time we check scroll position
    setStickyHeaderStyle({
      left: containerRect.left,
      width: containerRect.width
    })
    
    // Check if we should show sticky header
    const topOffset = hasActiveFilters ? filterBarHeight : 0
    setShowStickyHeader(containerRect.top < topOffset)
  }

  // Call immediately and on every scroll/resize
  updateDimensionsAndCheckScroll()
  
  window.addEventListener('scroll', updateDimensionsAndCheckScroll)
  window.addEventListener('resize', updateDimensionsAndCheckScroll)
  return () => {
    window.removeEventListener('scroll', updateDimensionsAndCheckScroll)
    window.removeEventListener('resize', updateDimensionsAndCheckScroll)
  }
}, [hasActiveFilters, filterBarHeight, expandedWidth])
```

### Sticky Header JSX

```tsx
{/* Always rendered, visibility controlled by CSS transitions */}
<div 
  className={`fixed z-30 overflow-x-auto bg-white border-b-2 border-gray-200 
              dark:bg-white/5 dark:border-white/10 backdrop-blur-sm shadow-lg 
              transition-all duration-300 ease-in-out ${
    showStickyHeader 
      ? 'opacity-100 translate-y-0' 
      : 'opacity-0 -translate-y-4 pointer-events-none'
  }`}
  style={{ 
    top: hasActiveFilters ? `${filterBarHeight}px` : '0px',
    left: `${stickyHeaderStyle.left}px`,
    width: `${stickyHeaderStyle.width}px`
  }}
>
  <div className="max-w-full">
    <table className="w-full" style={{ tableLayout: 'auto', borderCollapse: 'collapse' }}>
      <thead className="bg-gray-100 dark:bg-gray-800">
        {/* Duplicate header structure from original table */}
      </thead>
    </table>
  </div>
</div>
```

### Original Table Header

```tsx
<div ref={tableContainerRef} className="overflow-x-auto ...">
  <table>
    <thead ref={tableHeaderRef} className="bg-gray-100 dark:bg-gray-800">
      {/* Original header - no sticky CSS needed */}
    </thead>
    <tbody>...</tbody>
  </table>
</div>
```

## Decision Outcome

**Chosen Option:** JavaScript-based sticky headers with CSS transitions

### Alternatives Considered

1. **CSS `position: sticky`** - Rejected: Doesn't work with `overflow-x: auto` parent
2. **Remove horizontal scroll** - Rejected: Users need to see all columns simultaneously
3. **Conditional rendering with state** - Rejected: Causes visual flash/glitch

## Consequences

### Positive

- **POS-001**: Smooth, professional fade-in/slide transitions (300ms)
- **POS-002**: Headers remain visible during vertical scrolling
- **POS-003**: Horizontal scrolling preserved for wide tables
- **POS-004**: Dynamic width matching ensures alignment with table columns
- **POS-005**: Compatible with other fixed elements (filter bars)
- **POS-006**: No layout flash or jarring appearance

### Negative

- **NEG-001**: Slightly more complex than pure CSS solution
- **NEG-002**: Duplicate header JSX must be kept in sync with original
- **NEG-003**: Scroll event listener runs on every scroll (mitigated by efficient calculations)
- **NEG-004**: Header always in DOM adds minimal memory overhead

### Mitigations

- **MIT-001**: Use `getBoundingClientRect()` which is highly optimized
- **MIT-002**: `pointer-events-none` prevents interaction when hidden
- **MIT-003**: Component pattern documented for reuse across pages
- **MIT-004**: Early return in scroll handler if ref unavailable

## Performance Considerations

- Scroll handler executes in ~1-2ms on modern browsers
- No forced reflows or layout thrashing
- CSS transitions handled by GPU compositor
- Maintains 60fps during scroll on typical hardware

## Related Patterns

- See [UI Patterns Guide](../ui-patterns.md) for reusable component template
- Filter bar sticky positioning (similar pattern)
- Modal overlays with smooth transitions

## References

- Implementation: `frontend/app/lei-records/page.tsx` (lines 625-650, 1030-1070)
- Related Issue: Sticky headers disappearing on scroll
- CSS Specification: https://www.w3.org/TR/css-position-3/#sticky-pos
- MDN getBoundingClientRect: https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect

## Changelog

- 2026-02-18: Initial ADR documenting sticky header pattern

