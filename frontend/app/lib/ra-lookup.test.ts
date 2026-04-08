import { describe, it, expect } from 'vitest'
import { buildRegistrationLookupUrl } from './ra-lookup'

describe('buildRegistrationLookupUrl', () => {
  it('substitutes the registration number into the template', () => {
    const result = buildRegistrationLookupUrl(
      'https://find-and-update.company-information.service.gov.uk/company/{registration_number}',
      '17027441'
    )
    expect(result).toBe(
      'https://find-and-update.company-information.service.gov.uk/company/17027441'
    )
  })

  it('URL-encodes the registration number', () => {
    const result = buildRegistrationLookupUrl(
      'https://example.com/search?q={registration_number}',
      'AB 123/456'
    )
    expect(result).toBe('https://example.com/search?q=AB%20123%2F456')
  })

  it('returns null when the template is empty', () => {
    expect(buildRegistrationLookupUrl('', '17027441')).toBeNull()
  })

  it('returns null when the template is null', () => {
    expect(buildRegistrationLookupUrl(null, '17027441')).toBeNull()
  })

  it('returns null when the template is undefined', () => {
    expect(buildRegistrationLookupUrl(undefined, '17027441')).toBeNull()
  })

  it('returns null when the registration number is empty', () => {
    expect(buildRegistrationLookupUrl('https://example.com/{registration_number}', '')).toBeNull()
  })

  it('returns null when the registration number is null', () => {
    expect(buildRegistrationLookupUrl('https://example.com/{registration_number}', null)).toBeNull()
  })

  it('returns null when the registration number is undefined', () => {
    expect(buildRegistrationLookupUrl('https://example.com/{registration_number}', undefined)).toBeNull()
  })

  it('handles templates without the placeholder (passes through unchanged)', () => {
    const result = buildRegistrationLookupUrl('https://example.com/list', '12345')
    expect(result).toBe('https://example.com/list')
  })

  it('handles multiple placeholder occurrences', () => {
    const result = buildRegistrationLookupUrl(
      'https://example.com/q={registration_number}&id={registration_number}',
      '99'
    )
    // replaces first occurrence (String.replace behaviour without regex)
    expect(result).toBe('https://example.com/q=99&id={registration_number}')
  })
})
