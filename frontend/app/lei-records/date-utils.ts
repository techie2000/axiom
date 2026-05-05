import { isPlaceholderDateValue } from '../lib/date-display'

export interface RelativeTimeInfo {
  days: number
  isOverdue: boolean
  isPlaceholder: boolean
  tense: 'past' | 'future' | 'today'
  unit: 'day' | 'week' | 'month' | 'year'
  value: number
}

export type RelativeTimeTranslationKey =
  | 'today'
  | 'dayAgo'
  | 'weekAgo'
  | 'monthAgo'
  | 'yearAgo'
  | 'inDay'
  | 'inWeek'
  | 'inMonth'
  | 'inYear'
  | 'overdueBy'
  | 'overdueByWeek'
  | 'overdueByMonth'
  | 'overdueByYear'

export function getRelativeTimeInfo(dateString: string, now: Date = new Date()): RelativeTimeInfo {
  const trimmedDate = (dateString || '').trim()
  if (isPlaceholderDateValue(trimmedDate)) {
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

export function getRelativeTimeTranslationKey(
  dateInfo: RelativeTimeInfo,
  mode: 'standard' | 'overdue' = 'standard'
): RelativeTimeTranslationKey {
  if (dateInfo.isPlaceholder || dateInfo.tense === 'today') {
    return 'today'
  }

  if (mode === 'overdue') {
    if (dateInfo.unit === 'week') return 'overdueByWeek'
    if (dateInfo.unit === 'month') return 'overdueByMonth'
    if (dateInfo.unit === 'year') return 'overdueByYear'
    return 'overdueBy'
  }

  if (dateInfo.tense === 'past') {
    if (dateInfo.unit === 'day') return 'dayAgo'
    if (dateInfo.unit === 'week') return 'weekAgo'
    if (dateInfo.unit === 'month') return 'monthAgo'
    return 'yearAgo'
  }

  if (dateInfo.unit === 'day') return 'inDay'
  if (dateInfo.unit === 'week') return 'inWeek'
  if (dateInfo.unit === 'month') return 'inMonth'
  return 'inYear'
}
