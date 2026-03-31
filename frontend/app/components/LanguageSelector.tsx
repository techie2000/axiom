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
import ThemedSelect from './ThemedSelect'

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
    (code: string) => {
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
  const currentTooltip = `Locale: ${current.regionCode} (${current.regionName}) / ${current.code.toUpperCase()} (${current.name})`

  return (
    <div className={`flex items-center gap-1.5 ${className}`} title={compact ? currentTooltip : 'Select language'}>
      <span className="text-lg leading-none" aria-hidden="true">
        {current.flag}
      </span>
      <ThemedSelect
        value={i18n.language}
        onChange={handleChange}
        ariaLabel="Select language"
        className={compact ? '' : 'min-w-[120px]'}
        buttonClassName="py-1 px-1.5 text-sm"
        title={compact ? currentTooltip : 'Select language'}
        options={SUPPORTED_LANGUAGES.map((lang) => ({
          value: lang.code,
          label: compact ? lang.code.toUpperCase() : lang.nativeName,
          title: `${lang.regionCode} = ${lang.regionName}; ${lang.code.toUpperCase()} = ${lang.name}`,
        }))}
      />
    </div>
  )
}
