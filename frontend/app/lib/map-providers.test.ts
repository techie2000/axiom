import { describe, expect, it } from 'vitest'
import {
  AddressComponents,
  MAP_PROVIDERS,
  MapProviderId,
  buildAddressQuery,
  buildMapUrl,
  DEFAULT_MAP_PROVIDER,
  getMapProvider,
} from './map-providers'

const SAMPLE_ADDRESS: AddressComponents = {
  line1: '1 Infinite Loop',
  city: 'Cupertino',
  postalCode: '95014',
  country: 'US',
}

describe('buildAddressQuery', () => {
  it('joins non-empty parts with ", "', () => {
    const result = buildAddressQuery(SAMPLE_ADDRESS)
    expect(result).toBe('1 Infinite Loop, Cupertino, 95014, US')
  })

  it('includes region when provided', () => {
    const result = buildAddressQuery({ city: 'Seattle', region: 'WA', postalCode: '98101', country: 'US' })
    expect(result).toBe('Seattle, WA, 98101, US')
  })

  it('skips undefined and empty parts', () => {
    const result = buildAddressQuery({ city: 'London', postalCode: '', country: 'GB' })
    expect(result).toBe('London, GB')
  })

  it('returns empty string when address is entirely empty', () => {
    expect(buildAddressQuery({})).toBe('')
  })
})

describe('buildMapUrl', () => {
  const ENCODED = encodeURIComponent('1 Infinite Loop, Cupertino, 95014, US')

  it('defaults to OpenStreetMap', () => {
    const url = buildMapUrl(SAMPLE_ADDRESS)
    expect(url).toBe(`https://www.openstreetmap.org/search?query=${ENCODED}`)
  })

  it('builds OpenStreetMap URL', () => {
    const url = buildMapUrl(SAMPLE_ADDRESS, 'openstreetmap')
    expect(url).toBe(`https://www.openstreetmap.org/search?query=${ENCODED}`)
  })

  it('builds Google Maps URL', () => {
    const url = buildMapUrl(SAMPLE_ADDRESS, 'google')
    expect(url).toBe(`https://www.google.com/maps/search/?api=1&query=${ENCODED}`)
  })

  it('builds Bing Maps URL', () => {
    const url = buildMapUrl(SAMPLE_ADDRESS, 'bing')
    expect(url).toBe(`https://www.bing.com/maps?q=${ENCODED}`)
  })

  it('builds Apple Maps URL', () => {
    const url = buildMapUrl(SAMPLE_ADDRESS, 'apple')
    expect(url).toBe(`https://maps.apple.com/?q=${ENCODED}`)
  })

  it('falls back to OpenStreetMap for unknown provider id', () => {
    const url = buildMapUrl(SAMPLE_ADDRESS, 'unknown' as MapProviderId)
    expect(url).toBe(`https://www.openstreetmap.org/search?query=${ENCODED}`)
  })

  it('encodes special characters in the address', () => {
    const addr: AddressComponents = { line1: 'Straße 1', city: 'München' }
    const url = buildMapUrl(addr, 'bing')
    expect(url).toContain(encodeURIComponent('Straße 1, München'))
  })
})

describe('getMapProvider', () => {
  it('returns the correct provider for each id', () => {
    expect(getMapProvider('openstreetmap').label).toBe('OpenStreetMap')
    expect(getMapProvider('google').label).toBe('Google Maps')
    expect(getMapProvider('bing').label).toBe('Bing Maps')
    expect(getMapProvider('apple').label).toBe('Apple Maps')
  })

  it('falls back to OpenStreetMap for unknown id', () => {
    expect(getMapProvider('unknown').id).toBe('openstreetmap')
  })
})

describe('MAP_PROVIDERS', () => {
  it('contains exactly 4 providers', () => {
    expect(MAP_PROVIDERS).toHaveLength(4)
  })

  it('default provider is openstreetmap', () => {
    expect(DEFAULT_MAP_PROVIDER).toBe('openstreetmap')
    expect(MAP_PROVIDERS[0].id).toBe('openstreetmap')
  })
})
