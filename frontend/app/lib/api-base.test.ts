// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getApiBaseUrl, resolveApiBaseUrl } from './api-base'

describe('api-base', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses NEXT_PUBLIC_API_URL in the browser when configured', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://example.test')

    expect(resolveApiBaseUrl(true)).toBe('https://example.test')
    expect(getApiBaseUrl()).toBe('https://example.test')
  })

  it('falls back to the local browser default when NEXT_PUBLIC_API_URL is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '')

    expect(resolveApiBaseUrl(true)).toBe('http://localhost:18080')
  })

  it('uses the internal backend host for server-side calls', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://example.test')

    expect(resolveApiBaseUrl(false)).toBe('http://backend:8080')
  })
})
