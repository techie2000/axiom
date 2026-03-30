import { describe, expect, it } from 'vitest'
import { formatStatusLabel } from './status-label'

describe('formatStatusLabel', () => {
  it('returns "Unknown" for undefined input', () => {
    expect(formatStatusLabel(undefined)).toBe('Unknown')
  })

  it('returns "Unknown" for empty string', () => {
    expect(formatStatusLabel('')).toBe('Unknown')
  })

  it('converts a single uppercase word to title case', () => {
    expect(formatStatusLabel('ACTIVE')).toBe('Active')
    expect(formatStatusLabel('PENDING')).toBe('Pending')
    expect(formatStatusLabel('FAILED')).toBe('Failed')
  })

  it('splits underscore-separated words and title-cases each segment', () => {
    expect(formatStatusLabel('IN_PROGRESS')).toBe('In Progress')
    expect(formatStatusLabel('DAILY_FULL')).toBe('Daily Full')
    expect(formatStatusLabel('NOT_FOUND')).toBe('Not Found')
  })

  it('handles already lowercase input', () => {
    expect(formatStatusLabel('active')).toBe('Active')
    expect(formatStatusLabel('in_progress')).toBe('In Progress')
  })

  it('handles mixed case input', () => {
    expect(formatStatusLabel('InProgress')).toBe('Inprogress')
  })

  it('handles a single character', () => {
    expect(formatStatusLabel('A')).toBe('A')
  })
})
