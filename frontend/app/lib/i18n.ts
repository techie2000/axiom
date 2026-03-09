/**
 * i18n configuration for Axiom frontend.
 *
 * Uses i18next with the browser language detector and HTTP backend (fetching
 * locale JSON files from /public/locales/).  English is the required fallback;
 * French, Spanish, German, Japanese and Arabic are supported out of the box.
 *
 * The active language is persisted in localStorage under the key
 * `axiom_pref::global::language` so it is consistent with the UserPreference
 * system used elsewhere in the app.
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import HttpBackend from 'i18next-http-backend'

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', rtl: false, flag: '🇬🇧' },
  { code: 'fr', name: 'French', nativeName: 'Français', rtl: false, flag: '🇫🇷' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', rtl: false, flag: '🇪🇸' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', rtl: false, flag: '🇩🇪' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', rtl: false, flag: '🇯🇵' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true, flag: '🇸🇦' },
] as const

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']

/** localStorage key used by useUserPreference for global language selection. */
export const LANGUAGE_PREF_KEY = 'axiom_pref::global::language'

/** Returns the RTL flag for a given language code (defaults to false). */
export function isRtlLanguage(code: string): boolean {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.rtl ?? false
}

function getStoredLanguage(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(LANGUAGE_PREF_KEY)
}

// Only initialise once.
if (!i18n.isInitialized) {
  i18n
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      // Start with the value stored in localStorage (mirrors the user-preference
      // system), then fall back to browser detection, then English.
      lng: getStoredLanguage() ?? undefined,
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

      detection: {
        // Detection order: localStorage key → cookie → browser language header.
        order: ['localStorage', 'navigator'],
        lookupLocalStorage: LANGUAGE_PREF_KEY,
        caches: ['localStorage'],
      },

      react: {
        useSuspense: false,
      },
    })
}

export default i18n
