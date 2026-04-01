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
      if (key === 'leiRecords.stats.currentPageFiltered') return `Page ${options?.page} (filtered)`
      if (key === 'leiRecords.stats.currentPageOf') return `Page ${options?.page} of ${options?.total}`
      if (key === 'leiRecords.stats.currentPageOnly') return `Page ${options?.page}`
      return key
    }

    const value = formatCurrentPageStatValue({
      hasActiveFilters: false,
      currentPage: 1,
      totalPages: 0,
      t,
    })

    // Must not render "1 of 0" and must not show "(filtered)" when no filters are active
    expect(value).toBe('Page 1')
    expect(value).not.toContain('of 0')
    expect(value).not.toContain('filtered')
  })

  it('shows filtered label when filters are active even if totalPages is 0', () => {
    const t = (key: string, options?: Record<string, unknown>) => {
      if (key === 'leiRecords.stats.currentPageFiltered') return `Page ${options?.page} (filtered)`
      if (key === 'leiRecords.stats.currentPageOf') return `Page ${options?.page} of ${options?.total}`
      if (key === 'leiRecords.stats.currentPageOnly') return `Page ${options?.page}`
      return key
    }

    const value = formatCurrentPageStatValue({
      hasActiveFilters: true,
      currentPage: 2,
      totalPages: 0,
      t,
    })

    expect(value).toBe('Page 2 (filtered)')
  })
})

describe('computeShowingEnd', () => {
  it('uses totalRecords cap when totalRecords > 0', () => {
    expect(computeShowingEnd(1, 50, 120, 50)).toBe(50)
    expect(computeShowingEnd(3, 50, 120, 20)).toBe(120) // page 3 ends at record 120 (totalRecords cap)
  })

  it('falls back to page-offset + recordsLength on page 1 when totalRecords is 0', () => {
    // Page 1 with 37 records → showing "1-37"
    expect(computeShowingEnd(1, 50, 0, 37)).toBe(37)
  })

  it('accounts for page offset correctly on later pages when totalRecords is 0', () => {
    // Page 2, 50 records → showing "51-100"
    expect(computeShowingEnd(2, 50, 0, 50)).toBe(100)
    // Page 3, 12 records (partial last page) → showing "101-112"
    expect(computeShowingEnd(3, 50, 0, 12)).toBe(112)
  })

  it('works for a full first page when totalRecords is 0', () => {
    expect(computeShowingEnd(1, 50, 0, 50)).toBe(50)
  })
})
