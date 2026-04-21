// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readStoredUser } from './stored-user'

function createLocalStorageMock() {
  const store = new Map<string, string>()

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createLocalStorageMock())
})

describe('readStoredUser', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns null when localStorage has no user entry', () => {
    expect(readStoredUser()).toBeNull()
  })

  it('returns the parsed user when a valid JSON entry exists', () => {
    const user = {
      id: '42',
      email: 'alice@example.com',
      username: 'alice',
      full_name: 'Alice Example',
      role: 'admin',
      status: 'active',
    }
    localStorage.setItem('axiom_user', JSON.stringify(user))
    expect(readStoredUser()).toEqual(user)
  })

  it('returns null when the stored value is not valid JSON', () => {
    localStorage.setItem('axiom_user', 'not-valid-json{{{')
    expect(readStoredUser()).toBeNull()
  })

  it('returns null when the stored value is an empty string', () => {
    localStorage.setItem('axiom_user', '')
    expect(readStoredUser()).toBeNull()
  })

  it('returns a parsed object even when the JSON shape does not match StoredUser', () => {
    // The function casts rather than validates, so any parseable JSON is returned.
    localStorage.setItem('axiom_user', JSON.stringify({ foo: 'bar' }))
    expect(readStoredUser()).toEqual({ foo: 'bar' })
  })
})
