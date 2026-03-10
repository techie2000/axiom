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
  useEffect(() => {
    if (typeof window === 'undefined') return

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080'
    let cancelled = false

    const setNestedValue = (target: Record<string, unknown>, dottedKey: string, value: string) => {
      const parts = dottedKey.split('.').filter(Boolean)
      if (parts.length === 0) return

      let current: Record<string, unknown> = target
      for (let i = 0; i < parts.length - 1; i += 1) {
        const part = parts[i]
        if (part === '__proto__' || part === 'prototype' || part === 'constructor') {
          return
        }
        const existing = current[part]
        if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
          current[part] = {}
        }
        current = current[part] as Record<string, unknown>
      }

      const lastPart = parts[parts.length - 1]
      if (lastPart === '__proto__' || lastPart === 'prototype' || lastPart === 'constructor') {
        return
      }
      current[lastPart] = value
    }

    const normalizeLanguageCode = (languageCode: string): string => {
      return String(languageCode || '')
        .trim()
        .toLowerCase()
        .split('-')[0]
    }

    const loadApprovedTranslations = async (languageCode: string) => {
      const normalizedLanguageCode = normalizeLanguageCode(languageCode)
      if (!normalizedLanguageCode || normalizedLanguageCode === 'en') return

      try {
        // Ensure the static namespace is loaded first so remote overrides are applied last.
        await i18n.loadLanguages(normalizedLanguageCode)
        await i18n.loadNamespaces('common')

        let offset = 0
        const limit = 200
        const overrides: Record<string, unknown> = {}

        while (true) {
          const params = new URLSearchParams({
            status: 'approved',
            limit: String(limit),
            offset: String(offset),
          })

          const res = await fetch(`${API_BASE_URL}/api/v1/translations?${params}`)
          if (!res.ok) return

          const payload = (await res.json()) as {
            records?: Array<{ language_code?: string; translation_key?: string; translation_value?: string }>
          }

          const records = payload.records ?? []
          for (const record of records) {
            const recordLanguage = normalizeLanguageCode(record.language_code || '')
            if (recordLanguage !== normalizedLanguageCode) {
              continue
            }

            const key = record.translation_key?.trim()
            const value = record.translation_value ?? ''
            if (!key) continue
            setNestedValue(overrides, key, value)
          }

          if (records.length < limit) break
          offset += records.length
        }

        if (cancelled || Object.keys(overrides).length === 0) return

        i18n.addResourceBundle(normalizedLanguageCode, 'common', overrides, true, true)
      } catch {
        // Keep static locale fallback when remote translation overlays are unavailable.
      }
    }

    const refreshCurrentLanguage = () => {
      const activeLanguage = i18n.resolvedLanguage || i18n.language
      void loadApprovedTranslations(activeLanguage)
    }

    const handleTranslationsUpdated = () => {
      refreshCurrentLanguage()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshCurrentLanguage()
      }
    }

    refreshCurrentLanguage()
    i18n.on('languageChanged', loadApprovedTranslations)
    window.addEventListener('axiom:translations-updated', handleTranslationsUpdated as EventListener)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      i18n.off('languageChanged', loadApprovedTranslations)
      window.removeEventListener('axiom:translations-updated', handleTranslationsUpdated as EventListener)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

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
