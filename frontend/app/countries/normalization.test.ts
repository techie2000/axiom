import { describe, expect, it } from 'vitest'
import { normalizeCountriesPayload, normalizeCountry, summarizeCountriesDataQuality } from './normalization'

describe('countries normalization', () => {
  it('maps backend country shape to UI country shape', () => {
    const result = normalizeCountry({
      id: '1',
      code: 'HU',
      name: 'Hungary',
      alpha3_code: 'HUN',
    })

    expect(result).toEqual({
      id: '1',
      code: 'HU',
      name: 'Hungary',
      alpha2: 'HU',
      alpha3: 'HUN',
      numeric_code: '',
      native_name: '',
      continent: '',
      capital: '',
      region: '',
      phone_codes: [],
      currency_codes: [],
      languages: [],
      active: false,
    })
  })

  it('supports legacy alpha fields when provided', () => {
    const result = normalizeCountry({
      id: '2',
      code: 'DE',
      name: 'Germany',
      alpha2: 'de',
      alpha3: 'deu',
      numeric_code: '276',
    })

    expect(result.alpha2).toBe('DE')
    expect(result.alpha3).toBe('DEU')
    expect(result.numeric_code).toBe('276')
  })

  it('maps optional fields used by wide countries table', () => {
    const result = normalizeCountry({
      id: '3',
      code: 'US',
      name: 'United States',
      alpha3_code: 'USA',
      native_name: 'United States',
      capital: 'Washington, D.C.',
      continent: 'NA',
      region: 'Northern America',
      phone_codes: '["+1"]',
      currency_codes: ['USD'],
      languages: 'en,es',
      active: true,
    })

    expect(result.phone_codes).toEqual(['+1'])
    expect(result.currency_codes).toEqual(['USD'])
    expect(result.languages).toEqual(['en', 'es'])
    expect(result.active).toBe(true)
  })

  it('returns empty array for non-array payloads', () => {
    expect(normalizeCountriesPayload(null)).toEqual([])
    expect(normalizeCountriesPayload({})).toEqual([])
  })

  it('filters invalid rows without country name', () => {
    const result = normalizeCountriesPayload([
      { id: '1', code: 'FR', name: 'France', alpha3_code: 'FRA' },
      { id: '2', code: 'XX', alpha3_code: 'XXX' },
    ])

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('France')
  })

  it('summarizes missing primary and secondary country codes', () => {
    const summary = summarizeCountriesDataQuality([
      { id: '1', code: 'FR', name: 'France', alpha3_code: 'FRA' },
      { id: '2', name: 'Unknownland' },
      { id: '3', alpha2_code: 'DE', name: 'Germany' },
    ])

    expect(summary.totalRows).toBe(3)
    expect(summary.missingPrimaryAlpha2Rows).toBe(1)
    expect(summary.missingSecondaryAlpha3Rows).toBe(2)
  })

  it('returns zero summary for non-array payload', () => {
    const summary = summarizeCountriesDataQuality(undefined)

    expect(summary).toEqual({
      totalRows: 0,
      missingPrimaryAlpha2Rows: 0,
      missingSecondaryAlpha3Rows: 0,
    })
  })
})
