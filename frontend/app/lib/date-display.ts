export function isPlaceholderDateValue(value: unknown): boolean {
  if (typeof value !== 'string') {
    return value == null
  }

  const trimmedValue = value.trim()
  return trimmedValue === '' || trimmedValue.startsWith('0001-')
}

export function formatDateTimeDisplay(value: string | null | undefined, placeholder = '—'): string {
  if (isPlaceholderDateValue(value)) {
    return placeholder
  }

  const date = new Date(String(value).trim())
  if (Number.isNaN(date.getTime())) {
    return placeholder
  }

  return date.toISOString().replace('T', ' ').substring(0, 19)
}

export function formatDateOnlyDisplay(value: string | null | undefined, placeholder = '-'): string {
  if (isPlaceholderDateValue(value)) {
    return placeholder
  }

  const date = new Date(String(value).trim())
  if (Number.isNaN(date.getTime())) {
    return placeholder
  }

  return date.toISOString().split('T')[0]
}