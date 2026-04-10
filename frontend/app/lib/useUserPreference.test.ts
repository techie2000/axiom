// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { resetPreferencesCache, useUserPreference } from './useUserPreference'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function createLocalStorageMock() {
  const store = new Map<string, string>()

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createLocalStorageMock())
})

describe('resetPreferencesCache', () => {
  it('is a callable function that does not throw', () => {
    expect(() => resetPreferencesCache()).not.toThrow()
  })

  it('resets cache so subsequent mounts re-read localStorage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }))
    localStorage.clear()
    localStorage.setItem('axiom_pref::mypage::mykey', 'previous-value')

    const { result: firstResult } = renderHook(() =>
      useUserPreference('mypage', 'mykey', 'default-val'),
    )
    await act(async () => {})
    const [firstValue] = firstResult.current
    expect(firstValue).toBe('previous-value')

    localStorage.setItem('axiom_pref::mypage::mykey', 'next-value')

    resetPreferencesCache()

    const { result: secondResult } = renderHook(() =>
      useUserPreference('mypage', 'mykey', 'default-val'),
    )
    await act(async () => {})
    const [secondValue, , loadingAfterReset] = secondResult.current
    expect(secondValue).toBe('next-value')
    expect(typeof loadingAfterReset).toBe('boolean')

    // Calling again should not throw.
    expect(() => resetPreferencesCache()).not.toThrow()
  })
})

describe('useUserPreference', () => {
  beforeEach(() => {
    resetPreferencesCache()
    localStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    resetPreferencesCache()
  })

  it('returns the defaultValue before any preferences load', () => {
    const { result } = renderHook(() =>
      useUserPreference('testpage', 'mykey', 'default-val'),
    )

    const [value] = result.current
    expect(value).toBe('default-val')
  })

  it('returns the value stored in localStorage when no API token is present', async () => {
    // No auth token — hook reads from localStorage only.
    // The key format used internally is `axiom_pref::<pageKey>::<prefKey>`.
    localStorage.setItem('axiom_pref::testpage::localkey', 'stored-local')

    const { result } = renderHook(() =>
      useUserPreference('testpage', 'localkey', 'fallback'),
    )

    // Allow microtasks / effects to settle.
    await act(async () => {})

    const [value] = result.current
    // When there is no auth token the hook returns the localStorage value.
    expect(value).toBe('stored-local')
    // API fetch should not have been called without a token.
    expect(fetch).not.toHaveBeenCalled()
  })

  it('allows updating the preference value', async () => {
    const { result } = renderHook(() =>
      useUserPreference('testpage', 'updkey', 'initial'),
    )

    await act(async () => {
      const [, setValue] = result.current
      setValue('updated')
    })

    const [value] = result.current
    expect(value).toBe('updated')
  })

  it('returns a loading boolean as the third element', () => {
    const { result } = renderHook(() =>
      useUserPreference('testpage', 'loadkey', 'default'),
    )

    const [, , loading] = result.current
    expect(typeof loading).toBe('boolean')
  })

  it('dedupes concurrent bootstrap requests when multiple preferences mount together', async () => {
    localStorage.setItem('axiom_token', 'Bearer test-token')

    const response = deferred<{ ok: boolean; json: () => Promise<Array<{ page_key: string; preference_key: string; preference_value: string }>> }>()
    const fetchMock = vi.fn().mockImplementation(() => response.promise)
    vi.stubGlobal('fetch', fetchMock)

    const first = renderHook(() => useUserPreference('global', 'theme', 'default'))
    const second = renderHook(() => useUserPreference('global', 'dark_mode', 'dark'))

    await act(async () => {
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      response.resolve({
        ok: true,
        json: async () => [
          { page_key: 'global', preference_key: 'theme', preference_value: 'supabase' },
          { page_key: 'global', preference_key: 'dark_mode', preference_value: 'light' },
        ],
      })
      await response.promise
    })

    expect(first.result.current[0]).toBe('supabase')
    expect(second.result.current[0]).toBe('light')
    expect(first.result.current[2]).toBe(false)
    expect(second.result.current[2]).toBe(false)
  })
})
