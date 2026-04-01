import { describe, expect, it } from 'vitest'
import { computeShowingEnd, formatCurrentPageStatValue } from './stats-format'

describe('formatCurrentPageStatValue', () => {
  it('formats filtered current page without duplicated prefix', () => {
    const t = (key: string, options?: Record<string, unknown>) => {
      if (key !== 'leiRecords.stats.currentPageFiltered') return key
      return `Page ${options?.page}`
    }

    const value = formatCurrentPageStatValue({
      hasActiveFilters: true,
      currentPage: 3,
      totalPages: 42,
      t,
    })

    expect(value).toBe('Page 3')
  })

  it('formats unfiltered current page with total pages', () => {
    const t = (key: string, options?: Record<string, unknown>) => {
      if (key !== 'leiRecords.stats.currentPageOf') return key
      return `Page ${options?.page} of ${options?.total}`
    }

    const value = formatCurrentPageStatValue({
      hasActiveFilters: false,
      currentPage: 2,
      totalPages: 1000,
      t,
    })

    expect(value).toBe('Page 2 of 1,000')
  })

  it('shows only the page number when totalPages is 0 (status endpoint unavailable)', () => {
    const t = (key: string, options?: Record<string, unknown>) => {
      if (key === 'leiRecords.stats.currentPageFiltered') return `Page ${options?.page}`
      if (key === 'leiRecords.stats.currentPageOf') return `Page ${options?.page} of ${options?.total}`
      return key
    }

    const value = formatCurrentPageStatValue({
      hasActiveFilters: false,
      currentPage: 1,
      totalPages: 0,
      t,
    })

    // Must not render "1 of 0" – just the current page
    expect(value).toBe('Page 1')
    expect(value).not.toContain('of 0')
  })
})

describe('computeShowingEnd', () => {
  it('uses totalRecords cap when totalRecords > 0', () => {
    expect(computeShowingEnd(1, 50, 120, 50)).toBe(50)
    expect(computeShowingEnd(3, 50, 120, 20)).toBe(120) // page 3 ends at record 120 (totalRecords cap)
  })

  it('falls back to recordsLength when totalRecords is 0', () => {
    expect(computeShowingEnd(1, 50, 0, 37)).toBe(37)
  })

  it('caps showing-end at pageEnd even when fallback is used', () => {
    // recordsLength equals itemsPerPage — normal full page
    expect(computeShowingEnd(2, 50, 0, 50)).toBe(50)
  })
})
