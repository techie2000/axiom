/**
 * i18n configuration for Axiom frontend.
 *
 * Uses i18next with HTTP backend (fetching locale JSON files from
 * /public/locales/).  English is the required fallback;
 * Arabic, Chinese (Simplified), Dutch, French, German, Italian, Japanese,
 * Portuguese (Brazilian), and Spanish are supported out of the box.
 *
 * The active language is persisted in localStorage under the key
 * `axiom_pref::global::language` so it is consistent with the UserPreference
 * system used elsewhere in the app.
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import HttpBackend from 'i18next-http-backend'

export const SUPPORTED_LANGUAGES = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    rtl: false,
    flag: '🇬🇧',
    regionCode: 'GB',
    regionName: 'United Kingdom',
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    rtl: true,
    flag: '🇸🇦',
    regionCode: 'SA',
    regionName: 'Saudi Arabia',
  },
  {
    code: 'zh',
    name: 'Chinese (Simplified)',
    nativeName: '中文（简体）',
    rtl: false,
    flag: '🇨🇳',
    regionCode: 'CN',
    regionName: 'China',
  },
  {
    code: 'nl',
    name: 'Dutch',
    nativeName: 'Nederlands',
    rtl: false,
    flag: '🇳🇱',
    regionCode: 'NL',
    regionName: 'Netherlands',
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    rtl: false,
    flag: '🇫🇷',
    regionCode: 'FR',
    regionName: 'France',
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    rtl: false,
    flag: '🇩🇪',
    regionCode: 'DE',
    regionName: 'Germany',
  },
  {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    rtl: false,
    flag: '🇮🇹',
    regionCode: 'IT',
    regionName: 'Italy',
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    rtl: false,
    flag: '🇯🇵',
    regionCode: 'JP',
    regionName: 'Japan',
  },
  {
    code: 'pt',
    name: 'Portuguese (Brazilian)',
    nativeName: 'Português (Brasil)',
    rtl: false,
    flag: '🇧🇷',
    regionCode: 'BR',
    regionName: 'Brazil',
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    rtl: false,
    flag: '🇪🇸',
    regionCode: 'ES',
    regionName: 'Spain',
  },
] as const

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']

/** localStorage key used by useUserPreference for global language selection. */
export const LANGUAGE_PREF_KEY = 'axiom_pref::global::language'

/** Returns the RTL flag for a given language code (defaults to false). */
export function isRtlLanguage(code: string): boolean {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.rtl ?? false
}

// Only initialise once.
if (!i18n.isInitialized) {
  i18n
    .use(HttpBackend)
    .use(initReactI18next)
    .init({
      // Keep startup language deterministic for SSR/hydration consistency.
      // A client-side effect applies user preference after mount.
      lng: 'en',
      fallbackLng: ['en'],
      supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
      defaultNS: 'common',
      ns: ['common'],

      // Fetch translation JSON files from /public/locales/.
      backend: {
        loadPath: '/locales/{{lng}}/{{ns}}.json',
      },

      interpolation: {
        escapeValue: false, // React already escapes values.
      },

      react: {
        useSuspense: false,
        // Re-render components when runtime translation overlays are merged.
        bindI18nStore: 'added removed',
      },
    })
}

export default i18n
