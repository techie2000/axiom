import { describe, expect, it } from 'vitest'

import { getCountryFlagEmoji } from './country-flag'

describe('getCountryFlagEmoji', () => {
  it('returns flag emoji for valid alpha-2 code', () => {
    expect(getCountryFlagEmoji('GB')).toBe('🇬🇧')
    expect(getCountryFlagEmoji('US')).toBe('🇺🇸')
  })

  it('normalizes lowercase and padded values', () => {
    expect(getCountryFlagEmoji(' gb ')).toBe('🇬🇧')
  })

  it('returns fallback for invalid or missing values', () => {
    expect(getCountryFlagEmoji('')).toBe('—')
    expect(getCountryFlagEmoji('GBR')).toBe('—')
    expect(getCountryFlagEmoji('1A')).toBe('—')
    expect(getCountryFlagEmoji(undefined)).toBe('—')
    expect(getCountryFlagEmoji(null)).toBe('—')
  })
})
