---
post_title: "ADR-0016: Multi-Theme System"
author1: "techie2000"
post_slug: "adr-0016-theming-system"
microsoft_alias: "techie2000"
featured_image: "https://placehold.co/1200x630.png"
categories: ["frontend"]
tags: ["adr", "frontend", "theming", "ux", "tailwind", "css"]
ai_note: "AI-assisted draft based on repository state and user request."
summary: "Records the decision to extend Axiom's binary dark/light toggle into a multi-theme system using CSS custom properties and a data-theme attribute, evaluating tweakcn and shadcn as alternatives."
post_date: "2026-03-29"
title: "ADR-0016: Multi-Theme System"
status: "Accepted"
date: "2026-03-29"
authors: "techie2000"
supersedes: ""
superseded_by: ""
---

## Status

Accepted

## Context

Axiom's frontend (ADR-0006) uses Next.js with Tailwind CSS and supports a binary light/dark mode toggle
backed by the user-preference system (ADR-0011). The dark/light state is stored as the `theme` preference
under the `global` page key and applied by toggling the `dark` CSS class on `<html>`.

The issue raised (GitHub issue: *Themes/theming*) asks for:

1. Multiple pre-defined themes beyond the current binary toggle.
2. User-selectable themes, persisted to the existing preference backend.
3. A clear engineering decision and implementation that the team can build on.
4. Long-term consideration of user-defined colour schemas.

The issue specifically mentions [tweakcn.com](https://tweakcn.com/) as a candidate approach to investigate.

## Decision Drivers

- Themes must be persisted via the existing `global / theme` preference key — no new API or schema changes.
- The solution must be backward-compatible: existing preference values of `"dark"` and `"light"` continue
  to work without migration.
- No dependency on external SaaS colour-management tools; the colour tokens must live in source control.
- Implementation complexity must remain proportional to the benefit: a clean extensibility point is more
  valuable at this stage than a fully dynamic user-defined system.
- All new UI must meet the WCAG 2.2 AA contrast requirements established in ADR-0014.

## Options Considered

### Option 1: tweakcn.com with shadcn/ui

[tweakcn.com](https://tweakcn.com/) is a visual theme builder that generates CSS custom property
configurations designed to drive [shadcn/ui](https://ui.shadcn.com/) component libraries.

**Pros:**

- Excellent visual tooling and community-contributed theme presets.
- Generates complete, production-ready CSS variable sets.
- Growing ecosystem; used by many Next.js projects.

**Cons:**

- Axiom does not use shadcn/ui; adopting tweakcn output would require migrating component library or
  maintaining a translation layer — a significant, multi-sprint effort.
- tweakcn themes are tightly coupled to shadcn's `--radius`, `--background`, `--primary`, etc. variable
  names that have no current mapping in Axiom's Tailwind-only component set.
- Introduces an external tooling dependency for something that is otherwise a simple CSS authoring task.

**Verdict:** Not adopted at this time. Revisit if Axiom migrates its component library to shadcn/ui.

### Option 2: CSS-in-JS runtime theming (e.g., styled-components, Emotion)

Runtime theme injection via a CSS-in-JS library.

**Pros:**

- Full programmatic control; user-defined themes are technically straightforward.

**Cons:**

- Directly conflicts with the Tailwind-first approach (ADR-0006) and breaks server-side rendering
  performance (no atomic CSS, potential flash-of-unstyled-content issues).
- Would require replacing a large number of Tailwind utility classes across the codebase.

**Verdict:** Rejected.

### Option 3: CSS custom properties + `data-theme` attribute (chosen)

Define a small set of CSS custom property tokens in `globals.css`, scoped under
`[data-theme="<name>"]` selectors on the `<html>` element. A lightweight `theme.ts` module maps
theme identifiers to their visual characteristics (`isDark` flag, emoji, i18n label). A new
`ThemeSelector` component replaces the binary `ThemeToggle` in the user menu.

**Pros:**

- Zero new dependencies.
- Fully backward-compatible: the existing `"dark"` and `"light"` preference values map to the new
  `dark` and `light` themes transparently.
- Tailwind's `dark:` utilities continue to work via the `dark` class, which is now toggled
  programmatically based on whether the selected theme has `isDark: true`.
- Adding a new theme requires only a new CSS block in `globals.css` and a new entry in `theme.ts`.
- The `THEMES` array in `theme.ts` is the single source of truth for available themes; i18n labels
  and selector UI derive from it automatically.

**Cons:**

- Only a handful of CSS custom property tokens are exposed at this stage
  (`--foreground-rgb`, `--background-start-rgb`, `--background-end-rgb`, `--accent-rgb`); deep
  per-component theming still relies on Tailwind's hardcoded colour classes.
- User-defined themes (the long-term goal) would require a future UI for defining and persisting
  token values, which is not part of this ADR.

**Verdict:** Adopted.

## Decision Outcome

**Chosen Option:** Option 3 — CSS custom properties + `data-theme` attribute.

### Rationale

This approach achieves the immediate goal (multiple selectable themes) with minimal risk and no new
dependencies. It is fully compatible with the existing Tailwind + user-preference stack and provides a
clean extension point for future theme additions.

tweakcn is the right long-term direction *if* the project adopts shadcn/ui as its component library.
The decision is documented here so the team can revisit it in a future ADR at that time.

### Initial Themes

Five pre-defined themes are shipped with this ADR:

| ID | Name | Mode | Description |
| --- | --- | --- | --- |
| `dark` | Dark | dark | Classic dark mode with slate-blue tones (previous default) |
| `light` | Light | light | Clean light mode with cool-white tones (previous light mode) |
| `midnight` | Midnight | dark | Pure-black background for OLED displays |
| `ocean` | Ocean | dark | Deep teal-blue tones |
| `slate` | Slate | light | Soft blue-grey light mode |

### Trade-offs Accepted

- Component-level colour tokens (e.g., card backgrounds, border colours) are not yet driven by
  CSS variables. Deeper theming will require incremental Tailwind utility replacement.
- User-defined themes are explicitly out of scope; the `theme.ts` registry is the only way to add
  themes in this phase.

## Consequences

### Positive

- Users can choose a theme that suits their preference or environment (e.g., midnight for OLED screens).
- No additional HTTP requests or schema changes are required.
- The `ThemeSelector` dropdown is accessible (ARIA `listbox` pattern, keyboard dismissal).
- Existing stored preference values (`"dark"`, `"light"`) continue to resolve correctly.

### Negative

- The body background gradient is themed, but Tailwind's `dark:` utilities in individual components
  remain unaffected by the ocean/slate/midnight variants beyond their `isDark` classification.
  True per-theme component styling is a future milestone.

### Mitigation

- Incrementally replace hardcoded colour utilities with CSS variable references as components are
  touched during regular feature work.
- If the project adopts shadcn/ui, revisit tweakcn integration in a follow-up ADR.

## References

- [tweakcn.com](https://tweakcn.com/) — visual theme builder for shadcn/ui
- [shadcn/ui](https://ui.shadcn.com/) — component library based on Radix UI + Tailwind
- [Tailwind CSS — Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [ADR-0006: Next.js + Tailwind Frontend](adr-0006-nextjs-tailwind-frontend.md)
- [ADR-0011: User Preferences](adr-0011-user-preferences.md)
- [ADR-0014: WCAG Accessibility Standards](adr-0014-wcag-accessibility-standards.md)

## Revision History

- **2026-03-29:** Initial decision — five pre-defined themes, `ThemeSelector` component.
