'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const PREFERENCE_SAVE_ERROR_EVENT = 'axiom:preference-save-error'
const PREFERENCE_UPDATED_EVENT = 'axiom:preference-updated'

class PreferenceSaveError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'PreferenceSaveError'
    this.status = status
  }
}

const API_BASE_URL =
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080'
    : 'http://backend:8080'

export interface UserPreference {
  page_key: string
  preference_key: string
  preference_value: string
}

// In-memory cache so all hooks in the same session share state.
let cache: Record<string, Record<string, string>> = {}
let cacheLoaded = false

function getCacheKey(pageKey: string, prefKey: string) {
  return `${pageKey}::${prefKey}`
}

function readFromCache(pageKey: string, prefKey: string): string | undefined {
  return cache[pageKey]?.[prefKey]
}

function writeToCache(pageKey: string, prefKey: string, value: string) {
  if (!cache[pageKey]) cache[pageKey] = {}
  cache[pageKey][prefKey] = value
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null

  const rawToken = localStorage.getItem('axiom_token')
  const normalizedToken = rawToken?.replace(/^Bearer\s+/i, '').trim() ?? ''

  if (normalizedToken === '' || normalizedToken === 'undefined' || normalizedToken === 'null') {
    return null
  }

  return normalizedToken
}

async function fetchAllPreferences(): Promise<UserPreference[]> {
  const token = getToken()
  if (!token) return []
  const res = await fetch(`${API_BASE_URL}/api/v1/preferences`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  return res.json()
}

async function savePreferenceToServer(
  pageKey: string,
  preferenceKey: string,
  preferenceValue: string,
): Promise<void> {
  const token = getToken()
  if (!token) return
  const response = await fetch(`${API_BASE_URL}/api/v1/preferences`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ page_key: pageKey, preference_key: preferenceKey, preference_value: preferenceValue }),
  })

  if (!response.ok) {
    throw new PreferenceSaveError(`failed to persist preference (${response.status})`, response.status)
  }
}

/**
 * useUserPreference provides access to a single preference value for a given page.
 *
 * - When the user is logged in, preferences are loaded from the server on first use
 *   and cached in memory for the lifetime of the session.
 * - When the user is not logged in, the hook falls back to localStorage.
 * - Saving a preference writes to both the cache (and localStorage fallback) immediately
 *   and asynchronously persists to the server.
 *
 * @param pageKey   Identifies the page (e.g. 'lei-records', 'global').
 * @param prefKey   Identifies the individual preference (e.g. 'expanded_width', 'theme').
 * @param defaultValue  Fallback value when no preference has been stored yet.
 */
export function useUserPreference(
  pageKey: string,
  prefKey: string,
  defaultValue: string,
): [string, (value: string) => void, boolean] {
  const localKey = `axiom_pref::${getCacheKey(pageKey, prefKey)}`

  const getInitialValue = (): string => {
    const cached = readFromCache(pageKey, prefKey)
    if (cached !== undefined) return cached
    if (typeof window !== 'undefined') {
      const local = localStorage.getItem(localKey)
      if (local !== null) return local
    }
    return defaultValue
  }

  const [value, setValue] = useState<string>(getInitialValue)
  const [loading, setLoading] = useState(!cacheLoaded)
  const initialised = useRef(false)

  // Load all preferences from server on first mount (once per session).
  useEffect(() => {
    if (cacheLoaded) {
      const cached = readFromCache(pageKey, prefKey)
      if (cached !== undefined) setValue(cached)
      setLoading(false)
      return
    }

    const token = getToken()
    if (!token) {
      cacheLoaded = true
      setLoading(false)
      return
    }

    fetchAllPreferences().then((prefs) => {
      prefs.forEach((p) => {
        writeToCache(p.page_key, p.preference_key, p.preference_value)
        // Mirror to localStorage for offline fallback.
        const lk = `axiom_pref::${getCacheKey(p.page_key, p.preference_key)}`
        localStorage.setItem(lk, p.preference_value)
      })
      cacheLoaded = true
      const serverValue = readFromCache(pageKey, prefKey)
      if (serverValue !== undefined) setValue(serverValue)
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After the initial load, if the cache updates elsewhere react to it.
  useEffect(() => {
    if (!initialised.current) {
      initialised.current = true
      return
    }
    const cached = readFromCache(pageKey, prefKey)
    if (cached !== undefined && cached !== value) setValue(cached)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheLoaded])

  // Keep all hook instances in sync when any preference is updated in-session.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePreferenceUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ pageKey?: string; preferenceKey?: string; value?: string }>
      const detail = customEvent.detail
      if (!detail || detail.pageKey !== pageKey || detail.preferenceKey !== prefKey) {
        return
      }

      const nextValue = typeof detail.value === 'string' ? detail.value : readFromCache(pageKey, prefKey)
      if (typeof nextValue === 'string' && nextValue !== value) {
        setValue(nextValue)
      }
    }

    window.addEventListener(PREFERENCE_UPDATED_EVENT, handlePreferenceUpdated)
    return () => window.removeEventListener(PREFERENCE_UPDATED_EVENT, handlePreferenceUpdated)
  }, [pageKey, prefKey, value])

  const set = useCallback(
    (newValue: string) => {
      setValue(newValue)
      writeToCache(pageKey, prefKey, newValue)
      // Always write to localStorage as a fast local fallback.
      if (typeof window !== 'undefined') {
        localStorage.setItem(localKey, newValue)
        window.dispatchEvent(new CustomEvent(PREFERENCE_UPDATED_EVENT, {
          detail: {
            pageKey,
            preferenceKey: prefKey,
            value: newValue,
          },
        }))
      }
      // Persist to server asynchronously (best-effort).
      savePreferenceToServer(pageKey, prefKey, newValue).catch((error) => {
        console.warn(`Failed to save preference to server: ${pageKey}/${prefKey}`)

        const status =
          error instanceof PreferenceSaveError && typeof error.status === 'number'
            ? error.status
            : undefined

        if (typeof window !== 'undefined' && (status === 401 || status === 403)) {
          localStorage.removeItem('axiom_token')
          localStorage.removeItem('axiom_user')
          resetPreferencesCache()
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(PREFERENCE_SAVE_ERROR_EVENT, {
            detail: {
              pageKey,
              preferenceKey: prefKey,
              reason: error instanceof Error ? error.message : 'unknown error',
              status,
            },
          }))
        }
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageKey, prefKey, localKey],
  )

  return [value, set, loading]
}

/**
 * resetPreferencesCache should be called on logout so the next login gets fresh data.
 */
export function resetPreferencesCache() {
  cache = {}
  cacheLoaded = false
}
