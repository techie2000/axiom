'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatStatusLabel } from '../lib/status-label'

interface LEIStatus {
  status: string
  job_type: string
  total_records?: number
  processed_records?: number
  failed_records?: number
  error_message?: string
  current_source_file?: {
    total_records?: number
  }
}

export default function LEIStatusCard() {
  const [fullStatus, setFullStatus] = useState<LEIStatus | null>(null)
  const [deltaStatus, setDeltaStatus] = useState<LEIStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
        
        const [fullRes, deltaRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/lei/status/DAILY_FULL`, { cache: 'no-store' }),
          fetch(`${API_URL}/api/v1/lei/status/DAILY_DELTA`, { cache: 'no-store' })
        ])

        if (fullRes.ok) {
          const full = await fullRes.json()
          setFullStatus(full)
        }
        if (deltaRes.ok) {
          const delta = await deltaRes.json()
          setDeltaStatus(delta)
        }
      } catch (error) {
        console.error('Failed to fetch LEI status:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 5000) // Refresh every 5 seconds

    return () => clearInterval(interval)
  }, [])

  const getHealthIndicator = (status: LEIStatus | null) => {
    if (!status) return { color: 'bg-gray-400', label: 'Unknown', icon: '❓' }
    
    switch (status.status) {
      case 'RUNNING':
        return { color: 'bg-blue-500 animate-pulse', label: 'Running', icon: '⏳' }
      case 'COMPLETED':
        return { color: 'bg-green-500', label: 'Completed', icon: '✅' }
      case 'FAILED':
        return { color: 'bg-red-500', label: 'Failed', icon: '❌' }
      case 'IDLE':
        return { color: 'bg-gray-400', label: 'Idle', icon: '⏸️' }
      default:
        return { color: 'bg-gray-400', label: formatStatusLabel(status.status), icon: '❓' }
    }
  }

  const formatNumber = (num?: number) => {
    if (!num) return '0'
    return num.toLocaleString()
  }

  const getProgress = (status: LEIStatus | null) => {
    if (!status?.total_records || !status?.processed_records) return 0
    return Math.min(100, (status.processed_records / status.total_records) * 100)
  }

  const getOverallStatus = () => {
    // Prioritize FAILED > RUNNING > IDLE > COMPLETED
    if (fullStatus?.status === 'FAILED' || deltaStatus?.status === 'FAILED') return 'Failed'
    if (fullStatus?.status === 'RUNNING' || deltaStatus?.status === 'RUNNING') return 'Running'
    if (fullStatus?.status === 'IDLE' || deltaStatus?.status === 'IDLE') return 'Idle'
    return 'Completed'
  }

  const getOverallIcon = () => {
    const overallStatus = getOverallStatus()

    switch (overallStatus) {
      case 'Running':
        return '⏳'
      case 'Failed':
        return '❌'
      case 'Idle':
        return '⏸️'
      default:
        return '✅'
    }
  }

  const fullHealth = getHealthIndicator(fullStatus)
  const deltaHealth = getHealthIndicator(deltaStatus)
  const totalRecords = fullStatus?.current_source_file?.total_records || 0

  return (
    <Link href="/lei" className="group bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all p-6 hover:border-purple-500 dark:hover:border-purple-400 min-h-[240px] flex flex-col">
      <div className="flex items-stretch justify-between flex-1">
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-purple-500 dark:group-hover:text-purple-400">
              LEI Status →
            </h3>
            {!loading && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1" title={`Full Sync: ${fullHealth.label}`}>
                  <div className={`w-3 h-3 rounded-full ${fullHealth.color}`}></div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Full</span>
                </div>
                <div className="flex items-center gap-1" title={`Delta Sync: ${deltaHealth.label}`}>
                  <div className={`w-3 h-3 rounded-full ${deltaHealth.color}`}></div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Delta</span>
                </div>
              </div>
            )}
          </div>
          
          <p className="text-gray-600 dark:text-gray-300 flex-1 mb-4">
            Monitor GLEIF data synchronization in real-time
          </p>

          {loading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Loading status...
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              <div className="text-sm">
                <span className="text-gray-600 dark:text-gray-400">Total Records: </span>
                <span className="font-semibold text-gray-900 dark:text-white">{formatNumber(totalRecords)}</span>
              </div>
              
              {fullStatus?.status === 'RUNNING' && fullStatus.total_records && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                    <span>Processing Full Sync</span>
                    <span>{getProgress(fullStatus).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div 
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${getProgress(fullStatus)}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {fullStatus?.error_message && (
                <div className="text-xs text-red-600 dark:text-red-400 break-words whitespace-normal overflow-hidden" title={fullStatus.error_message}>
                  {fullStatus.error_message}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-auto">
            <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs rounded">
              {getOverallStatus()}
            </span>
            <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs rounded">Real-time</span>
          </div>
        </div>
        <span className="text-3xl ml-4 shrink-0">{getOverallIcon()}</span>
      </div>
    </Link>
  )
}
