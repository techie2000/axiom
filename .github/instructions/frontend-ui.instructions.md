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
  <div className="absolute inset-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm z-50 flex items-center justify-center">
    <div className="bg-white dark:bg-gray-800 px-6 py-4 rounded-lg shadow-lg border-2 border-blue-500">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-400"></div>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-2">Loading...</p>
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
- Filter controls must be wrapped in a visible bordered container (LEI pattern), e.g. `bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg p-6`.
- Provide a `Clear Filters` action whenever a page has two or more filters (search counts as a filter).
- Show `Clear Filters` only when at least one filter is active (LEI Records behavior).
- `Clear Filters` should reset all filter inputs to default values in one click.
- For dark mode readability, all `<select>` controls must style both the `<select>` and each `<option>` explicitly.
- Search inputs with long placeholder guidance must show a tooltip when placeholder text is clipped.
- Use shared component `frontend/app/components/SearchInputWithOverflowTooltip.tsx` for search/filter text inputs.
- Do not implement page-specific placeholder tooltip logic; keep behavior centralized and reusable.

### Column Selector Standard (Required)
- Any page with a `Columns` control must list **all table columns** (core + optional), not only optional columns.
- Core columns may be toggled off by users; preserve usability by defining a `defaultVisible` preset and a `Reset Default` action.
- Include `Select All` and `Reset Default` actions in the selector.
- The `Columns` count should reflect current visible column count.
- Use the LEI Records pattern as the baseline implementation for grouped or ungrouped column selectors.

### Table Width Toggle Standard (Required)
- Pages with wide data tables and optional columns must provide an `Expand/Normal` width toggle in the page header.
- Use `max-w-full` when expanded and `max-w-7xl` when normal, with `transition-all duration-300` for consistent behavior.
- Default to expanded width (`expandedWidth = true`) on pages where selected optional columns would otherwise force immediate horizontal scrolling.
- Keep horizontal scrolling as a fallback only; do not rely on horizontal scrolling as the primary way to access newly enabled columns.

### Table Row Hover Contrast Standard (Required)
- Data table rows must provide clearly visible hover contrast in light mode.
- Use `hover:bg-blue-50` for light mode row hover states (or stronger approved equivalent), not subtle gray shades.
- Preserve dark mode row hover behavior (for example, `dark:hover:bg-white/10` or `dark:hover:bg-white/5`).
- Include `transition-colors` on interactive table rows for consistent visual feedback.

### Virtual/Derived Columns Standard (Required)
- Prefer **virtual/derived UI columns** for deterministic display data (for example, country flag emoji from ISO alpha-2 country code).
- Do not persist deterministic presentation-only fields in database schemas or initial seed data unless there is a clear business requirement.
- Implement derived value logic in a reusable utility and consume it across pages to ensure consistency.
- For country flags, use the shared helper in `frontend/app/lib/country-flag.ts` instead of duplicating conversion logic.
- Render country flags via shared component `frontend/app/components/CountryFlag.tsx` to ensure consistent display across OS/browser font differences.
- If a page does not yet have a finalized table/list layout (for example, placeholder/coming-soon pages), defer derived column rendering until the page schema is defined.

### Landing Cards Standard (Required)
- Cards within the same landing-page section must use a shared component and identical interaction/visual behavior.
- In the **Master Data Management** section, cards (Instruments, Accounts, SSI, Code Mappings) must keep consistent structure:
  title, description, single `Protected` badge, icon placement, min height, and hover behavior.
- Do not add special-case badges or card-specific layout differences within the same section unless explicitly requested.

```tsx
<select className="bg-white dark:bg-white/5 text-gray-900 dark:text-white border-gray-300 dark:border-white/20">
  <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="">All</option>
</select>
```

## Accessibility

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

Users should never be forced to use the mouse to close UI elements. Implement keyboard shortcuts for all interactive overlays:

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

### Loading States
```typescript
if (loading && records.length === 0) {
  return (
    <div className="text-center py-20">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="mt-4 opacity-70">Loading...</p>
    </div>
  )
}
```

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [ISO 8601 Date Format](https://en.wikipedia.org/wiki/ISO_8601)
- [Web Content Accessibility Guidelines (WCAG)](https://www.w3.org/WAI/WCAG21/quickref/)

---

## Summary

- **Dates**: Always ISO 8601 format (yyyy-mm-dd) - NEVER use toLocaleDateString()
- **Styling**: Glassmorphism dark mode by default
- **TypeScript**: Strong typing for all data structures
- **Accessibility**: Semantic HTML and keyboard navigation
- **Performance**: Pagination and lazy loading for large datasets
