import { getAuthToken } from '../lib/auth-token'

export function buildCodeMappingsHeaders(token = getAuthToken()): HeadersInit {
  const headers: HeadersInit = {
    Accept: 'application/json',
  }

  if (token) {
    return {
      ...headers,
      Authorization: `Bearer ${token}`,
    }
  }

  return headers
}
