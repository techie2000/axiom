// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest'
import { normalizeAuthToken, getAuthToken, isAuthenticated } from './auth-token'

describe('normalizeAuthToken', () => {
  it('returns null for null input', () => {
    expect(normalizeAuthToken(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(normalizeAuthToken(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(normalizeAuthToken('')).toBeNull()
  })

  it('returns null for the string "null"', () => {
    expect(normalizeAuthToken('null')).toBeNull()
    expect(normalizeAuthToken('NULL')).toBeNull()
  })

  it('returns null for the string "undefined"', () => {
    expect(normalizeAuthToken('undefined')).toBeNull()
    expect(normalizeAuthToken('UNDEFINED')).toBeNull()
  })

  it('strips a Bearer prefix', () => {
    expect(normalizeAuthToken('Bearer my-token')).toBe('my-token')
    expect(normalizeAuthToken('bearer my-token')).toBe('my-token')
    expect(normalizeAuthToken('BEARER my-token')).toBe('my-token')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeAuthToken('  my-token  ')).toBe('my-token')
    expect(normalizeAuthToken('Bearer  my-token  ')).toBe('my-token')
  })

  it('returns a valid token unchanged', () => {
    expect(normalizeAuthToken('eyJhbGciOiJIUzI1NiJ9.payload.sig')).toBe(
      'eyJhbGciOiJIUzI1NiJ9.payload.sig',
    )
  })
})

describe('getAuthToken', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('returns null when localStorage has no token', () => {
    expect(getAuthToken()).toBeNull()
  })

  it('returns the stored token when valid', () => {
    localStorage.setItem('axiom_token', 'valid-jwt-token')
    expect(getAuthToken()).toBe('valid-jwt-token')
  })

  it('strips Bearer prefix from stored token', () => {
    localStorage.setItem('axiom_token', 'Bearer valid-jwt-token')
    expect(getAuthToken()).toBe('valid-jwt-token')
  })

  it('returns null for an invalid stored token', () => {
    localStorage.setItem('axiom_token', 'null')
    expect(getAuthToken()).toBeNull()
  })
})

describe('isAuthenticated', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('returns false when no token is stored', () => {
    expect(isAuthenticated()).toBe(false)
  })

  it('returns true when a valid token is stored', () => {
    localStorage.setItem('axiom_token', 'valid-jwt-token')
    expect(isAuthenticated()).toBe(true)
  })

  it('returns false when stored token is invalid', () => {
    localStorage.setItem('axiom_token', 'undefined')
    expect(isAuthenticated()).toBe(false)
  })
})
