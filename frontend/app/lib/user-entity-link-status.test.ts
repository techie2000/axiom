import { describe, expect, it } from 'vitest'

import { getUserEntityLinkStatus } from './user-entity-link-status'

describe('getUserEntityLinkStatus', () => {
  it('returns revoked when revoked_at is present', () => {
    const status = getUserEntityLinkStatus(
      { revoked_at: '2026-01-01T00:00:00Z', expires_at: '2025-01-01T00:00:00Z' },
      Date.parse('2026-06-01T00:00:00Z'),
    )

    expect(status).toBe('revoked')
  })

  it('returns expired when expires_at is in the past and not revoked', () => {
    const status = getUserEntityLinkStatus(
      { revoked_at: null, expires_at: '2025-01-01T00:00:00Z' },
      Date.parse('2026-06-01T00:00:00Z'),
    )

    expect(status).toBe('expired')
  })

  it('returns active when not revoked and not expired', () => {
    const status = getUserEntityLinkStatus(
      { revoked_at: null, expires_at: '2027-01-01T00:00:00Z' },
      Date.parse('2026-06-01T00:00:00Z'),
    )

    expect(status).toBe('active')
  })
})
