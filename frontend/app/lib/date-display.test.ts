import { describe, expect, it } from 'vitest'
import { formatDateOnlyDisplay, formatDateTimeDisplay, isPlaceholderDateValue } from './date-display'

describe('date-display', () => {
  it('detects empty and Go zero-date placeholders', () => {
    expect(isPlaceholderDateValue('')).toBe(true)
    expect(isPlaceholderDateValue('0001-01-01T00:00:00Z')).toBe(true)
    expect(isPlaceholderDateValue('0001-01-01 00:00:00+00')).toBe(true)
    expect(isPlaceholderDateValue('2026-04-11T00:00:00Z')).toBe(false)
  })

  it('formats date-time values and keeps placeholder overrides for scheduler contexts', () => {
    expect(formatDateTimeDisplay('2026-04-11T14:32:10Z', 'Never')).toBe('2026-04-11 14:32:10')
    expect(formatDateTimeDisplay('0001-01-01T00:00:00Z', 'Never')).toBe('Never')
    expect(formatDateTimeDisplay('not-a-date', 'Never')).toBe('Never')
  })

  it('formats date-only values with the standard placeholder', () => {
    expect(formatDateOnlyDisplay('2026-04-11T14:32:10Z')).toBe('2026-04-11')
    expect(formatDateOnlyDisplay('0001-01-01T00:00:00Z')).toBe('-')
    expect(formatDateOnlyDisplay('not-a-date')).toBe('-')
  })
})
