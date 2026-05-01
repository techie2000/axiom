import { describe, expect, it } from 'vitest'

import { filterUserEntityLinks } from './user-entity-link-filter'

describe('filterUserEntityLinks', () => {
  const links = [
    {
      entity_role: 'viewer' as const,
      revoked_at: null,
      expires_at: null,
    },
    {
      entity_role: 'trader' as const,
      revoked_at: null,
      expires_at: '2026-01-01T00:00:00Z',
    },
    {
      entity_role: 'entity_admin' as const,
      revoked_at: '2026-04-01T00:00:00Z',
      expires_at: null,
    },
  ]

  it('returns only active links when active-only mode is enabled', () => {
    const result = filterUserEntityLinks(links, {
      showActiveOnly: true,
      status: 'all',
      role: 'all',
    })

    expect(result).toHaveLength(1)
    expect(result[0].entity_role).toBe('viewer')
  })

  it('filters by status when active-only mode is disabled', () => {
    const statusAwareLinks = links.map((link) => ({ ...link }))

    const result = filterUserEntityLinks(statusAwareLinks, {
      showActiveOnly: false,
      status: 'expired',
      role: 'all',
    })

    expect(result).toHaveLength(1)
    expect(result[0].entity_role).toBe('trader')
  })

  it('filters by role', () => {
    const result = filterUserEntityLinks(links, {
      showActiveOnly: false,
      status: 'all',
      role: 'entity_admin',
    })

    expect(result).toHaveLength(1)
    expect(result[0].revoked_at).toBe('2026-04-01T00:00:00Z')
  })

  it('combines filters with AND semantics', () => {
    const result = filterUserEntityLinks(links, {
      showActiveOnly: false,
      status: 'revoked',
      role: 'entity_admin',
    })

    expect(result).toHaveLength(1)
    expect(result[0].entity_role).toBe('entity_admin')
  })

  it('returns empty when filters conflict', () => {
    const result = filterUserEntityLinks(links, {
      showActiveOnly: true,
      status: 'revoked',
      role: 'viewer',
    })

    expect(result).toEqual([])
  })
})
