// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getApiBaseUrl, resolveApiBaseUrl } from './api-base'

describe('api-base', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses same-origin base in the browser', () => {
    expect(resolveApiBaseUrl(true)).toBe(window.location.origin)
    expect(getApiBaseUrl()).toBe(window.location.origin)
  })

  it('uses INTERNAL_API_PROXY_TARGET for server-side calls when configured', () => {
    vi.stubEnv('INTERNAL_API_PROXY_TARGET', 'http://backend:8080')

    expect(resolveApiBaseUrl(false)).toBe('http://backend:8080')
  })

  it('falls back to localhost target for server-side calls when INTERNAL_API_PROXY_TARGET is unset', () => {
    vi.stubEnv('INTERNAL_API_PROXY_TARGET', '')

    expect(resolveApiBaseUrl(false)).toBe('http://localhost:18080')
  })
})
