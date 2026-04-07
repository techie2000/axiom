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
        className={`group flex items-center gap-1 cursor-pointer whitespace-nowrap hover:text-[rgb(var(--muted-foreground-rgb))] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring-rgb))] focus-visible:ring-offset-1 rounded ${align === 'center' ? 'w-full justify-center' : ''}`}
      >
        {label}
        <span className={`${isActiveSort ? 'theme-sort-indicator' : 'theme-text-muted group-hover:opacity-90'}`}>
          {isActiveSort ? (
            sortDirection === 'asc' ? (
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10 4l5 6H5l5-6z" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10 16l-5-6h10l-5 6z" />
              </svg>
            )
          ) : (
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10 4l4 5H6l4-5z" />
              <path d="M10 16l-4-5h8l-4 5z" />
            </svg>
          )}
        </span>
      </button>
    </th>
  )
}
