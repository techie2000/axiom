'use client'

/**
 * I18nProvider initialises i18next and wraps its children with the
 * react-i18next I18nextProvider.  It also applies the `dir` attribute to the
 * <html> element when the active language is right-to-left (e.g. Arabic).
 *
 * This component must be rendered client-side so that the browser language
 * detector and localStorage can be accessed.
 */

import { useEffect } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n, { isRtlLanguage } from '../lib/i18n'

interface I18nProviderProps {
  children: React.ReactNode
}

export default function I18nProvider({ children }: I18nProviderProps) {
  // Sync the <html dir="…"> attribute whenever the language changes.
  useEffect(() => {
    const applyDir = (lng: string) => {
      document.documentElement.dir = isRtlLanguage(lng) ? 'rtl' : 'ltr'
      document.documentElement.lang = lng
    }

    applyDir(i18n.language)
    i18n.on('languageChanged', applyDir)

    return () => {
      i18n.off('languageChanged', applyDir)
    }
  }, [])

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
