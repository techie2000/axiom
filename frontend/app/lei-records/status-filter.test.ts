import { describe, expect, it } from 'vitest'
import { formatStatusFilterLabel, LEI_STATUS_FILTER_OPTIONS, normalizeStatusFilterForAPI } from './statusFilter'

describe('LEI status filter helpers', () => {
  it('uses the expected status filter options', () => {
    expect(LEI_STATUS_FILTER_OPTIONS).toEqual(['ACTIVE', 'INACTIVE', 'NOT_SET'])
  })

  it('renders Not Set label for not-set filter values', () => {
    expect(formatStatusFilterLabel('NOT_SET')).toBe('Not Set')
    expect(formatStatusFilterLabel('null')).toBe('Not Set')
    expect(formatStatusFilterLabel('Not Set')).toBe('Not Set')
    expect(formatStatusFilterLabel('ACTIVE')).toBe('ACTIVE')
  })

  it('maps not-set filters to backend not-set query token', () => {
    expect(normalizeStatusFilterForAPI('NOT_SET')).toBe('NOT_SET')
    expect(normalizeStatusFilterForAPI('null')).toBe('NOT_SET')
    expect(normalizeStatusFilterForAPI('Not Set')).toBe('NOT_SET')
    expect(normalizeStatusFilterForAPI('INACTIVE')).toBe('INACTIVE')
  })
})
