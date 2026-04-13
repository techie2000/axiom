// @vitest-environment happy-dom
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCollectionCount } from './useCollectionCount'

describe('useCollectionCount', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('counts array responses from the requested endpoint', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://example.test')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1 }, { id: 2 }, { id: 3 }],
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useCollectionCount('/api/v1/countries', 30000))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.count).toBe(3)
    })

    expect(fetchMock).toHaveBeenCalledWith('https://example.test/api/v1/countries', { cache: 'no-store' })
  })

  it('falls back to zero for non-array responses', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://example.test')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ count: 99 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useCollectionCount('/api/v1/countries', 30000))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.count).toBe(0)
    })
  })
})
