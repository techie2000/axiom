# WCAG Compliance Developer Reference

This guide explains the WCAG 2.2 Level AA requirements that apply to Axiom frontend work, with
practical Tailwind CSS patterns and a PR checklist.

The formal decision is recorded in
[ADR-0014](../adr/adr-0014-wcag-accessibility-standards.md).

## Table of Contents

- [Why WCAG Matters](#why-wcag-matters)
- [Applicable Success Criteria](#applicable-success-criteria)
- [Contrast Quick Reference](#contrast-quick-reference)
- [Approved Tailwind Patterns](#approved-tailwind-patterns)
- [Component-level Rules](#component-level-rules)
- [CI Enforcement](#ci-enforcement)
- [PR Verification Checklist](#pr-verification-checklist)
- [Testing Tools](#testing-tools)
- [Common Anti-patterns](#common-anti-patterns)

---

## Why WCAG Matters

WCAG (Web Content Accessibility Guidelines) 2.2 is the internationally recognised standard for web
accessibility. Following Level AA ensures that Axiom is usable by people who:

- Navigate exclusively by keyboard (no mouse)
- Use a screen reader (NVDA, JAWS, VoiceOver)
- Have low vision and rely on high-contrast displays or browser zoom
- Cannot distinguish certain colours (colour blindness affects ~8% of men)

Failure to meet these criteria excludes users and can create legal exposure in regulated industries.

---

## Applicable Success Criteria

| SC | Title | Level | Summary |
| -- | ----- | ----- | ------- |
| 1.4.3 | Contrast (Minimum) | AA | Normal text ≥ 4.5:1; large/bold text ≥ 3:1 |
| 1.4.11 | Non-text Contrast | AA | UI component boundaries, icons ≥ 3:1 |
| 2.4.7 | Focus Visible | AA | Every interactive element has a visible focus indicator |
| 2.4.11 | Focus Appearance (Minimum) | AA | Focus indicator area ≥ perimeter × 2px; contrast ≥ 3:1 |

---

## Contrast Quick Reference

### Text Contrast Thresholds

| Text type | Minimum ratio |
| --------- | ------------- |
| Normal text (< 18pt or < 14pt bold) | **4.5:1** |
| Large text (≥ 18pt or ≥ 14pt bold) | **3:1** |
| Decorative / disabled (exempt) | No requirement |

### Tailwind Colour Pairs — Verified for Light Mode (white `#ffffff` background)

| Text class | Hex | Ratio on white | Notes |
| ---------- | --- | -------------- | ----- |
| `text-blue-600` | `#2563eb` | 4.84:1 ✅ | Use for links and interactive text |
| `text-blue-700` | `#1d4ed8` | 6.88:1 ✅ | Hover state for links |
| `text-blue-400` | `#60a5fa` | 3.04:1 ❌ | **Fails** normal text — dark mode only |
| `text-gray-600` | `#4b5563` | 7.15:1 ✅ | Secondary/label text |
| `text-gray-500` | `#6b7280` | 4.62:1 ✅ | Use cautiously; `text-sm` only |
| `text-gray-400` | `#9ca3af` | 2.85:1 ❌ | **Fails** — avoid for informational text |
| `text-red-700` | `#b91c1c` | 5.90:1 ✅ | Error text on white |
| `text-green-700` | `#15803d` | 5.80:1 ✅ | Success text on white |
| `text-yellow-800` | `#854d0e` | 5.28:1 ✅ | Warning text on yellow-50 |

### Tailwind Colour Pairs — Verified for Dark Mode (approx `#111827` background)

| Text class | Hex | Ratio on `#111827` | Notes |
| ---------- | --- | ------------------ | ----- |
| `text-white` | `#ffffff` | 18.1:1 ✅ | Primary text |
| `text-gray-100` | `#f3f4f6` | 16.5:1 ✅ | Primary text variant |
| `text-gray-300` | `#d1d5db` | 10.6:1 ✅ | Secondary text |
| `text-blue-400` | `#60a5fa` | ~5.7:1 ✅ | Links in dark mode |
| `text-blue-300` | `#93c5fd` | ~8.1:1 ✅ | Link hover in dark mode |
| `text-gray-400` | `#9ca3af` | ~4.6:1 ✅ | Tertiary text (barely passes) |

---

## Approved Tailwind Patterns

### Links and Navigation Text

```tsx
// ✅ CORRECT — 4.84:1 on white, 5.7:1 on dark background
<Link className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded">
  ← Back to Home
</Link>

// ❌ INCORRECT — only 3.04:1 on white (fails SC 1.4.3 for normal text)
<Link className="text-blue-400 hover:text-blue-300">← Back to Home</Link>
```

### Focus Indicators

Every interactive element must have a visible focus ring. Use `focus-visible:` to avoid showing the
ring on mouse clicks (better UX) while preserving full keyboard accessibility:

```tsx
// Standard focus ring — use on buttons, links
className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"

// Compact focus ring — use on elements in tight layouts (toolbars, table cells)
className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"

// Dark-mode-aware ring — use when background is always dark
className="focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
```

### Loading Spinners

Use a full ring with a coloured arc so the animation is visible in both light and dark themes:

```tsx
// ✅ CORRECT — full ring, both modes, labelled for screen readers
<div
  className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-400"
  role="status"
  aria-label="Loading..."
/>

// ❌ INCORRECT — single edge; nearly invisible on white backgrounds
<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
```

### Icon-only Buttons

Icon-only buttons must have an `aria-label` and a visible border in both themes:

```tsx
// ✅ CORRECT
<button
  aria-label="Switch to dark mode"
  className="h-9 w-9 border border-gray-400/50 dark:border-white/20
             hover:bg-white/20 transition-all rounded-lg
             focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
>
  🌙
</button>

// ❌ INCORRECT — invisible border on light bg, no aria-label, no focus ring
<button className="border border-white/20" title="Switch to dark mode">🌙</button>
```

### Pagination Buttons

```tsx
// ✅ CORRECT — includes focus ring; disabled colours are WCAG-exempt but still legible
<button
  disabled={isFirstPage}
  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white
             disabled:bg-gray-300 disabled:text-gray-600
             dark:disabled:bg-gray-600 dark:disabled:text-gray-400
             disabled:cursor-not-allowed transition-colors
             focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
>
  ← Previous
</button>
```

### Select / Combobox

```tsx
// ✅ CORRECT — explicit focus indicator replaces outline; labelled with <label>
<label htmlFor="page-size" className="text-sm text-gray-700 dark:text-gray-300">
  Items per page
</label>
<select
  id="page-size"
  className="px-3 py-1 rounded-lg bg-white border-2 border-gray-200
             dark:bg-gray-800 dark:border-white/10 text-gray-900 dark:text-white text-sm
             focus:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
>
```

---

## Component-level Rules

### Shared Components

The following shared components implement WCAG-compliant patterns by default. Use them as-is; do
not override focus or contrast classes with page-specific utilities.

| Component | Key WCAG features |
| --------- | ----------------- |
| `LoadingSpinner` | Full ring animation, `role="status"`, `aria-label`, legible text (no opacity fade) |
| `PageHeader` | Back link uses `text-blue-600` (4.84:1 light), `focus-visible:ring-2` |
| `SortableHeaderCell` | Sort button has `focus-visible:ring-2 focus-visible:ring-blue-500` |
| `ThemeToggle` | `aria-label`, visible border both themes, `focus-visible:ring-2` |
| `TablePaginationControls` | Buttons have `focus-visible:ring-2`; disabled colours exempt but legible |
| `UserBadge` | Trigger button: visible border both themes, `aria-expanded`, `focus-visible:ring-2` |
| `Alert` | Variant colours verified at ≥ 4.5:1 in both themes |
| `Badge` | Variant colours verified at ≥ 4.5:1 in both themes |
| `PreferenceSavePrompt` | `role="status"`, `aria-live="polite"`, focus rings on action buttons |
| `ContextDocsLink` | `focus-visible:ring-2`, `aria-label` |

### Non-text Elements

Decorative icons (rendered via emoji or `aria-hidden="true"` SVG) are exempt from contrast
requirements. Functional icons (conveying meaning without adjacent text) must either:

1. Have a contrast ratio ≥ 3:1 against their background (SC 1.4.11), **or**
2. Be accompanied by visible text that conveys the same meaning.

---

## CI Enforcement

Accessibility standards are enforced automatically in the CI pipeline to prevent regressions.

### Static analysis — `lint-frontend` job

The `lint-frontend` job in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs
`next lint` on every PR. It includes [`eslint-plugin-jsx-a11y`](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y)
with the `recommended` rule set, catching violations such as:

| Rule | What it catches |
| ---- | --------------- |
| `jsx-a11y/alt-text` | `<img>` elements without `alt` |
| `jsx-a11y/aria-role` | Invalid or misspelled ARIA roles |
| `jsx-a11y/label-has-associated-control` | `<label>` elements not wrapping a control |
| `jsx-a11y/click-events-have-key-events` | `onClick` without a keyboard equivalent |
| `jsx-a11y/no-static-element-interactions` | Non-interactive elements with event handlers |
| `jsx-a11y/no-redundant-roles` | Roles that duplicate the implicit role of the element |

The job is a **blocking gate** in `ci-summary`: a PR cannot merge if `lint-frontend` fails.

### Configuration

The ESLint config lives at [`frontend/.eslintrc.json`](../../frontend/.eslintrc.json).

```json
{
  "extends": ["next/core-web-vitals", "plugin:jsx-a11y/recommended"],
  "plugins": ["jsx-a11y"],
  "rules": {
    "jsx-a11y/label-has-associated-control": ["error", { "assert": "nesting", "depth": 3 }]
  }
}
```

Key decisions in the config:

- `assert: "nesting"` — requires labels to wrap their control (avoids reliance on static text detection for
  i18n strings like `{t('...')}`).
- `depth: 3` — searches up to 3 levels of nesting for accessible label text (supports the two-level
  `label > div > span > text` pattern used in `UserBadge`).

### Future enforcement — runtime scanning (deferred)

Runtime accessibility scanning using axe-core or Pa11y against a running development server would
complement the static analysis. This requires a running Next.js server in CI (e.g. via Playwright)
and is tracked as a future enhancement per ADR-0014 IMP-004.

---

## PR Verification Checklist

Add these checks to your pull request description or use the built-in template section:

```markdown
## Accessibility Checklist

- [ ] All new text elements use colours with ≥ 4.5:1 contrast on their background.
- [ ] All new interactive elements (buttons, links, inputs) have a `focus-visible:ring-*` focus indicator.
- [ ] Icon-only buttons carry an `aria-label` attribute.
- [ ] Loading indicators use the full-ring spinner pattern with `role="status"` and `aria-label`.
- [ ] New UI tested visually in both light and dark themes.
- [ ] No new uses of `text-blue-400` on light-mode backgrounds.
- [ ] No new uses of `border-white/20` as the sole border on elements visible in light mode.
- [ ] No new uses of `opacity-*` on text that could reduce contrast below 4.5:1.
```

---

## Testing Tools

### In-browser

- **Chrome DevTools → Accessibility tab**: Inspect computed contrast ratios and ARIA tree.
- **Chrome DevTools → Rendering → Emulate vision deficiencies**: Test deuteranopia, protanopia, etc.
- **WAVE browser extension**: Highlights contrast errors and missing labels inline.
- **axe DevTools browser extension**: Automated WCAG audit with issue severity.

### Contrast Calculators

- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) — Enter hex codes.
- [Colour Contrast Analyser (app)](https://www.tpgi.com/color-contrast-checker/) — Desktop tool for
  picking colours from the screen.

### Keyboard Testing

1. Press `Tab` to move focus through the page.
2. Every focusable element must show a **clearly visible** focus ring.
3. Press `Enter`/`Space` on buttons; `Enter` on links.
4. Use `Escape` to close modals, dropdowns, and overlays.

---

## Common Anti-patterns

| Anti-pattern | Problem | Fix |
| ------------ | ------- | --- |
| `text-blue-400` on white | 3.04:1 — fails SC 1.4.3 | Use `text-blue-600 dark:text-blue-400` |
| `border border-white/20` as sole border | Invisible on light backgrounds | Add `dark:` prefix; use `border-gray-400/50` in light mode |
| `border-b-2 border-blue-600` spinner | Single edge, nearly invisible | Use `border-4 border-gray-200 border-t-blue-600` full ring |
| `opacity-70` on body text | Can reduce contrast below 4.5:1 | Use explicit colour tokens instead |
| Button with `focus:outline-none` and no ring | No keyboard focus indicator | Add `focus-visible:ring-2 focus-visible:ring-blue-500` |
| Icon button with `title` only, no `aria-label` | `title` is inaccessible on touch/mobile | Add `aria-label` matching button purpose |
| Colour alone to convey state | Fails SC 1.4.1 | Add text or icon alongside colour |

---

## References

- [WCAG 2.2 Specification](https://www.w3.org/TR/WCAG22/)
- [Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/)
- [ADR-0014: WCAG Accessibility Standards](../adr/adr-0014-wcag-accessibility-standards.md)
- [Tailwind CSS — Accessibility](https://tailwindcss.com/docs/accessibility)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
