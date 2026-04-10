interface StatCardProps {
  title: string
  value: string | number
  accent?: 'green' | 'red' | 'blue' | 'yellow' | 'purple' | 'gray' | 'default'
  titleTooltip?: string
}

const accentClasses: Record<NonNullable<StatCardProps['accent']>, { border: string; text: string; label: string }> = {
  green:   { border: 'theme-status-border-success', text: 'theme-status-text-success', label: 'theme-status-text-success' },
  red:     { border: 'theme-status-border-danger',  text: 'theme-status-text-danger',  label: 'theme-status-text-danger'  },
  blue:    { border: 'theme-status-border-info',    text: 'theme-status-text-info',    label: 'theme-status-text-info'    },
  yellow:  { border: 'theme-status-border-warning', text: 'theme-status-text-warning', label: 'theme-status-text-warning' },
  purple:  { border: 'theme-status-border-info',    text: 'theme-status-text-info',    label: 'theme-status-text-info'    },
  gray:    { border: 'border-[rgb(var(--border-rgb)/0.7)]', text: 'theme-text-muted', label: 'theme-text-muted' },
  default: { border: 'border-[rgb(var(--border-rgb))]',      text: '',      label: 'theme-text-muted'   },
}

export default function StatCard({ title, value, accent = 'default', titleTooltip }: StatCardProps) {
  const { border, text, label } = accentClasses[accent]
  return (
    <div className={`theme-panel rounded-lg shadow p-6 border-2 ${border}`}>
      <h3 className={`text-sm font-medium ${label}`} title={titleTooltip}>{title}</h3>
      <p className={`text-3xl font-bold mt-2 ${text}`}>{value}</p>
    </div>
  )
}
