'use client'

interface TablePaginationControlsProps {
  currentPage: number
  isFirstPage: boolean
  isLastPage: boolean
  onPrevious: () => void
  onNext: () => void
  pageSize: number
  pageSizeOptions: number[]
  onPageSizeChange: (nextSize: number) => void
  pageLabel: string
  itemsPerPageLabel: string
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
  return (
    <div className={`flex justify-between items-center flex-wrap gap-4 ${className}`.trim()}>
      <button
        onClick={onPrevious}
        disabled={isFirstPage}
        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white"
      >
        {previousLabel}
      </button>

      <div className="flex items-center gap-4">
        <span className="text-gray-700 dark:text-gray-300">{pageLabel}</span>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700 dark:text-gray-300">{itemsPerPageLabel}</label>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="px-3 py-1 rounded-lg bg-white border-2 border-gray-200 dark:bg-gray-800 dark:border-white/10 text-gray-900 dark:text-white text-sm focus:border-blue-500 focus:outline-none"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={isLastPage}
        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white"
      >
        {nextLabel}
      </button>
    </div>
  )
}
