'use client'

import ThemedSelect from './ThemedSelect'

interface TablePaginationControlsProps {
  currentPage: number
  isFirstPage: boolean
  isLastPage: boolean
  onPrevious: () => void
  onNext: () => void
  pageSize?: number
  pageSizeOptions?: number[]
  onPageSizeChange?: (nextSize: number) => void
  pageLabel: string
  itemsPerPageLabel?: string
  previousLabel: string
  nextLabel: string
  className?: string
}

export default function TablePaginationControls({
  currentPage,
  isFirstPage,
  isLastPage,
  onPrevious,
  onNext,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  pageLabel,
  itemsPerPageLabel,
  previousLabel,
  nextLabel,
  className = '',
}: TablePaginationControlsProps) {
  const showPageSizeControls =
    typeof pageSize === 'number' &&
    Array.isArray(pageSizeOptions) &&
    pageSizeOptions.length > 0 &&
    typeof onPageSizeChange === 'function' &&
    typeof itemsPerPageLabel === 'string'

  return (
    <div className={`flex justify-between items-center flex-wrap gap-4 ${className}`.trim()}>
      <button
        onClick={onPrevious}
        disabled={isFirstPage}
        className="px-4 py-2 rounded-lg theme-btn-primary theme-focus disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {previousLabel}
      </button>

      <div className="flex items-center gap-4">
        <span className="theme-text-muted">{pageLabel}</span>
        {showPageSizeControls && (
          <div className="flex items-center gap-2">
            <label className="text-sm theme-text-muted">{itemsPerPageLabel}</label>
            <ThemedSelect
              value={String(pageSize)}
              onChange={(next) => onPageSizeChange(Number(next))}
              ariaLabel={itemsPerPageLabel}
              className="min-w-[5.5rem]"
              buttonClassName="px-3 py-1 text-sm"
              options={pageSizeOptions.map((size) => ({ value: String(size), label: String(size) }))}
            />
          </div>
        )}
      </div>

      <button
        onClick={onNext}
        disabled={isLastPage}
        className="px-4 py-2 rounded-lg theme-btn-primary theme-focus disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {nextLabel}
      </button>
    </div>
  )
}
