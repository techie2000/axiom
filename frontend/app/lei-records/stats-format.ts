export type TranslateFn = (key: string, options?: Record<string, unknown>) => string

interface CurrentPageStatInput {
  hasActiveFilters: boolean
  currentPage: number
  totalPages: number
  t: TranslateFn
}

/**
 * Format the LEI current-page stat card value without duplicating page numbers.
 *
 * When totalPages is 0 the total is not yet known (status endpoint unavailable or
 * no completed full sync).  In that case:
 * - With active filters → show "N (filtered)" as usual.
 * - Without active filters → show just the page number ("N") so the card
 *   does not display a misleading "1 of 0" or a spurious "(filtered)" label.
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
    return t('leiRecords.stats.currentPageOnly', { page: currentPage })
  }

  return t('leiRecords.stats.currentPageOf', {
    page: currentPage,
    total: totalPages.toLocaleString(),
  })
}

/**
 * Compute the end value for the "Showing X-Y" stat card.
 *
 * When totalRecords > 0 we cap at totalRecords so the last page shows the
 * correct upper bound (e.g. "951-1000" not "951-1000").
 *
 * When totalRecords is 0 (status endpoint unavailable / no full sync yet) we
 * fall back to the actual page offset plus the number of records returned on
 * this page, which is always correct regardless of which page we are on:
 *   Page 1, 37 records → 37
 *   Page 3, 12 records → (3-1)*50 + 12 = 112
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
  // totalRecords unknown — derive end from page offset + actual records returned
  return (currentPage - 1) * itemsPerPage + recordsLength
}
