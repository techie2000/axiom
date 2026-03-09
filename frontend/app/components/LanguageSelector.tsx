'use client'

/**
 * LanguageSelector renders a dropdown that lets users switch the active UI
 * language.  The selected language is persisted via the UserPreference system
 * (page_key='global', preference_key='language') so it is remembered across
 * sessions and synced to the server when the user is authenticated.
 *
 * It also updates i18next immediately so the UI language switches without a
 * page reload.
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, LANGUAGE_PREF_KEY } from '../lib/i18n'
import { useUserPreference } from '../lib/useUserPreference'

interface LanguageSelectorProps {
  /** Additional CSS classes applied to the outer wrapper. */
  className?: string
  /** If true, only the flag emoji and language code are shown (compact). */
  compact?: boolean
}

export default function LanguageSelector({ className = '', compact = false }: LanguageSelectorProps) {
  const { i18n } = useTranslation()
  // Persist the language via the same preference system used for other prefs.
  const [, setStoredLanguage] = useUserPreference('global', 'language', 'en')

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const code = e.target.value
      i18n.changeLanguage(code)
      // Persist to localStorage immediately (the preference hook also does
      // this, but we do it here to ensure the i18next detector picks it up).
      if (typeof window !== 'undefined') {
        localStorage.setItem(LANGUAGE_PREF_KEY, code)
      }
      setStoredLanguage(code)
    },
    [i18n, setStoredLanguage],
  )

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ?? SUPPORTED_LANGUAGES[0]

  return (
    <div className={`flex items-center gap-1.5 ${className}`} title="Select language">
      <span className="text-lg leading-none" aria-hidden="true">
        {current.flag}
      </span>
      <select
        value={i18n.language}
        onChange={handleChange}
        aria-label="Select language"
        className={[
          'bg-transparent border border-gray-300 dark:border-white/20 rounded-md',
          'text-gray-900 dark:text-white text-sm',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer',
          'py-1 px-1.5',
          compact ? '' : 'min-w-[120px]',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option
            key={lang.code}
            value={lang.code}
            className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {compact ? `${lang.flag} ${lang.code.toUpperCase()}` : `${lang.flag} ${lang.nativeName}`}
          </option>
        ))}
      </select>
    </div>
  )
}
