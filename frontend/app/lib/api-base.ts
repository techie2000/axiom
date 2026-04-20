export function resolveApiBaseUrl(isBrowser: boolean = typeof window !== 'undefined'): string {
  return isBrowser
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080')
    : 'http://backend:8080'
}

export function getApiBaseUrl(): string {
  return resolveApiBaseUrl()
}
