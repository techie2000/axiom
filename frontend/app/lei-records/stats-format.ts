export type TranslateFn = (key: string, options?: Record<string, unknown>) => string

interface CurrentPageStatInput {
  hasActiveFilters: boolean
  currentPage: number
  totalPages: number
  t: TranslateFn
}

/**
 * Format the LEI current-page stat card value without duplicating page numbers.
 */
export function formatCurrentPageStatValue({
  hasActiveFilters,
  currentPage,
  totalPages,
  t,
}: CurrentPageStatInput): string {
  if (hasActiveFilters) {
    return t('leiRecords.stats.currentPageFiltered', { page: currentPage })
  }

  return t('leiRecords.stats.currentPageOf', {
    page: currentPage,
    total: totalPages.toLocaleString(),
  })
}
