import { ReactNode } from 'react'

interface ReferenceDetailListProps<TDetails extends Record<string, unknown>> {
  values: string[]
  normalizeValue: (value: string) => string
  getDisplayValue: (normalizedValue: string) => string
  getDetails: (normalizedValue: string) => TDetails | undefined
  preferredOrder: string[]
  emptyPlaceholder?: ReactNode
}

const triggerClassName = 'cursor-help underline decoration-dotted decoration-gray-400/80 underline-offset-2'

const toDetailLabel = (key: string): string => {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

const toDetailValue = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean)

    return normalized.length > 0 ? normalized.join(', ') : null
  }

  if (typeof value === 'object') {
    return null
  }

  const normalizedValue = String(value).trim()
  if (!normalizedValue) {
    return null
  }

  return normalizedValue
}

const buildDetailTooltip = (
  details: Record<string, unknown> | undefined,
  preferredOrder: string[]
): string | undefined => {
  if (!details) {
    return undefined
  }

  const allKeys = Object.keys(details)
  if (allKeys.length === 0) {
    return undefined
  }

  const preferredKeys = preferredOrder.filter((key) => allKeys.includes(key))
  const remainingKeys = allKeys.filter((key) => !preferredKeys.includes(key)).sort((a, b) => a.localeCompare(b))

  const lines = [...preferredKeys, ...remainingKeys]
    .map((key) => {
      const value = toDetailValue(details[key])
      if (!value) {
        return null
      }

      return `${toDetailLabel(key)}: ${value}`
    })
    .filter((line): line is string => Boolean(line))

  return lines.length > 0 ? lines.join('\n') : undefined
}

export default function ReferenceDetailList<TDetails extends Record<string, unknown>>({
  values,
  normalizeValue,
  getDisplayValue,
  getDetails,
  preferredOrder,
  emptyPlaceholder = '-',
}: ReferenceDetailListProps<TDetails>) {
  const normalizedValues = values
    .map((value) => normalizeValue(String(value || '')))
    .filter(Boolean)

  if (normalizedValues.length === 0) {
    return <>{emptyPlaceholder}</>
  }

  return (
    <>
      {normalizedValues.map((normalizedValue, index) => {
        const details = getDetails(normalizedValue)
        const tooltip = buildDetailTooltip(details, preferredOrder)

        return (
          <span
            key={`${normalizedValue}-${index}`}
            title={tooltip}
            className={tooltip ? triggerClassName : ''}
          >
            {getDisplayValue(normalizedValue)}
            {index < normalizedValues.length - 1 ? ', ' : ''}
          </span>
        )
      })}
    </>
  )
}
