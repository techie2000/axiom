// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { readStoredUser } from './stored-user'

describe('readStoredUser', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when nothing is stored', () => {
    expect(readStoredUser()).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    localStorage.setItem('axiom_user', 'not-json')
    expect(readStoredUser()).toBeNull()
  })

  it('returns the parsed user object for valid JSON', () => {
    const user = {
      id: '1',
      email: 'alice@example.com',
      username: 'alice',
      full_name: 'Alice Smith',
      role: 'admin',
      status: 'active',
    }
    localStorage.setItem('axiom_user', JSON.stringify(user))
    expect(readStoredUser()).toEqual(user)
  })
})

