// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest'
import { readStoredUser } from './stored-user'

describe('readStoredUser', () => {
  afterEach(() => {
    localStorage.clear()
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
})
