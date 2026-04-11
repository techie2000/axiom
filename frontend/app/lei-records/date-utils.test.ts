import { describe, expect, test } from 'vitest'
import { getRelativeTimeInfo } from './date-utils'

describe('getRelativeTimeInfo', () => {
  test('returns placeholder for empty and zero-like timestamps', () => {
    expect(getRelativeTimeInfo('', new Date('2026-04-11T00:00:00Z'))).toEqual({
      days: 0,
      isOverdue: false,
      isPlaceholder: true,
      tense: 'today',
      unit: 'day',
      value: 0,
    })

    expect(getRelativeTimeInfo('0001-01-01T00:00:00Z', new Date('2026-04-11T00:00:00Z'))).toEqual({
      days: 0,
      isOverdue: false,
      isPlaceholder: true,
      tense: 'today',
      unit: 'day',
      value: 0,
    })

    expect(getRelativeTimeInfo('0001-01-01 00:00:00+00', new Date('2026-04-11T00:00:00Z'))).toEqual({
      days: 0,
      isOverdue: false,
      isPlaceholder: true,
      tense: 'today',
      unit: 'day',
      value: 0,
    })
  })

  test('returns placeholder for invalid dates', () => {
    expect(getRelativeTimeInfo('not-a-date', new Date('2026-04-11T00:00:00Z'))).toEqual({
      days: 0,
      isOverdue: false,
      isPlaceholder: true,
      tense: 'today',
      unit: 'day',
      value: 0,
    })
  })

  test('formats past dates as ago and marks overdue', () => {
    const result = getRelativeTimeInfo('2026-04-09T00:00:00Z', new Date('2026-04-11T00:00:00Z'))
    expect(result.days).toBe(-2)
    expect(result.isOverdue).toBe(true)
    expect(result.isPlaceholder).toBe(false)
    expect(result.tense).toBe('past')
    expect(result.unit).toBe('day')
    expect(result.value).toBe(2)
  })

  test('formats future dates as in x days', () => {
    const result = getRelativeTimeInfo('2026-04-14T00:00:00Z', new Date('2026-04-11T00:00:00Z'))
    expect(result.days).toBe(3)
    expect(result.isOverdue).toBe(false)
    expect(result.isPlaceholder).toBe(false)
    expect(result.tense).toBe('future')
    expect(result.unit).toBe('day')
    expect(result.value).toBe(3)
  })
})
