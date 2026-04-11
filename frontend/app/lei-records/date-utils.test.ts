import { describe, expect, test } from 'vitest'
import { formatDayDelta, getRelativeTimeInfo } from './date-utils'

describe('getRelativeTimeInfo', () => {
  test('returns placeholder for empty and zero timestamps', () => {
    expect(getRelativeTimeInfo('', new Date('2026-04-11T00:00:00Z'))).toEqual({
      days: 0,
      relative: '-',
      isOverdue: false,
    })

    expect(getRelativeTimeInfo('0001-01-01T00:00:00Z', new Date('2026-04-11T00:00:00Z'))).toEqual({
      days: 0,
      relative: '-',
      isOverdue: false,
    })
  })

  test('formats past dates as ago and marks overdue', () => {
    const result = getRelativeTimeInfo('2026-04-09T00:00:00Z', new Date('2026-04-11T00:00:00Z'))
    expect(result.days).toBe(-2)
    expect(result.relative).toBe('2 days ago')
    expect(result.isOverdue).toBe(true)
  })

  test('formats future dates as in x days', () => {
    const result = getRelativeTimeInfo('2026-04-14T00:00:00Z', new Date('2026-04-11T00:00:00Z'))
    expect(result.days).toBe(3)
    expect(result.relative).toBe('in 3 days')
    expect(result.isOverdue).toBe(false)
  })
})

describe('formatDayDelta', () => {
  test('formats negative, positive, and zero day values', () => {
    expect(formatDayDelta(-2)).toBe('2 days ago')
    expect(formatDayDelta(3)).toBe('in 3 days')
    expect(formatDayDelta(0)).toBe('today')
  })
})
