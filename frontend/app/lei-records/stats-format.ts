export type TranslateFn = (key: string, options?: Record<string, unknown>) => string

interface CurrentPageStatInput {
  hasActiveFilters: boolean
  currentPage: number
  totalPages: number
  t: TranslateFn
}

/**
 * Format the LEI current-page stat card value without duplicating page numbers.
 * When totalPages is 0 the total is not yet known (status endpoint unavailable or
 * no completed full sync); in that case just show the current page number so the
 * card does not display a misleading "1 of 0".
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

  if (totalPages === 0) {
    return t('leiRecords.stats.currentPageFiltered', { page: currentPage })
  }

  return t('leiRecords.stats.currentPageOf', {
    page: currentPage,
    total: totalPages.toLocaleString(),
  })
}

/**
 * Compute the end value for the "Showing X-Y" stat card.
 * Falls back to recordsLength when totalRecords is 0 (status endpoint unavailable).
 */
export function computeShowingEnd(
  currentPage: number,
  itemsPerPage: number,
  totalRecords: number,
  recordsLength: number,
): number {
  const pageEnd = currentPage * itemsPerPage
  if (totalRecords > 0) {
    return Math.min(pageEnd, totalRecords)
  }
  return Math.min(pageEnd, recordsLength)
}
