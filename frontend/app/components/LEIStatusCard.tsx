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
  const [masterDataStatus, setMasterDataStatus] = useState<LEIStatus | null>(null)
  const [fullStatus, setFullStatus] = useState<LEIStatus | null>(null)
  const [deltaStatus, setDeltaStatus] = useState<LEIStatus | null>(null)
  const [rrStatus, setRrStatus] = useState<LEIStatus | null>(null)
  const [repexStatus, setRepexStatus] = useState<LEIStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
        
        const [mdRes, fullRes, deltaRes, rrRes, repexRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/lei/status/MASTER_DATA_SYNC`, { cache: 'no-store' }),
          fetch(`${API_URL}/api/v1/lei/status/DAILY_FULL`, { cache: 'no-store' }),
          fetch(`${API_URL}/api/v1/lei/status/DAILY_DELTA`, { cache: 'no-store' }),
          fetch(`${API_URL}/api/v1/lei/status/LEVEL2_RR`, { cache: 'no-store' }),
          fetch(`${API_URL}/api/v1/lei/status/LEVEL2_REPEX`, { cache: 'no-store' }),
        ])

        if (mdRes.ok) setMasterDataStatus(await mdRes.json())
        if (fullRes.ok) setFullStatus(await fullRes.json())
        if (deltaRes.ok) setDeltaStatus(await deltaRes.json())
        if (rrRes.ok) setRrStatus(await rrRes.json())
        if (repexRes.ok) setRepexStatus(await repexRes.json())
      } catch (error) {
        console.error('Failed to fetch LEI status:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)

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
    // Prioritize FAILED > RUNNING > IDLE > COMPLETED (across all jobs)
    const all = [masterDataStatus, fullStatus, deltaStatus, rrStatus, repexStatus]
    if (all.some(s => s?.status === 'FAILED')) return 'Failed'
    if (all.some(s => s?.status === 'RUNNING')) return 'Running'
    if (all.some(s => s?.status === 'IDLE')) return 'Idle'
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
  const rrHealth = getHealthIndicator(rrStatus)
  const repexHealth = getHealthIndicator(repexStatus)
  const masterDataHealth = getHealthIndicator(masterDataStatus)
  const totalRecords = fullStatus?.current_source_file?.total_records || 0

  return (
    <Link href="/lei" className="group theme-panel theme-card-hover border-2 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all p-6 min-h-[240px] flex flex-col">
      <div className="flex items-stretch justify-between flex-1">
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-semibold theme-card-title">
              LEI Status →
            </h3>
            {!loading && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1" title={`Ref Data Sync: ${masterDataHealth.label}`}>
                  <div className={`w-3 h-3 rounded-full ${masterDataHealth.color}`}></div>
                  <span className="text-xs theme-text-muted">RefData</span>
                </div>
                <div className="flex items-center gap-1" title={`Level 1 Full Sync: ${fullHealth.label}`}>
                  <div className={`w-3 h-3 rounded-full ${fullHealth.color}`}></div>
                  <span className="text-xs theme-text-muted">L1-Full</span>
                </div>
                <div className="flex items-center gap-1" title={`Level 1 Delta Sync: ${deltaHealth.label}`}>
                  <div className={`w-3 h-3 rounded-full ${deltaHealth.color}`}></div>
                  <span className="text-xs theme-text-muted">L1-Delta</span>
                </div>
                <div className="flex items-center gap-1" title={`Level 2 RR: ${rrHealth.label}`}>
                  <div className={`w-3 h-3 rounded-full ${rrHealth.color}`}></div>
                  <span className="text-xs theme-text-muted">L2-RR</span>
                </div>
                <div className="flex items-center gap-1" title={`Level 2 REPEX: ${repexHealth.label}`}>
                  <div className={`w-3 h-3 rounded-full ${repexHealth.color}`}></div>
                  <span className="text-xs theme-text-muted">L2-REPEX</span>
                </div>
              </div>
            )}
          </div>
          
          <p className="theme-text-muted flex-1 mb-4">
            Monitor GLEIF data synchronization in real-time
          </p>

          {loading ? (
            <div className="text-sm theme-text-muted mb-3">
              Loading status...
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              <div className="text-sm">
                <span className="theme-text-muted">Total Records: </span>
                <span className="font-semibold">{formatNumber(totalRecords)}</span>
              </div>
              
              {fullStatus?.status === 'RUNNING' && fullStatus.total_records && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs theme-text-muted">
                    <span>Processing L1 Full Sync</span>
                    <span>{getProgress(fullStatus).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-[rgb(var(--surface-muted-rgb))] rounded-full h-1.5">
                    <div 
                      className="bg-[rgb(var(--primary-rgb))] h-1.5 rounded-full transition-all duration-500"
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
            <span className="px-2 py-1 theme-subtle text-xs rounded">
              {getOverallStatus()}
            </span>
            <span className="px-2 py-1 theme-subtle text-xs rounded">Real-time</span>
          </div>
        </div>
        <span className="text-3xl ml-4 shrink-0">{getOverallIcon()}</span>
      </div>
    </Link>
  )
}
