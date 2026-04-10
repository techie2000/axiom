'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Currency {
  id: string
}

export default function CurrenciesRecordsCard() {
  const [totalRecords, setTotalRecords] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRecordCount = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
        const response = await fetch(`${API_URL}/api/v1/currencies`, { cache: 'no-store' })

        if (response.ok) {
          const data: Currency[] = await response.json()
          setTotalRecords(Array.isArray(data) ? data.length : 0)
        }
      } catch (error) {
        console.error('Failed to fetch currencies count:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRecordCount()
    const interval = setInterval(fetchRecordCount, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Link href="/currencies" className="group theme-panel theme-card-hover border-2 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all p-6 min-h-[240px] flex flex-col">
      <div className="flex items-stretch justify-between flex-1">
        <div className="flex flex-col flex-1 min-w-0">
          <h3 className="text-xl font-semibold mb-2 theme-card-title">
            Currencies →
          </h3>
          <p className="theme-text-muted flex-1 mb-4">
            Browse ISO 4217 currency codes and symbols
          </p>

          {loading ? (
            <div className="text-sm theme-text-muted mb-3">Loading...</div>
          ) : (
            <div className="mb-3 text-sm">
              <span className="theme-text-muted">Total Records: </span>
              <span className="font-semibold">{totalRecords.toLocaleString()}</span>
            </div>
          )}

          <div className="flex gap-2 mt-auto">
            <span className="px-2 py-1 theme-subtle text-xs rounded">ISO 4217</span>
            <span className="px-2 py-1 theme-subtle text-xs rounded">Public</span>
          </div>
        </div>
        <span className="text-3xl ml-4 shrink-0">💱</span>
      </div>
    </Link>
  )
}
