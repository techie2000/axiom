import { ReactNode } from 'react'

interface SortableHeaderCellProps {
  label: ReactNode
  className?: string
  align?: 'left' | 'center'
  sortable?: boolean
  onSort?: () => void
  isActiveSort?: boolean
  sortDirection?: 'asc' | 'desc'
}

export default function SortableHeaderCell({
  label,
  className = '',
  align = 'left',
  sortable = true,
  onSort,
  isActiveSort = false,
  sortDirection = 'asc',
}: SortableHeaderCellProps) {
  const alignClass = align === 'center' ? 'text-center' : 'text-left'
  const ariaSort = isActiveSort ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'

  if (!sortable || !onSort) {
    return (
      <th className={`${alignClass} ${className}`}>
        {label}
      </th>
    )
  }

  return (
    <th className={`${alignClass} ${className}`} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={onSort}
        className={`group flex items-center gap-1 cursor-pointer whitespace-nowrap hover:text-gray-700 dark:hover:text-gray-200 transition-colors ${align === 'center' ? 'w-full justify-center' : ''}`}
      >
        {label}
        <span className={`${isActiveSort ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`}>
          {isActiveSort ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  )
}
