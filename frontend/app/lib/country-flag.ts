export function getCountryFlagEmoji(countryCode?: string | null): string {
  const normalized = (countryCode || '').trim().toUpperCase()

  if (!/^[A-Z]{2}$/.test(normalized)) {
    return '—'
  }

  const base = 127397
  const codePoints = Array.from(normalized).map((char) => base + char.charCodeAt(0))

  return String.fromCodePoint(...codePoints)
}
