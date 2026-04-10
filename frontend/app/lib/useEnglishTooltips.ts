'use client'

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useUserPreference } from './useUserPreference'

type TranslationOptions = Record<string, string | number | boolean | null | undefined>

const normalizeLanguageCode = (languageCode: string): string =>
  String(languageCode || '').trim().toLowerCase().split('-')[0]

export function useEnglishTooltips() {
  const { i18n } = useTranslation('common')
  const [storedValue, setStoredValue] = useUserPreference('global', 'show_english_tooltips', 'false')

  const currentLanguage = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language || 'en')
  const enabled = storedValue === 'true' && currentLanguage !== 'en'

  const getEnglishTooltip = useCallback(
    (translationKey: string, options?: TranslationOptions): string | undefined => {
      if (!enabled || !translationKey) {
        return undefined
      }

      const englishValue = i18n.t(translationKey, {
        ...(options || {}),
        lng: 'en',
        defaultValue: '',
      })
      const currentValue = i18n.t(translationKey, options || {})

      if (typeof englishValue !== 'string') {
        return undefined
      }

      const normalizedEnglish = englishValue.trim()
      const normalizedCurrent = typeof currentValue === 'string' ? currentValue.trim() : ''
      if (!normalizedEnglish || normalizedEnglish === normalizedCurrent) {
        return undefined
      }

      return normalizedEnglish
    },
    [enabled, i18n],
  )

  return {
    englishTooltipsEnabled: enabled,
    englishTooltipsPreferenceEnabled: storedValue === 'true',
    setEnglishTooltipsPreferenceEnabled: (nextValue: boolean) => setStoredValue(nextValue ? 'true' : 'false'),
    getEnglishTooltip,
  }
}