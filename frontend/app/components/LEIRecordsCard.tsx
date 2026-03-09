'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface LEIStatus {
  current_source_file?: {
    total_records?: number
  }
}

export default function LEIRecordsCard() {
  const [totalRecords, setTotalRecords] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRecordCount = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
        
        const response = await fetch(`${API_URL}/api/v1/lei/status/DAILY_FULL`, { cache: 'no-store' })

        if (response.ok) {
          const data: LEIStatus = await response.json()
          setTotalRecords(data.current_source_file?.total_records || 0)
        }
      } catch (error) {
        console.error('Failed to fetch LEI record count:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRecordCount()
    const interval = setInterval(fetchRecordCount, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  return (
    <Link href="/lei-records" className="group bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all p-6 hover:border-green-500 dark:hover:border-green-400 min-h-[240px] flex flex-col">
      <div className="flex items-stretch justify-between flex-1">
        <div className="flex flex-col flex-1 min-w-0">
          <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white group-hover:text-green-500 dark:group-hover:text-green-400">
            LEI Records →
          </h3>
          <p className="text-gray-600 dark:text-gray-300 flex-1 mb-4">
            Browse ISO 17442 GLEIF Legal Entity Identifiers
          </p>

          {loading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Loading...
            </div>
          ) : (
            <div className="mb-3">
              <div className="text-sm">
                <span className="text-gray-600 dark:text-gray-400">Total Records: </span>
                <span className="font-semibold text-gray-900 dark:text-white">{formatNumber(totalRecords)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-auto">
            <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs rounded">ISO 17442</span>
            <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs rounded">Public</span>
          </div>
        </div>
        <span className="text-3xl ml-4 shrink-0">🏛️</span>
      </div>
    </Link>
  )
}
