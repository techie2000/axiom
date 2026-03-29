/**
 * Theme definitions for the Axiom multi-theme system.
 *
 * Each theme declares:
 * - `id`       — the value stored in the user preference (global / theme).
 * - `label`    — a stable English key used to look up an i18n label.
 * - `isDark`   — whether Tailwind's `dark:` utilities should be active.
 * - `emoji`    — decorative swatch shown in the selector.
 *
 * To add a new theme:
 * 1. Add an entry here.
 * 2. Add matching CSS variable overrides in globals.css under the [data-theme="…"] selector.
 * 3. Add the label translation key to locales/en/common.json (preferences.themes.<id>).
 */

export type ThemeId = 'dark' | 'light' | 'midnight' | 'ocean' | 'slate'

export interface ThemeDefinition {
  id: ThemeId
  label: string
  isDark: boolean
  emoji: string
  description: string
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'dark',
    label: 'preferences.themes.dark',
    isDark: true,
    emoji: '🌙',
    description: 'preferences.themes.darkDescription',
  },
  {
    id: 'light',
    label: 'preferences.themes.light',
    isDark: false,
    emoji: '☀️',
    description: 'preferences.themes.lightDescription',
  },
  {
    id: 'midnight',
    label: 'preferences.themes.midnight',
    isDark: true,
    emoji: '🌑',
    description: 'preferences.themes.midnightDescription',
  },
  {
    id: 'ocean',
    label: 'preferences.themes.ocean',
    isDark: true,
    emoji: '🌊',
    description: 'preferences.themes.oceanDescription',
  },
  {
    id: 'slate',
    label: 'preferences.themes.slate',
    isDark: false,
    emoji: '🪨',
    description: 'preferences.themes.slateDescription',
  },
]

export const DEFAULT_THEME: ThemeId = 'dark'

/** Returns the ThemeDefinition for a given id, falling back to the default. */
export function resolveTheme(id: string | null | undefined): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME)!
}

/**
 * Applies the visual effects of a theme to the document:
 * - Toggles the `dark` class based on `isDark`.
 * - Sets `data-theme` on the `<html>` element.
 * - Writes `theme` to localStorage for the SSR hydration script.
 */
export function applyTheme(id: string): void {
  if (typeof document === 'undefined') return
  const theme = resolveTheme(id)
  document.documentElement.classList.toggle('dark', theme.isDark)
  document.documentElement.setAttribute('data-theme', theme.id)
  try {
    localStorage.setItem('theme', theme.id)
  } catch {
    // localStorage can be unavailable in some environments.
  }
}
