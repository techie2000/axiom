import { describe, expect, it } from 'vitest'
import { formatCurrentPageStatValue } from './stats-format'

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
})
