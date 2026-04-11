export interface RelativeTimeInfo {
  days: number
  isOverdue: boolean
  isPlaceholder: boolean
  tense: 'past' | 'future' | 'today'
  unit: 'day' | 'week' | 'month' | 'year'
  value: number
}

export function getRelativeTimeInfo(dateString: string, now: Date = new Date()): RelativeTimeInfo {
  const trimmedDate = (dateString || '').trim()
  if (!trimmedDate || trimmedDate.startsWith('0001-')) {
    return {
      days: 0,
      isOverdue: false,
      isPlaceholder: true,
      tense: 'today',
      unit: 'day',
      value: 0,
    }
  }

  const date = new Date(trimmedDate)
  if (Number.isNaN(date.getTime())) {
    return {
      days: 0,
      isOverdue: false,
      isPlaceholder: true,
      tense: 'today',
      unit: 'day',
      value: 0,
    }
  }

  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  const absDays = Math.abs(diffDays)

  let tense: 'past' | 'future' | 'today' = diffDays < 0 ? 'past' : 'future'
  let unit: 'day' | 'week' | 'month' | 'year' = 'day'
  let value = absDays

  if (absDays === 0) {
    tense = 'today'
    value = 0
  } else if (absDays < 7) {
    unit = 'day'
    value = absDays
  } else if (absDays < 30) {
    unit = 'week'
    value = Math.round(absDays / 7)
  } else if (absDays < 365) {
    unit = 'month'
    value = Math.round(absDays / 30)
  } else {
    unit = 'year'
    value = Math.round(absDays / 365)
  }

  return {
    days: diffDays,
    isOverdue: diffDays < 0,
    isPlaceholder: false,
    tense,
    unit,
    value,
  }
}
