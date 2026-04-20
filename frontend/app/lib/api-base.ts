export function resolveApiBaseUrl(isBrowser: boolean = typeof window !== 'undefined'): string {
  if (isBrowser) {
    // Browser calls stay same-origin and are forwarded by Next.js rewrites.
    return ''
  }

  return process.env.INTERNAL_API_PROXY_TARGET || 'http://localhost:18080'
}

export function getApiBaseUrl(): string {
  return resolveApiBaseUrl()
}
