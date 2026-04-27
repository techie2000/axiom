export function resolveApiBaseUrl(isBrowser: boolean = typeof window !== 'undefined'): string {
  if (isBrowser) {
    // Browser calls stay same-origin and are forwarded by Next.js rewrites.
    // Using origin keeps user-facing diagnostics readable.
    return window.location.origin
  }

  return process.env.INTERNAL_API_PROXY_TARGET || 'http://localhost:18080'
}

export function getApiBaseUrl(): string {
  return resolveApiBaseUrl()
}
