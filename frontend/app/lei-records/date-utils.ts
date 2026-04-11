export interface RelativeTimeInfo {
  days: number
  relative: string
  isOverdue: boolean
}

export function getRelativeTimeInfo(dateString: string, now: Date = new Date()): RelativeTimeInfo {
  if (!dateString || dateString === '0001-01-01T00:00:00Z') {
    return { days: 0, relative: '-', isOverdue: false }
  }

  const date = new Date(dateString)
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  const absDays = Math.abs(diffDays)

  let relative: string
  if (absDays === 0) {
    relative = 'today'
  } else if (absDays === 1) {
    relative = diffDays < 0 ? '1 day ago' : 'in 1 day'
  } else if (absDays < 7) {
    relative = diffDays < 0 ? `${absDays} days ago` : `in ${absDays} days`
  } else if (absDays < 30) {
    const weeks = Math.round(absDays / 7)
    relative = diffDays < 0
      ? `${weeks} week${weeks > 1 ? 's' : ''} ago`
      : `in ${weeks} week${weeks > 1 ? 's' : ''}`
  } else if (absDays < 365) {
    const months = Math.round(absDays / 30)
    relative = diffDays < 0
      ? `${months} month${months > 1 ? 's' : ''} ago`
      : `in ${months} month${months > 1 ? 's' : ''}`
  } else {
    const years = Math.round(absDays / 365)
    relative = diffDays < 0
      ? `${years} year${years > 1 ? 's' : ''} ago`
      : `in ${years} year${years > 1 ? 's' : ''}`
  }

  return {
    days: diffDays,
    relative,
    isOverdue: diffDays < 0,
  }
}

export function formatDayDelta(days: number): string {
  const absDays = Math.abs(days)
  if (absDays === 0) {
    return 'today'
  }

  const suffix = absDays === 1 ? 'day' : 'days'
  return days < 0 ? `${absDays} ${suffix} ago` : `in ${absDays} ${suffix}`
}
