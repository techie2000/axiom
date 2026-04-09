export const LEI_STATUS_FILTER_OPTIONS = ['ACTIVE', 'INACTIVE', 'NOT_SET'] as const

function isNotSetStatusFilterValue(value: string): boolean {
  const normalized = value.trim().replaceAll(' ', '_').toUpperCase()
  return normalized === 'NULL' || normalized === 'NOT_SET'
}

export function formatStatusFilterLabel(value: string): string {
  return isNotSetStatusFilterValue(value) ? 'Not Set' : value
}

export function normalizeStatusFilterForAPI(value: string): string {
  return isNotSetStatusFilterValue(value) ? 'NOT_SET' : value
}
