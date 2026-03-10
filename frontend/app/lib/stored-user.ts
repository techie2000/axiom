export interface StoredUser {
  id: string
  email: string
  username: string
  full_name: string
  role: string
  status: string
}

export function readStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = localStorage.getItem('axiom_user')
    if (!raw) {
      return null
    }

    return JSON.parse(raw) as StoredUser
  } catch {
    return null
  }
}
