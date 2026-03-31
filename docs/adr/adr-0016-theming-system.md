---
post_title: "ADR-0016: Multi-Theme System"
author1: "techie2000"
post_slug: "adr-0016-theming-system"
microsoft_alias: "techie2000"
featured_image: "https://placehold.co/1200x630.png"
categories: ["frontend"]
tags: ["adr", "frontend", "theming", "ux", "tailwind", "css"]
ai_note: "AI-assisted draft based on repository state and user request."
summary: "Records the decision to implement a dual-mode theming system where each colour palette ships both a light and a dark variant, decoupling palette choice from the dark/light toggle, with five tweakcn-inspired palettes and semantic theme utility tokens."
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

Subsequent implementation refinements added:

- Semantic utility classes and status tokens (`theme-*`) so components progressively move off hardcoded utility colours.
- Pre-hydration theme bootstrap in the root layout to prevent first-paint theme flash.
- Global browser scrollbar tokenization for theme consistency.
- Session-scoped deferred preference overrides so unsaved theme and display changes persist across in-app navigation for the active authenticated session and reset on logout.
- Custom themed select controls (`ThemedSelect`) replacing native `<select>` usage in app screens and shared controls to avoid OS/browser popup colour drift.

The key insight from reviewing tweakcn is that **each theme is a colour palette that ships both a light and
a dark variant**, independently of which mode the user has selected. A user picking "Supabase" should still
be able to toggle between light and dark Supabase, not be locked into one mode.

## Decision Drivers

- Each colour palette must provide both a light and a dark variant, matching the tweakcn model.
- Palette choice (`global/theme`) and dark-mode toggle (`global/dark_mode`) must be stored and controlled
  independently so users retain the light/dark toggle regardless of which palette is active.
- The solution must be backward-compatible: no new API or database schema changes required.
- No dependency on external SaaS colour-management tools; colour tokens must live in source control.
- Implementation complexity must remain proportional to the benefit.
- All new UI must meet the WCAG 2.2 AA contrast requirements established in ADR-0014.

## Options Considered

### Option 1: tweakcn.com with shadcn/ui

[tweakcn.com](https://tweakcn.com/) is a visual theme builder that generates CSS custom property
configurations designed to drive [shadcn/ui](https://ui.shadcn.com/) component libraries.

**Pros:**

- Excellent visual tooling and community-contributed theme presets.
- Generates complete, production-ready CSS variable sets that include both light and dark variants.
- Growing ecosystem; used by many Next.js projects.
- The palette-per-theme model (each palette has both modes) is built-in.

**Cons:**

- Axiom does not use shadcn/ui; adopting tweakcn output would require migrating the component library or
  maintaining a translation layer — a significant, multi-sprint effort.
- tweakcn themes are tightly coupled to shadcn's `--radius`, `--background`, `--primary`, etc. variable
  names that have no current mapping in Axiom's Tailwind-only component set.
- Introduces an external tooling dependency for something that is otherwise a simple CSS authoring task.

**Verdict:** Not adopted at this time, but its colour palette model (light + dark per theme) is adopted.
Revisit full shadcn/tweakcn integration if Axiom migrates its component library to shadcn/ui.

### Option 2: CSS-in-JS runtime theming (e.g., styled-components, Emotion)

Runtime theme injection via a CSS-in-JS library.

**Pros:**

- Full programmatic control; user-defined themes are technically straightforward.

**Cons:**

- Directly conflicts with the Tailwind-first approach (ADR-0006) and breaks server-side rendering
  performance (no atomic CSS, potential flash-of-unstyled-content issues).
- Would require replacing a large number of Tailwind utility classes across the codebase.

**Verdict:** Rejected.

### Option 3: CSS custom properties + `data-theme` attribute — dual light/dark variants (chosen)

Define CSS custom property tokens in `globals.css`, scoped under two selectors per palette:

- `[data-theme="<id>"]` — light variant (applied when the `dark` class is **absent**)
- `[data-theme="<id>"].dark` — dark variant (applied when the `dark` class is **present**)

The `data-theme` attribute (palette) and the `dark` class (mode) are set independently by two
separate components (`ThemeSelector` and `ThemeToggle`) reading from two separate preference keys
(`global/theme` and `global/dark_mode`).

**Pros:**

- Zero new dependencies.
- Matches the tweakcn palette model: each palette ships both a light and a dark variant.
- Palette and dark-mode remain independently controllable — users keep the familiar dark/light toggle
  while also being able to choose a colour palette.
- Adding a new palette requires only two CSS blocks in `globals.css` and one entry in `theme.ts`.
- Fully backward-compatible with SSR: the `dark` class on `<html>` still drives Tailwind's `dark:`
  utilities.

**Cons:**

- Only a handful of CSS custom property tokens are exposed at this stage
  (`--foreground-rgb`, `--background-start-rgb`, `--background-end-rgb`, `--accent-rgb`); deep
  per-component theming still relies on Tailwind's hardcoded colour classes.
- User-defined themes (the long-term goal) would require a future UI for defining and persisting
  token values, which is not part of this ADR.

**Verdict:** Adopted.

## Decision Outcome

**Chosen Option:** Option 3 — CSS custom properties + `data-theme` attribute with dual light/dark variants.

### Rationale

This approach achieves the immediate goal (multiple selectable palettes, each with both modes) with minimal
risk and no new dependencies. It adopts the key conceptual model from tweakcn (palette ≠ mode) without
requiring a full shadcn/ui migration.

tweakcn remains the right long-term direction *if* the project adopts shadcn/ui as its component library.
That decision is deferred to a future ADR.

### Preference Keys

| Key | Values | Component |
| --- | --- | --- |
| `global/theme` | palette ID (see table below) | `ThemeSelector` |
| `global/dark_mode` | `'dark'` \| `'light'` | `ThemeToggle` |

### Initial Palettes

Five tweakcn-inspired palettes are shipped with this ADR, each providing both light and dark variants:

| ID | Name | Light | Dark | Inspiration |
| --- | --- | --- | --- | --- |
| `default` | Default | Slate-50 bg, slate-900 fg | Slate-900 bg, slate-50 fg | Axiom's original palette |
| `modern-minimal` | Modern Minimal | White bg, zinc-950 fg | Zinc-950 bg, zinc-50 fg | tweakcn Modern Minimal |
| `supabase` | Supabase | White bg, #3ECF8E accent | Near-black bg, #3ECF8E accent | tweakcn Supabase |
| `perpetuity` | Perpetuity | Cyan/teal mist light palette | Cyan/teal terminal dark palette | tweakcn Perpetuity (retuned) |
| `twitter` | Twitter | White bg, #1D9BF0 accent | #15202B bg, #1D9BF0 accent | tweakcn Twitter |

### Trade-offs Accepted

- Some complex module screens still include legacy utility colour classes; complete migration remains
  incremental and should continue during normal feature work.
- User-defined themes are explicitly out of scope; the `theme.ts` registry is the only way to add
  palettes in this phase.

## Consequences

### Positive

- Users can choose a colour palette *and* independently toggle dark/light mode.
- The palette model matches tweakcn's design philosophy, making a future full migration straightforward.
- No additional HTTP requests or schema changes are required.
- The `ThemeSelector` dropdown is accessible (ARIA `listbox` pattern, keyboard dismissal).
- Shared semantic classes (`theme-panel`, `theme-btn-primary`, `theme-btn-neutral`, `theme-input`,
  `theme-select`, `theme-table-*`, `theme-status-*`) reduce palette drift between pages.
- Pre-hydration bootstrap prevents initial paint flicker to a default theme before preference load.
- Browser scrollbars now match active theme tokens.
- Adding a new palette requires changing only two files: `globals.css` and `theme.ts`.
- Dropdown popups now follow palette tokens consistently because listbox rendering is app-controlled instead of browser-native.
- Unsaved preference edits now behave predictably for users: they persist within the current signed-in session and revert to saved preferences on next login.

### Negative

- Tailwind's `dark:` utilities in individual components remain unaffected by palette choice beyond the
  CSS custom properties — true per-theme component styling is a future milestone.
- Existing users who had saved `global/theme = 'light'` will default to dark mode (the new
  `global/dark_mode` preference starts absent, defaulting to `'dark'`). They can toggle back in one click.
- Custom select/listbox controls require ongoing accessibility and keyboard-interaction regression testing that native controls handled automatically.

### Mitigation

- Continue incremental conversion of remaining hardcoded colour utilities to semantic token classes,
  prioritizing shared components first.
- If the project adopts shadcn/ui, revisit full tweakcn integration in a follow-up ADR.
- Keep `ThemedSelect` as a shared primitive and validate keyboard/focus behavior during frontend smoke checks.

## References

- [tweakcn.com](https://tweakcn.com/) — visual theme builder for shadcn/ui
- [shadcn/ui](https://ui.shadcn.com/) — component library based on Radix UI + Tailwind
- [Tailwind CSS — Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [ADR-0006: Next.js + Tailwind Frontend](adr-0006-nextjs-tailwind-frontend.md)
- [ADR-0011: User Preferences](adr-0011-user-preferences.md)
- [ADR-0014: WCAG Accessibility Standards](adr-0014-wcag-accessibility-standards.md)

## Revision History

- **2026-03-29:** Initial decision — five single-mode themes, `ThemeSelector` component.
- **2026-03-29:** Revised — each palette now ships both light and dark variants; `ThemeToggle` decoupled
  to an independent `global/dark_mode` preference; palettes replaced with five tweakcn-inspired designs
  (Default, Modern Minimal, Supabase, Perpetuity, Twitter).
- **2026-03-30:** Implementation refinement — semantic theme utility/status tokens introduced, pre-hydration
  theme bootstrap added, browser scrollbar theming added, and palette values retuned for closer tweakcn
  alignment (including Perpetuity cyan/teal and updated Modern Minimal/Twitter/Supabase variants).
- **2026-03-31:** UX behavior refinement — deferred unsaved preferences now persist for the active authenticated
  session and reset on logout; native selects replaced with shared `ThemedSelect` listbox to ensure
  palette-consistent dropdown rendering across supported themes.
