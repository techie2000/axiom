import { describe, expect, it } from 'vitest'
import { formatStatusLabel } from './status-label'

describe('formatStatusLabel', () => {
  it('title-cases a single-segment status', () => {
    expect(formatStatusLabel('ACTIVE')).toBe('Active')
    expect(formatStatusLabel('FAILED')).toBe('Failed')
    expect(formatStatusLabel('PENDING')).toBe('Pending')
  })

  it('title-cases multi-segment underscore statuses', () => {
    expect(formatStatusLabel('IN_PROGRESS')).toBe('In Progress')
    expect(formatStatusLabel('DAILY_FULL')).toBe('Daily Full')
    expect(formatStatusLabel('DAILY_DELTA')).toBe('Daily Delta')
    expect(formatStatusLabel('NOT_FOUND')).toBe('Not Found')
  })

  it('returns "Unknown" for falsy values', () => {
    expect(formatStatusLabel(undefined)).toBe('Unknown')
    expect(formatStatusLabel('')).toBe('Unknown')
  })
})
