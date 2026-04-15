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
import { getApiBaseUrl } from '../lib/api-base'
import i18n, { isRtlLanguage } from '../lib/i18n'
import I18nMissingTranslationsDevTool from './I18nMissingTranslationsDevTool'

interface I18nProviderProps {
  children: React.ReactNode
}

export default function I18nProvider({ children }: I18nProviderProps) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const API_BASE_URL = getApiBaseUrl()
    let cancelled = false
    const approvedKeysByLanguage = new Map<string, Set<string>>()

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

    const isPlaceholderValue = (value: string, dottedKey: string, namespace: string): boolean => {
      const normalizedValue = value.trim().toLowerCase()
      if (!normalizedValue) {
        return true
      }

      const normalizedKey = dottedKey.trim().toLowerCase()
      if (!normalizedKey) {
        return false
      }

      if (normalizedValue === normalizedKey || normalizedValue === `${namespace}.${normalizedKey}`) {
        return true
      }

      return false
    }

    const sanitizeBundleNode = (
      node: Record<string, unknown>,
      namespace: string,
      pathParts: string[] = []
    ): Record<string, unknown> => {
      const sanitized: Record<string, unknown> = {}

      for (const [key, rawValue] of Object.entries(node)) {
        const nextPath = [...pathParts, key]
        const dottedKey = nextPath.join('.')

        if (typeof rawValue === 'string') {
          if (isPlaceholderValue(rawValue, dottedKey, namespace)) {
            continue
          }
          sanitized[key] = rawValue
          continue
        }

        if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
          const sanitizedChild = sanitizeBundleNode(rawValue as Record<string, unknown>, namespace, nextPath)
          if (Object.keys(sanitizedChild).length > 0) {
            sanitized[key] = sanitizedChild
          }
        }
      }

      return sanitized
    }

    const sanitizeResourceBundle = (languageCode: string, namespace: string) => {
      const currentBundle = i18n.getResourceBundle(languageCode, namespace) as Record<string, unknown> | undefined
      if (!currentBundle || typeof currentBundle !== 'object') {
        return
      }

      const sanitizedBundle = sanitizeBundleNode(currentBundle, namespace)
      i18n.removeResourceBundle(languageCode, namespace)
      i18n.addResourceBundle(languageCode, namespace, sanitizedBundle, true, true)
    }

    const deleteNestedValue = (target: Record<string, unknown>, dottedKey: string) => {
      const parts = dottedKey.split('.').filter(Boolean)
      if (parts.length === 0) {
        return
      }

      let current: Record<string, unknown> = target
      for (let i = 0; i < parts.length - 1; i += 1) {
        const part = parts[i]
        const next = current[part]
        if (!next || typeof next !== 'object' || Array.isArray(next)) {
          return
        }
        current = next as Record<string, unknown>
      }

      delete current[parts[parts.length - 1]]
    }

    const removeApprovedOverlayKeys = (languageCode: string, namespace: string, keys: Set<string>) => {
      if (keys.size === 0) {
        return
      }

      const currentBundle = i18n.getResourceBundle(languageCode, namespace) as Record<string, unknown> | undefined
      if (!currentBundle || typeof currentBundle !== 'object') {
        return
      }

      const nextBundle: Record<string, unknown> = JSON.parse(JSON.stringify(currentBundle))
      for (const key of keys) {
        deleteNestedValue(nextBundle, key)
      }

      i18n.removeResourceBundle(languageCode, namespace)
      i18n.addResourceBundle(languageCode, namespace, nextBundle, true, true)
    }

    const loadApprovedTranslations = async (languageCode: string) => {
      const normalizedLanguageCode = normalizeLanguageCode(languageCode)
      if (!normalizedLanguageCode || normalizedLanguageCode === 'en') return

      try {
        sanitizeResourceBundle(normalizedLanguageCode, 'common')

        let offset = 0
        const limit = 200
        const overrides: Record<string, unknown> = {}
        const nextApprovedKeys = new Set<string>()

        while (true) {
          const params = new URLSearchParams({
            status: 'approved',
            language: normalizedLanguageCode,
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
            if (!key) continue

            const value = record.translation_value ?? ''
            if (isPlaceholderValue(value, key, 'common')) continue
            setNestedValue(overrides, key, value)
            nextApprovedKeys.add(key)
          }

          if (records.length < limit) break
          offset += records.length
        }

        if (cancelled) return

        // Remove only keys that were previously applied as approved overlays,
        // so rejected/deleted approved translations do not linger.
        // This preserves any runtime pending translations added in-session.
        const previousApprovedKeys = approvedKeysByLanguage.get(normalizedLanguageCode) ?? new Set<string>()
        removeApprovedOverlayKeys(normalizedLanguageCode, 'common', previousApprovedKeys)

        if (Object.keys(overrides).length === 0) {
          approvedKeysByLanguage.set(normalizedLanguageCode, nextApprovedKeys)
          return
        }

        i18n.addResourceBundle(normalizedLanguageCode, 'common', overrides, true, true)
        approvedKeysByLanguage.set(normalizedLanguageCode, nextApprovedKeys)
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

  return (
    <I18nextProvider i18n={i18n}>
      {children}
      <I18nMissingTranslationsDevTool />
    </I18nextProvider>
  )
}
