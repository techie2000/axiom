// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  FAST_LEI_REFRESH_MS,
  SLOW_LEI_REFRESH_MS,
  getLeiAutoRefreshIntervalMs,
  readCachedMasterDataCounts,
  shouldRefreshMasterDataCounts,
  writeCachedMasterDataCounts,
} from './leiStatusRefresh'

describe('leiStatusRefresh', () => {
  it('uses fast refresh when any job is running', () => {
    const interval = getLeiAutoRefreshIntervalMs([
      { status: 'IDLE' },
      { status: 'RUNNING' },
      { status: 'COMPLETED' },
    ])

    expect(interval).toBe(FAST_LEI_REFRESH_MS)
  })

  it('uses slow refresh when no jobs are running', () => {
    const interval = getLeiAutoRefreshIntervalMs([
      { status: 'IDLE' },
      { status: 'COMPLETED' },
      { status: 'FAILED' },
      null,
      undefined,
    ])

    expect(interval).toBe(SLOW_LEI_REFRESH_MS)
  })

  it('marks master-data counts stale when there is no cache', () => {
    expect(shouldRefreshMasterDataCounts('2026-04-14T01:00:00Z', null)).toBe(true)
  })

  it('treats matching last_success_at as fresh', () => {
    const cached = {
      counts: { countries: 3, currencies: 4, languages: 5, total: 12 },
      lastSuccessAt: '2026-04-14T01:00:00Z',
    }

    expect(shouldRefreshMasterDataCounts('2026-04-14T01:00:00Z', cached)).toBe(false)
  })

  it('treats changed last_success_at as stale', () => {
    const cached = {
      counts: { countries: 3, currencies: 4, languages: 5, total: 12 },
      lastSuccessAt: '2026-04-14T01:00:00Z',
    }

    expect(shouldRefreshMasterDataCounts('2026-04-15T01:00:00Z', cached)).toBe(true)
  })

  it('reads and writes master-data counts cache', () => {
    const counts = { countries: 250, currencies: 180, languages: 50, total: 480 }
    writeCachedMasterDataCounts(counts, '2026-04-14T01:00:00Z')

    expect(readCachedMasterDataCounts()).toEqual({
      counts,
      lastSuccessAt: '2026-04-14T01:00:00Z',
    })
  })
})
