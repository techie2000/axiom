import { describe, expect, it } from 'vitest'
import { buildCodeMappingsHeaders } from './request'

describe('buildCodeMappingsHeaders', () => {
  it('includes Authorization header when token is present', () => {
    const headers = buildCodeMappingsHeaders('jwt-token') as Record<string, string>

    expect(headers.Accept).toBe('application/json')
    expect(headers.Authorization).toBe('Bearer jwt-token')
  })

  it('only includes Accept header when token is absent', () => {
    const headers = buildCodeMappingsHeaders(null) as Record<string, string>

    expect(headers.Accept).toBe('application/json')
    expect(headers.Authorization).toBeUndefined()
  })
})
