export function isNullLikeValue(value: unknown): value is string {
  return typeof value === 'string' && value.trim().toLowerCase() === 'null'
}

export function normalizeRecordNullLikeValues<T extends object>(record: T): T {
  const normalized = { ...record } as T

  for (const key of Object.keys(normalized) as Array<keyof T>) {
    const value = normalized[key]
    if (isNullLikeValue(value)) {
      ;(normalized as Record<string, unknown>)[String(key)] = ''
    }
  }

  return normalized as T
}

export function formatLEIDisplayValue(value: unknown): string {
  if (!value || isNullLikeValue(value) || value === '0001-01-01T00:00:00Z') {
    return '-'
  }

  return String(value)
}

export function getStatusBadgePresentation(value: unknown): { label: string; isActive: boolean } {
  const label = formatLEIDisplayValue(value)
  return {
    label,
    isActive: label === 'ACTIVE',
  }
}

export function formatLEICellValue(value: unknown, key: string): string {
  const baseDisplayValue = formatLEIDisplayValue(value)
  if (baseDisplayValue === '-') {
    return '-'
  }

  if (key.includes('date') && typeof value === 'string') {
    try {
      const date = new Date(value)
      return date.toISOString().split('T')[0]
    } catch {
      return baseDisplayValue
    }
  }

  return baseDisplayValue
}
