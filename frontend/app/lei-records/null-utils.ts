import { formatDateOnlyDisplay, isPlaceholderDateValue } from '../lib/date-display'

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
  if (!value || isNullLikeValue(value) || isPlaceholderDateValue(value)) {
    return '-'
  }

  return String(value)
}

export function formatEnumDisplayValue(value: unknown): string {
  const baseDisplayValue = formatLEIDisplayValue(value)
  if (baseDisplayValue === '-') {
    return '-'
  }

  return baseDisplayValue
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getStatusBadgePresentation(value: unknown): { label: string; isActive: boolean } {
  const label = formatLEIDisplayValue(value)
  return {
    label,
    isActive: label === 'ACTIVE',
  }
}

export type RegistrationStatusVariant = 'success' | 'destructive' | 'warning' | 'muted'

export function getRegistrationStatusBadgePresentation(value: unknown): {
  label: string
  variant: RegistrationStatusVariant
} {
  const rawValue = String(value || '').toUpperCase().trim()

  // Active status
  if (rawValue === 'ISSUED') {
    return { label: 'ISSUED', variant: 'success' }
  }

  // Invalid/lapsed statuses
  if (
    rawValue === 'LAPSED' ||
    rawValue === 'RETIRED' ||
    rawValue === 'ANNULLED' ||
    rawValue === 'DUPLICATE'
  ) {
    return { label: formatEnumDisplayValue(rawValue), variant: 'destructive' }
  }

  // In-transition statuses
  if (rawValue === 'PENDING_TRANSFER' || rawValue === 'PENDING_ARCHIVAL') {
    return { label: formatEnumDisplayValue(rawValue), variant: 'warning' }
  }

  // Unknown/future values - defensive fallback
  return { label: formatEnumDisplayValue(rawValue), variant: 'muted' }
}

export function formatLEICellValue(value: unknown, key: string): string {
  const baseDisplayValue = formatLEIDisplayValue(value)
  if (baseDisplayValue === '-') {
    return '-'
  }

  if (key === 'entity_category' || key === 'entity_sub_category' || key === 'registration_status') {
    return formatEnumDisplayValue(baseDisplayValue)
  }

  if (key.includes('date') && typeof value === 'string') {
    return formatDateOnlyDisplay(value, baseDisplayValue)
  }

  return baseDisplayValue
}
