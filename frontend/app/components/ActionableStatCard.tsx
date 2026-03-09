import StatCard from './StatCard'

type Accent = 'green' | 'red' | 'blue' | 'yellow' | 'purple' | 'gray' | 'default'

interface ActionableStatCardProps {
  title: string
  value: string | number
  accent?: Accent
  isActive: boolean
  onClick: () => void
  ariaLabel: string
}

const ringClassByAccent: Record<Accent, { focus: string; active: string }> = {
  green: { focus: 'focus-visible:ring-green-500', active: 'ring-green-500' },
  red: { focus: 'focus-visible:ring-red-500', active: 'ring-red-500' },
  blue: { focus: 'focus-visible:ring-blue-500', active: 'ring-blue-500' },
  yellow: { focus: 'focus-visible:ring-yellow-500', active: 'ring-yellow-500' },
  purple: { focus: 'focus-visible:ring-purple-500', active: 'ring-purple-500' },
  gray: { focus: 'focus-visible:ring-slate-500', active: 'ring-slate-500' },
  default: { focus: 'focus-visible:ring-blue-500', active: 'ring-blue-500' },
}

export default function ActionableStatCard({
  title,
  value,
  accent = 'default',
  isActive,
  onClick,
  ariaLabel,
}: ActionableStatCardProps) {
  const ringClasses = ringClassByAccent[accent]

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${ringClasses.focus} ${isActive ? `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 ${ringClasses.active}` : ''}`}
      aria-pressed={isActive}
      aria-label={ariaLabel}
    >
      <StatCard title={title} value={value} accent={accent} />
    </button>
  )
}
