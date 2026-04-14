export const FAST_LEI_REFRESH_MS = 5000
export const SLOW_LEI_REFRESH_MS = 60000
const MASTER_DATA_COUNTS_CACHE_KEY = 'lei_master_data_counts_cache'

type RefreshStatus = {
  status?: string | null
}

export interface MasterDataCounts {
  countries: number
  currencies: number
  languages: number
  total: number
}

export interface MasterDataCountsCache {
  counts: MasterDataCounts
  lastSuccessAt: string | null
}

export function getLeiAutoRefreshIntervalMs(
  statuses: Array<RefreshStatus | null | undefined>,
): number {
  const hasRunningJob = statuses.some((status) => status?.status === 'RUNNING')
  return hasRunningJob ? FAST_LEI_REFRESH_MS : SLOW_LEI_REFRESH_MS
}

export function readCachedMasterDataCounts(): MasterDataCountsCache | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = sessionStorage.getItem(MASTER_DATA_COUNTS_CACHE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as MasterDataCountsCache
    if (!parsed?.counts || typeof parsed.counts.total !== 'number') {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function writeCachedMasterDataCounts(
  counts: MasterDataCounts,
  lastSuccessAt: string | null,
): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const payload: MasterDataCountsCache = { counts, lastSuccessAt }
    sessionStorage.setItem(MASTER_DATA_COUNTS_CACHE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore storage failures to keep UI resilient.
  }
}

export function shouldRefreshMasterDataCounts(
  lastSuccessAt: string | null,
  cached: MasterDataCountsCache | null,
): boolean {
  if (!cached) {
    return true
  }

  return cached.lastSuccessAt !== lastSuccessAt
}
