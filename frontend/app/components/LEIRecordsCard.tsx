'use client'

import Link from 'next/link'
import { useCachedLeiCount } from '../lib/useCachedLeiCount'

export default function LEIRecordsCard() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
  const { count: totalRecords, loading } = useCachedLeiCount(apiUrl, { pollMs: 30000 })

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  return (
    <Link href="/lei-records" className="group theme-panel theme-card-hover border-2 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all p-6 min-h-[240px] flex flex-col">
      <div className="flex items-stretch justify-between flex-1">
        <div className="flex flex-col flex-1 min-w-0">
          <h3 className="text-xl font-semibold mb-2 theme-card-title">
            LEI Records →
          </h3>
          <p className="theme-text-muted flex-1 mb-4">
            Browse ISO 17442 GLEIF Legal Entity Identifiers
          </p>

          {loading ? (
            <div className="text-sm theme-text-muted mb-3">
              Loading...
            </div>
          ) : (
            <div className="mb-3">
              <div className="text-sm">
                <span className="theme-text-muted">Total Records: </span>
                <span className="font-semibold">{totalRecords !== null ? formatNumber(totalRecords) : '—'}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-auto">
            <span className="px-2 py-1 theme-subtle text-xs rounded">ISO 17442</span>
            <span className="px-2 py-1 theme-subtle text-xs rounded">Public</span>
          </div>
        </div>
        <span className="text-3xl ml-4 shrink-0">🏛️</span>
      </div>
    </Link>
  )
}
