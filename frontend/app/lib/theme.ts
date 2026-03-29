/**
 * Theme definitions for the Axiom multi-theme system.
 *
 * Each theme is a **colour palette** with both a light and a dark variant.
 * The palette (stored as `global/theme`) is independent from the dark-mode toggle
 * (stored as `global/dark_mode`), so users can pick any palette and still switch
 * between light and dark.
 *
 * CSS: light variant lives under `[data-theme="<id>"]`, dark variant under
 *      `[data-theme="<id>"].dark`.  Both selectors must be present in globals.css.
 *
 * To add a new palette:
 * 1. Extend `ThemeId` and add an entry to `THEMES`.
 * 2. Add matching `[data-theme="<id>"]` and `[data-theme="<id>"].dark` blocks in globals.css.
 * 3. Add `preferences.themes.<camelCaseId>` and `preferences.themes.<camelCaseId>Description`
 *    translation keys to locales/en/common.json.
 */

export type ThemeId = 'default' | 'modern-minimal' | 'supabase' | 'perpetuity' | 'twitter'

export interface ThemeDefinition {
  id: ThemeId
  /** i18n key for the palette name (preferences.themes.<key>) */
  label: string
  /** i18n key for the one-line description */
  description: string
  /** Decorative emoji shown in the selector swatch */
  emoji: string
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'default',
    label: 'preferences.themes.default',
    description: 'preferences.themes.defaultDescription',
    emoji: '🎨',
  },
  {
    id: 'modern-minimal',
    label: 'preferences.themes.modernMinimal',
    description: 'preferences.themes.modernMinimalDescription',
    emoji: '⬛',
  },
  {
    id: 'supabase',
    label: 'preferences.themes.supabase',
    description: 'preferences.themes.supabaseDescription',
    emoji: '🌿',
  },
  {
    id: 'perpetuity',
    label: 'preferences.themes.perpetuity',
    description: 'preferences.themes.perpetuityDescription',
    emoji: '💜',
  },
  {
    id: 'twitter',
    label: 'preferences.themes.twitter',
    description: 'preferences.themes.twitterDescription',
    emoji: '🐦',
  },
]

export const DEFAULT_THEME: ThemeId = 'default'

/** Returns the ThemeDefinition for a given id, falling back to the default palette. */
export function resolveTheme(id: string | null | undefined): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME)!
}

/**
 * Applies the colour palette to the document by setting `data-theme`.
 * This does NOT toggle dark mode — use `applyDarkMode` for that.
 */
export function applyTheme(paletteId: string): void {
  if (typeof document === 'undefined') return
  const theme = resolveTheme(paletteId)
  document.documentElement.setAttribute('data-theme', theme.id)
  try {
    localStorage.setItem('theme', theme.id)
  } catch {
    // localStorage can be unavailable in some environments.
  }
}

/**
 * Applies the dark/light mode by toggling the `dark` CSS class on `<html>`.
 * This does NOT change the active colour palette — use `applyTheme` for that.
 */
export function applyDarkMode(isDark: boolean): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', isDark)
  try {
    localStorage.setItem('darkMode', isDark ? 'dark' : 'light')
  } catch {
    // localStorage can be unavailable in some environments.
  }
}
