---
post_title: "ADR-0014: WCAG Accessibility Standards for the Frontend"
author1: "techie2000"
post_slug: "adr-0014-wcag-accessibility-standards"
microsoft_alias: "techie2000"
featured_image: "https://placehold.co/1200x630.png"
categories: ["frontend"]
tags: ["adr", "frontend", "wcag", "accessibility", "contrast", "focus"]
ai_note: "AI-assisted draft based on accessibility audit and WCAG 2.2 requirements."
summary: "Records the decision to adopt WCAG 2.2 AA as the accessibility baseline for the Axiom frontend."
post_date: "2026-03-17"
title: "ADR-0014: WCAG Accessibility Standards for the Frontend"
status: "Accepted"
date: "2026-03-17"
authors: "techie2000"
supersedes: ""
superseded_by: ""
---

## Status

Accepted

## Context

A targeted accessibility audit of the Axiom frontend identified several gaps against WCAG (Web Content
Accessibility Guidelines) 2.2 Level AA. Specific findings included:

- Back-navigation links using `text-blue-400` in light mode, yielding a contrast ratio of ~3.0:1 against white
  (below the 4.5:1 minimum for normal text under SC 1.4.3).
- Loading spinners rendered with a single `border-b-2` edge, providing minimal visual cue for users with low vision
  or those relying on colour perception.
- Sort buttons in table headers and pagination controls lacking visible focus indicators, violating SC 2.4.7.
- Interactive icon buttons (ThemeToggle, UserBadge trigger) missing programmatic focus rings and using
  `border-white/20` that becomes invisible on light backgrounds, violating SC 1.4.11.

There was no documented accessibility standard or enforcement process in place, making it difficult to prevent
regressions in future pull requests.

## Decision Drivers

- **DRV-001**: Reduce barriers for users of assistive technologies (screen readers, keyboard-only navigation).
- **DRV-002**: Ensure readability across both light and dark themes without relying on theme-specific overrides
  that could be missed.
- **DRV-003**: Prevent contrast and focus regressions from shipping undetected during code review.
- **DRV-004**: Align with industry-standard guidelines (WCAG 2.2) that are referenced in procurement and
  regulatory contexts.
- **DRV-005**: Minimise the cost of compliance by encoding standards into reusable shared components rather than
  per-page overrides.

## Decision

Adopt **WCAG 2.2 Level AA** as the accessibility baseline for all Axiom frontend work.

### Specific Criteria Addressed

| WCAG SC | Title | Target |
| ------- | ----- | ------ |
| 1.4.3 | Contrast (Minimum) | Normal text ≥ 4.5:1, large/bold text ≥ 3:1 |
| 1.4.11 | Non-text Contrast | UI component boundaries and focus indicators ≥ 3:1 |
| 2.4.7 | Focus Visible | All keyboard-focusable elements have a visible focus indicator |
| 2.4.11 | Focus Appearance (Minimum) | Focus indicator area and contrast meet minimum thresholds |

### Approved Tailwind Patterns

#### Colour for Links and Interactive Text

```tsx
// ✅ CORRECT — passes 4.5:1 on white in light mode; 4.7:1 on dark bg in dark mode
className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"

// ❌ INCORRECT — ~3.0:1 on white (fails SC 1.4.3 for normal text)
className="text-blue-400 hover:text-blue-300"
```

#### Focus Indicators

All interactive elements (buttons, links, inputs, selects) must carry:

```tsx
// Preferred pattern — uses focus-visible to avoid showing ring on mouse click
className="... focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"

// For elements on dark backgrounds where offset is less important
className="... focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
```

#### Loading Spinners

```tsx
// ✅ CORRECT — full ring with coloured arc; visible in light and dark modes
<div
  className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-400"
  role="status"
  aria-label="Loading..."
/>

// ❌ INCORRECT — single edge, low visibility
<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
```

#### Icon-only Buttons and Toolbar Controls

```tsx
// ✅ CORRECT — visible border in both themes, programmatic focus ring, aria-label
<button
  aria-label="Switch to dark mode"
  className="h-9 w-9 ... border border-gray-400/50 dark:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
>
  🌙
</button>

// ❌ INCORRECT — border invisible on light bg, no focus ring, no aria-label
<button className="... border border-white/20" title="Switch to dark mode">🌙</button>
```

#### Disabled Buttons

WCAG 1.4.3 exempts disabled controls from contrast requirements, but we still use legible colours to
aid discoverability:

```tsx
// Acceptable disabled palette
className="disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-600 dark:disabled:text-gray-400"
```

## Decision Outcome

**Chosen Option:** WCAG 2.2 Level AA baseline enforced through shared components and documented patterns.

## Consequences

### Positive

- **POS-001**: Keyboard-only users can navigate all interactive controls with a clear visual focus indicator.
- **POS-002**: Users with low vision or colour deficiency can read all text and identify all UI boundaries at
  AA contrast ratios.
- **POS-003**: Screen readers receive programmatic labels (`aria-label`, `role="status"`) for non-text elements.
- **POS-004**: Shared components (LoadingSpinner, SortableHeaderCell, ThemeToggle, TablePaginationControls,
  UserBadge, PageHeader) are the single source of truth; per-page overrides that downgrade accessibility will
  be caught in code review using the documented checklist.

### Negative

- **NEG-001**: Slightly more verbose Tailwind class strings on interactive elements.
- **NEG-002**: Light-mode border tokens (`border-gray-400/50`) differ from the dark-mode convention
  (`border-white/20`), requiring dual declarations.

### Mitigation

- **MIT-001**: The shared accessibility checklist (see
  [docs/accessibility/WCAG_COMPLIANCE.md](../accessibility/WCAG_COMPLIANCE.md)) provides quick reference for
  reviewers without requiring full WCAG expertise.
- **MIT-002**: The `focus-visible:` pseudo-class variant prevents focus rings from appearing on mouse
  interaction, preserving the visual design while keeping full keyboard accessibility.

## Alternatives Considered

### WCAG 2.1 Level A Only

- **Rejection Reason**: Level A omits contrast requirements (SC 1.4.3 is Level AA). Too minimal for a
  production-grade application.

### Automated Axe / Pa11y CI Enforcement

- **Description**: Run automated accessibility scanning in CI (axe-core, Pa11y) on every pull request.
- **Outcome**: Deferred — high value but outside the scope of this immediate hardening pass. Can be adopted
  in a follow-up without conflicting with this ADR. Recommended as a future enhancement.

### Static Analysis via eslint-plugin-jsx-a11y (Implemented)

- **Description**: Add `eslint-plugin-jsx-a11y` as a dev dependency and configure it in `.eslintrc.json`.
  A dedicated `lint-frontend` CI job runs `next lint` (which invokes ESLint with the plugin) on every PR.
  This catches common accessibility violations statically — missing alt text, unassociated labels,
  non-interactive elements with click handlers, invalid ARIA attributes — at the time of authoring, not at runtime.
- **Outcome**: Adopted. The `lint-frontend` job is included in the `ci-summary` gate so any new violation
  blocks the PR. Pre-existing violations in the codebase were resolved as part of this ADR implementation.

### Component-level Unit Tests for Contrast

- **Description**: Write Jest/Vitest tests that assert computed contrast ratios against WCAG thresholds.
- **Outcome**: Deferred — difficult to test with JSDOM due to the absence of CSS rendering. Visual regression
  testing tools (Chromatic, Percy) are a better fit and can be adopted independently.

## Implementation Notes

- **IMP-001**: Shared components updated in this decision: `LoadingSpinner`, `PageHeader`, `SortableHeaderCell`,
  `ThemeToggle`, `TablePaginationControls`, `UserBadge`.
- **IMP-002**: Developer reference guide at
  [docs/accessibility/WCAG_COMPLIANCE.md](../accessibility/WCAG_COMPLIANCE.md).
- **IMP-003**: PR checklist item added to
  [.github/instructions/frontend-ui.instructions.md](../../.github/instructions/frontend-ui.instructions.md).
- **IMP-004**: Static analysis enforcement via `eslint-plugin-jsx-a11y` is live in the `lint-frontend` CI job.
  Future runtime enforcement (axe-core in CI against a running server) remains a recommended follow-up.

## References

- **REF-001**: [WCAG 2.2 Overview](https://www.w3.org/TR/WCAG22/)
- **REF-002**: [SC 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- **REF-003**: [SC 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- **REF-004**: [SC 2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)
- **REF-005**: [SC 2.4.11 Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)
- **REF-006**: [Developer Reference](../accessibility/WCAG_COMPLIANCE.md)
- **REF-007**: [frontend-ui.instructions.md](../../.github/instructions/frontend-ui.instructions.md)
- **REF-008**: [ADR-0006: Next.js and Tailwind Frontend](adr-0006-nextjs-tailwind-frontend.md)

## Revision History

- **2026-03-17**: Initial decision documenting WCAG 2.2 AA baseline and component fixes
- **2026-03-17**: Added `eslint-plugin-jsx-a11y` static enforcement via new `lint-frontend` CI job; resolved
  pre-existing violations in `lei-records/page.tsx` and `UserBadge.tsx`.
