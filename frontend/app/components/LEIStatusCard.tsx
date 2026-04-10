'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { formatStatusLabel } from '../lib/status-label'

interface LEIStatus {
  status: string
  job_type: string
  last_success_at?: string | null
  total_records?: number
  processed_records?: number
  failed_records?: number
  error_message?: string
  progress_message?: string
  current_source_file?: {
    total_records?: number
  }
}

interface GleifSyncStats {
  total_records?: number
}

interface LEICountCache {
  count: number
  lastSuccessAt: string | null
}

const COUNT_CACHE_KEY = 'lei_count_cache'

function readCountCache(): LEICountCache | null {
  try {
    const raw = sessionStorage.getItem(COUNT_CACHE_KEY)
    return raw ? (JSON.parse(raw) as LEICountCache) : null
  } catch {
    return null
  }
}

function writeCountCache(count: number, lastSuccessAt: string | null) {
  try {
    sessionStorage.setItem(COUNT_CACHE_KEY, JSON.stringify({ count, lastSuccessAt }))
  } catch {
    // sessionStorage unavailable
  }
}

const resolveStatusTotal = (status: LEIStatus | null): number => {
  if (!status) return 0
  return status.current_source_file?.total_records ?? status.total_records ?? 0
}

export default function LEIStatusCard() {
  const [masterDataStatus, setMasterDataStatus] = useState<LEIStatus | null>(null)
  const [fullStatus, setFullStatus] = useState<LEIStatus | null>(null)
  const [deltaStatus, setDeltaStatus] = useState<LEIStatus | null>(null)
  const [rrStatus, setRrStatus] = useState<LEIStatus | null>(null)
  const [repexStatus, setRepexStatus] = useState<LEIStatus | null>(null)
  const [gleifStatus, setGleifStatus] = useState<LEIStatus | null>(null)
  const [leiEntityCount, setLeiEntityCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  // Track which last_success_at we last fetched the count for
  const countFetchedForRef = useRef<string | null | undefined>(undefined)

  // Fetch count only when the full sync has a new completion timestamp
  const fetchCountIfStale = async (lastSuccessAt: string | null | undefined) => {
    // undefined means we haven't checked yet; skip if already fetched for this timestamp
    if (lastSuccessAt === undefined) return
    if (countFetchedForRef.current === lastSuccessAt) return

    const cached = readCountCache()
    if (cached && cached.lastSuccessAt === lastSuccessAt) {
      setLeiEntityCount(cached.count)
      countFetchedForRef.current = lastSuccessAt
      return
    }

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
      const res = await fetch(`${API_URL}/api/v1/lei/count`, { cache: 'no-store' })
      if (res.ok) {
        const { count } = (await res.json()) as { count: number }
        setLeiEntityCount(count)
        writeCountCache(count, lastSuccessAt)
        countFetchedForRef.current = lastSuccessAt
      }
    } catch {
      // If fetch fails, surface any cached value so the card isn't blank
      if (cached) {
        setLeiEntityCount(cached.count)
        countFetchedForRef.current = cached.lastSuccessAt
      }
    }
  }

  useEffect(() => {
    // Seed from sessionStorage immediately so the card isn't blank on first paint
    const cached = readCountCache()
    if (cached) {
      setLeiEntityCount(cached.count)
      countFetchedForRef.current = cached.lastSuccessAt
    }

    const fetchStatus = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

        const [mdRes, fullRes, deltaRes, rrRes, repexRes, gleifRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/lei/status/MASTER_DATA_SYNC`, { cache: 'no-store' }),
          fetch(`${API_URL}/api/v1/lei/status/DAILY_FULL`, { cache: 'no-store' }),
          fetch(`${API_URL}/api/v1/lei/status/DAILY_DELTA`, { cache: 'no-store' }),
          fetch(`${API_URL}/api/v1/lei/status/LEVEL2_RR`, { cache: 'no-store' }),
          fetch(`${API_URL}/api/v1/lei/status/LEVEL2_REPEX`, { cache: 'no-store' }),
          fetch(`${API_URL}/api/v1/lei/status/GLEIF_REFERENCE_SYNC`, { cache: 'no-store' }),
        ])

        if (mdRes.ok) setMasterDataStatus(await mdRes.json())
        if (fullRes.ok) {
          const fullData: LEIStatus = await fullRes.json()
          setFullStatus(fullData)
          // Trigger a count fetch only when last_success_at has advanced
          await fetchCountIfStale(fullData.last_success_at ?? null)
        } else {
          // No full status yet — still try to load the count once
          await fetchCountIfStale(null)
        }
        if (deltaRes.ok) setDeltaStatus(await deltaRes.json())
        if (rrRes.ok) setRrStatus(await rrRes.json())
        if (repexRes.ok) setRepexStatus(await repexRes.json())
        if (gleifRes.ok) setGleifStatus(await gleifRes.json())
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
  let gleifStats: GleifSyncStats | null = null
  const gleifProgressMessage = gleifStatus?.progress_message?.trim() || ''
  if (gleifProgressMessage.startsWith('{')) {
    try {
      gleifStats = JSON.parse(gleifProgressMessage) as GleifSyncStats
    } catch {
      gleifStats = null
    }
  }
  const gleifTotalRecords = gleifStats?.total_records ?? resolveStatusTotal(gleifStatus)
  const l2RrRecords = resolveStatusTotal(rrStatus)
  const l2RepexRecords = resolveStatusTotal(repexStatus)
  const l2AssociatedRecords = l2RrRecords + l2RepexRecords

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
                <div className="flex items-center gap-1" title={`Level 2 Relationship Records: ${rrHealth.label}`}>
                  <div className={`w-3 h-3 rounded-full ${rrHealth.color}`}></div>
                  <span className="text-xs theme-text-muted">Relations</span>
                </div>
                <div className="flex items-center gap-1" title={`Level 2 Reporting Exceptions: ${repexHealth.label}`}>
                  <div className={`w-3 h-3 rounded-full ${repexHealth.color}`}></div>
                  <span className="text-xs theme-text-muted">Exceptions</span>
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
                <span className="theme-text-muted">LEI Records: </span>
                <span className="font-semibold">{leiEntityCount !== null ? formatNumber(leiEntityCount) : '—'}</span>
              </div>
              <div className="text-sm">
                <span className="theme-text-muted">Associated Records (L2): </span>
                <span className="font-semibold">{formatNumber(l2AssociatedRecords)}</span>
              </div>
              <div className="text-sm">
                <span className="theme-text-muted">GLEIF Reference Records: </span>
                <span className="font-semibold">{formatNumber(gleifTotalRecords)}</span>
              </div>
              <div className="text-xs theme-text-muted">
                Level 2 breakdown: Relationship Records {formatNumber(l2RrRecords)} | Reporting Exceptions {formatNumber(l2RepexRecords)}
              </div>
              <div className="text-xs theme-text-muted break-all">
                Last Snapshot Folder: data/main/lei/gleif-reference
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
