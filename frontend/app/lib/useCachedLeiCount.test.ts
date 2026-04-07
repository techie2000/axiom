// @vitest-environment happy-dom
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readCachedLeiCount, useCachedLeiCount, writeCachedLeiCount } from './useCachedLeiCount'

describe('useCachedLeiCount', () => {
  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('uses the cached count when the sync timestamp matches', async () => {
    writeCachedLeiCount(3271954, '2026-04-08T02:33:58Z')

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ last_success_at: '2026-04-08T02:33:58Z' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useCachedLeiCount('http://localhost:8080'))

    expect(result.current.count).toBe(3271954)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/v1/lei/status/DAILY_FULL', { cache: 'no-store' })
  })

  it('fetches and caches the count when the sync timestamp changes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ last_success_at: '2026-04-08T02:33:58Z' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ count: 3271954 }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useCachedLeiCount('http://localhost:8080'))

    await waitFor(() => {
      expect(result.current.count).toBe(3271954)
      expect(result.current.loading).toBe(false)
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(readCachedLeiCount()).toEqual({
      count: 3271954,
      lastSuccessAt: '2026-04-08T02:33:58Z',
    })
  })
})