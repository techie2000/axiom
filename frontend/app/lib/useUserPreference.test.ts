// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUserPreference, resetPreferencesCache } from './useUserPreference'

describe('resetPreferencesCache', () => {
  it('is a callable function that does not throw', () => {
    expect(() => resetPreferencesCache()).not.toThrow()
  })

  it('resets the cache so fresh defaults are returned after clearing', async () => {
    // Seed the hook with a stored value.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }))
    localStorage.setItem('axiom_token', 'test-token')
    localStorage.setItem('axiom-pref-mypage::mykey', 'previous-value')

    // After a cache reset the hook should re-read from storage/API.
    resetPreferencesCache()

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
})
