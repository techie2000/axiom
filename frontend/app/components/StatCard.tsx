interface StatCardProps {
  title: string
  value: string | number
  accent?: 'green' | 'red' | 'blue' | 'yellow' | 'purple' | 'gray' | 'default'
}

const accentClasses: Record<NonNullable<StatCardProps['accent']>, { border: string; text: string; label: string }> = {
  green:   { border: 'border-green-200 dark:border-green-500/30', text: 'text-green-700 dark:text-green-400', label: 'text-green-700 dark:text-green-400' },
  red:     { border: 'border-red-200 dark:border-red-500/30',     text: 'text-red-700 dark:text-red-400',     label: 'text-red-700 dark:text-red-400'     },
  blue:    { border: 'border-blue-200 dark:border-blue-500/30',   text: 'text-blue-700 dark:text-blue-400',   label: 'text-blue-700 dark:text-blue-400'   },
  yellow:  { border: 'border-yellow-200 dark:border-yellow-500/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'text-yellow-700 dark:text-yellow-400' },
  purple:  { border: 'border-purple-200 dark:border-purple-500/30', text: 'text-purple-700 dark:text-purple-400', label: 'text-purple-700 dark:text-purple-400' },
  gray:    { border: 'border-gray-300 dark:border-gray-500/30', text: 'text-gray-700 dark:text-gray-300', label: 'text-gray-700 dark:text-gray-300' },
  default: { border: 'border-gray-200 dark:border-white/10',      text: 'text-gray-900 dark:text-white',      label: 'text-gray-600 dark:text-gray-400'   },
}

export default function StatCard({ title, value, accent = 'default' }: StatCardProps) {
  const { border, text, label } = accentClasses[accent]
  return (
    <div className={`bg-white dark:bg-white/5 rounded-lg shadow p-6 border-2 ${border}`}>
      <h3 className={`text-sm font-medium ${label}`}>{title}</h3>
      <p className={`text-3xl font-bold mt-2 ${text}`}>{value}</p>
    </div>
  )
}
