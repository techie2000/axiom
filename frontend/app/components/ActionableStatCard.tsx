import StatCard from './StatCard'

type Accent = 'green' | 'red' | 'blue' | 'yellow' | 'purple' | 'gray' | 'default'

interface ActionableStatCardProps {
  title: string
  value: string | number
  accent?: Accent
  titleTooltip?: string
  isActive: boolean
  onClick: () => void
  ariaLabel: string
}

const ringClassByAccent: Record<Accent, { focus: string; active: string }> = {
  green: { focus: 'focus-visible:ring-[rgb(var(--ring-rgb))]', active: 'ring-[rgb(var(--ring-rgb))]' },
  red: { focus: 'focus-visible:ring-[rgb(var(--ring-rgb))]', active: 'ring-[rgb(var(--ring-rgb))]' },
  blue: { focus: 'focus-visible:ring-[rgb(var(--ring-rgb))]', active: 'ring-[rgb(var(--ring-rgb))]' },
  yellow: { focus: 'focus-visible:ring-[rgb(var(--ring-rgb))]', active: 'ring-[rgb(var(--ring-rgb))]' },
  purple: { focus: 'focus-visible:ring-[rgb(var(--ring-rgb))]', active: 'ring-[rgb(var(--ring-rgb))]' },
  gray: { focus: 'focus-visible:ring-[rgb(var(--ring-rgb))]', active: 'ring-[rgb(var(--ring-rgb))]' },
  default: { focus: 'focus-visible:ring-[rgb(var(--ring-rgb))]', active: 'ring-[rgb(var(--ring-rgb))]' },
}

export default function ActionableStatCard({
  title,
  value,
  accent = 'default',
  titleTooltip,
  isActive,
  onClick,
  ariaLabel,
}: ActionableStatCardProps) {
  const ringClasses = ringClassByAccent[accent]

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--surface-rgb))] ${ringClasses.focus} ${isActive ? `ring-2 ring-offset-2 ring-offset-[rgb(var(--surface-rgb))] ${ringClasses.active}` : ''}`}
      aria-pressed={isActive}
      aria-label={ariaLabel}
    >
      <StatCard title={title} value={value} accent={accent} titleTooltip={titleTooltip} />
    </button>
  )
}
