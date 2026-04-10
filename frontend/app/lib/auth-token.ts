const INVALID_TOKEN_VALUES = new Set(['', 'undefined', 'null'])

export function normalizeAuthToken(token: string | null | undefined): string | null {
  if (!token) {
    return null
  }

  const normalized = token.replace(/^Bearer\s+/i, '').trim()
  if (INVALID_TOKEN_VALUES.has(normalized.toLowerCase())) {
    return null
  }

  return normalized
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  return normalizeAuthToken(localStorage.getItem('axiom_token'))
}

export function isAuthenticated(): boolean {
  return getAuthToken() !== null
}