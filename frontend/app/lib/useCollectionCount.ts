'use client'

import { useEffect, useState } from 'react'
import { getApiBaseUrl } from './api-base'

export function useCollectionCount(endpoint: string, pollMs: number = 30000) {
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)

    const fetchCount = async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}${endpoint}`, { cache: 'no-store' })

        if (response.ok) {
          const data = await response.json()
          setCount(Array.isArray(data) ? data.length : 0)
        } else {
          setCount(null)
        }
      } catch (error) {
        console.error(`Failed to fetch collection count for ${endpoint}:`, error)
        setCount(null)
      } finally {
        setLoading(false)
      }
    }

    fetchCount()
    const interval = setInterval(fetchCount, pollMs)
    return () => clearInterval(interval)
  }, [endpoint, pollMs])

  return { count, loading }
}