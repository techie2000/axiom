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
    <Link href="/currencies" className="group bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all p-6 hover:border-green-500 dark:hover:border-green-400 min-h-[240px] flex flex-col">
      <div className="flex items-stretch justify-between flex-1">
        <div className="flex flex-col flex-1 min-w-0">
          <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white group-hover:text-green-500 dark:group-hover:text-green-400">
            Currencies →
          </h3>
          <p className="text-gray-600 dark:text-gray-300 flex-1 mb-4">
            Browse ISO 4217 currency codes and symbols
          </p>

          {loading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">Loading...</div>
          ) : (
            <div className="mb-3 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Total Records: </span>
              <span className="font-semibold text-gray-900 dark:text-white">{totalRecords.toLocaleString()}</span>
            </div>
          )}

          <div className="flex gap-2 mt-auto">
            <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs rounded">ISO 4217</span>
            <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs rounded">Public</span>
          </div>
        </div>
        <span className="text-3xl ml-4 shrink-0">💱</span>
      </div>
    </Link>
  )
}
