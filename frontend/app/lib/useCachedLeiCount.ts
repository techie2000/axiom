'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface DailyFullStatus {
  last_success_at?: string | null
}

export interface CachedLeiCount {
  count: number
  lastSuccessAt: string | null
}

const COUNT_CACHE_KEY = 'lei_count_cache'

export function readCachedLeiCount(): CachedLeiCount | null {
  try {
    const raw = sessionStorage.getItem(COUNT_CACHE_KEY)
    return raw ? (JSON.parse(raw) as CachedLeiCount) : null
  } catch {
    return null
  }
}

export function writeCachedLeiCount(count: number, lastSuccessAt: string | null) {
  try {
    sessionStorage.setItem(COUNT_CACHE_KEY, JSON.stringify({ count, lastSuccessAt }))
  } catch {
    // sessionStorage unavailable
  }
}

interface UseCachedLeiCountOptions {
  pollMs?: number
}

export function useCachedLeiCount(
  apiBaseUrl: string,
  options: UseCachedLeiCountOptions = {}
) {
  const { pollMs = 30000 } = options
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const countFetchedForRef = useRef<string | null | undefined>(undefined)
  const isMountedRef = useRef(true)

  const applyCount = useCallback((nextCount: number, lastSuccessAt: string | null) => {
    if (!isMountedRef.current) {
      return
    }

    setCount(nextCount)
    writeCachedLeiCount(nextCount, lastSuccessAt)
    countFetchedForRef.current = lastSuccessAt
  }, [])

  const fetchCountIfStale = useCallback(async (lastSuccessAt: string | null | undefined) => {
    if (lastSuccessAt === undefined) {
      return
    }

    if (countFetchedForRef.current === lastSuccessAt) {
      return
    }

    const cached = readCachedLeiCount()
    if (cached && cached.lastSuccessAt === lastSuccessAt) {
      if (isMountedRef.current) {
        setCount(cached.count)
      }
      countFetchedForRef.current = lastSuccessAt
      return
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/lei/count`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`Unexpected count status: ${response.status}`)
      }

      const data = (await response.json()) as { count?: number }
      applyCount(data.count ?? 0, lastSuccessAt ?? null)
    } catch {
      if (cached && isMountedRef.current) {
        setCount(cached.count)
        countFetchedForRef.current = cached.lastSuccessAt
      }
    }
  }, [apiBaseUrl, applyCount])

  useEffect(() => {
    isMountedRef.current = true

    const cached = readCachedLeiCount()
    if (cached) {
      setCount(cached.count)
      countFetchedForRef.current = cached.lastSuccessAt
      setLoading(false)
    }

    const fetchCachedCount = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/lei/status/DAILY_FULL`, { cache: 'no-store' })
        if (!response.ok) {
          await fetchCountIfStale(null)
          return
        }

        const status = (await response.json()) as DailyFullStatus
        await fetchCountIfStale(status.last_success_at ?? null)
      } catch {
        await fetchCountIfStale(null)
      } finally {
        if (isMountedRef.current) {
          setLoading(false)
        }
      }
    }

    fetchCachedCount()
    const interval = setInterval(fetchCachedCount, pollMs)

    return () => {
      isMountedRef.current = false
      clearInterval(interval)
    }
  }, [apiBaseUrl, fetchCountIfStale, pollMs])

  return { count, loading }
}