// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { getAuthToken, isAuthenticated, normalizeAuthToken } from './auth-token'

describe('normalizeAuthToken', () => {
  it('returns null for null or undefined input', () => {
    expect(normalizeAuthToken(null)).toBeNull()
    expect(normalizeAuthToken(undefined)).toBeNull()
  })

  it('returns null for empty or whitespace-only strings', () => {
    expect(normalizeAuthToken('')).toBeNull()
    expect(normalizeAuthToken('   ')).toBeNull()
  })

  it('returns null for sentinel string values', () => {
    expect(normalizeAuthToken('undefined')).toBeNull()
    expect(normalizeAuthToken('null')).toBeNull()
    expect(normalizeAuthToken('UNDEFINED')).toBeNull()
    expect(normalizeAuthToken('NULL')).toBeNull()
  })

  it('strips a "Bearer " prefix', () => {
    expect(normalizeAuthToken('Bearer abc123')).toBe('abc123')
    expect(normalizeAuthToken('BEARER abc123')).toBe('abc123')
    expect(normalizeAuthToken('bearer abc123')).toBe('abc123')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeAuthToken('  abc123  ')).toBe('abc123')
    expect(normalizeAuthToken('Bearer  abc123 ')).toBe('abc123')
  })

  it('returns a valid token unchanged (except trimming)', () => {
    expect(normalizeAuthToken('eyJhbGciOiJIUzI1NiJ9.payload.sig')).toBe(
      'eyJhbGciOiJIUzI1NiJ9.payload.sig',
    )
  })
})

describe('getAuthToken', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when localStorage has no token', () => {
    expect(getAuthToken()).toBeNull()
  })

  it('returns null when localStorage has a sentinel token', () => {
    localStorage.setItem('axiom_token', 'undefined')
    expect(getAuthToken()).toBeNull()
  })

  it('returns the normalised token when a Bearer token is stored', () => {
    localStorage.setItem('axiom_token', 'Bearer mytoken')
    expect(getAuthToken()).toBe('mytoken')
  })

  it('returns the token directly when stored without prefix', () => {
    localStorage.setItem('axiom_token', 'rawtoken')
    expect(getAuthToken()).toBe('rawtoken')
  })
})

describe('isAuthenticated', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns false when no valid token is stored', () => {
    expect(isAuthenticated()).toBe(false)
  })

  it('returns false when a sentinel value is stored', () => {
    localStorage.setItem('axiom_token', 'null')
    expect(isAuthenticated()).toBe(false)
  })

  it('returns true when a valid token is stored', () => {
    localStorage.setItem('axiom_token', 'validtoken')
    expect(isAuthenticated()).toBe(true)
  })
})

