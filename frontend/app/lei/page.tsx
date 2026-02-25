'use client'

import { useEffect, useState } from 'react'
import Alert from '../components/Alert'
import LoadingSpinner from '../components/LoadingSpinner'
import PageHeader from '../components/PageHeader'

interface SourceFile {
  id: string
  file_name: string
  processing_status: string
  total_records: number
  processed_records: number
  failed_records: number
  last_processed_lei: string
  failure_category: string
  processing_error: string
}

interface ProcessingStatus {
  id: string
  job_type: string
  status: string
  last_run_at: string | null
  next_run_at: string | null
  last_success_at: string | null
  depends_on_job_type: string
  current_source_file_id: string | null
  current_source_file: SourceFile | null
  error_message: string
}

export default function LEIStatusPage() {
  const [masterDataStatus, setMasterDataStatus] = useState<ProcessingStatus | null>(null)
  const [fullStatus, setFullStatus] = useState<ProcessingStatus | null>(null)
  const [deltaStatus, setDeltaStatus] = useState<ProcessingStatus | null>(null)
  const [rrStatus, setRrStatus] = useState<ProcessingStatus | null>(null)
  const [repexStatus, setRepexStatus] = useState<ProcessingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null)
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})

  const API_BASE_URL = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080')
    : 'http://backend:8080'

  const fetchStatus = async () => {
    try {
      const [mdResponse, fullResponse, deltaResponse, rrResponse, repexResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/lei/status/MASTER_DATA_SYNC`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/lei/status/DAILY_FULL`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/lei/status/DAILY_DELTA`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/lei/status/LEVEL2_RR`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/lei/status/LEVEL2_REPEX`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
      ])

      if (mdResponse?.ok) setMasterDataStatus(await mdResponse.json())
      if (fullResponse?.ok) setFullStatus(await fullResponse.json())
      if (deltaResponse?.ok) setDeltaStatus(await deltaResponse.json())
      if (rrResponse?.ok) setRrStatus(await rrResponse.json())
      if (repexResponse?.ok) setRepexStatus(await repexResponse.json())

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status')
    } finally {
      setLoading(false)
    }
  }

  const triggerLevel2Sync = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('jwt') || localStorage.getItem('authToken')
      const response = await fetch(`${API_BASE_URL}/api/v1/lei/sync/level2`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      })
      if (response.ok) {
        const data = await response.json()
        setTriggerMessage(data.message || 'Level 2 sync triggered')
        setTimeout(() => setTriggerMessage(null), 5000)
        fetchStatus()
      } else {
        let backendMessage = 'Failed to trigger Level 2 sync'
        try {
          const errorData = await response.json()
          if (errorData?.error && typeof errorData.error === 'string') {
            backendMessage = errorData.error
          }
        } catch {
          backendMessage = response.status === 401 || response.status === 403
            ? 'Failed to trigger Level 2 sync — check authentication'
            : 'Failed to trigger Level 2 sync'
        }

        setTriggerMessage(backendMessage)
        setTimeout(() => setTriggerMessage(null), 5000)
      }
    } catch (err) {
      setTriggerMessage(err instanceof Error ? err.message : 'Failed to trigger Level 2 sync')
      setTimeout(() => setTriggerMessage(null), 5000)
    }
  }

  const triggerJob = async (endpoint: string, successMessage: string) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('jwt') || localStorage.getItem('authToken')
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (response.ok) {
        const data = await response.json()
        setTriggerMessage(data.message || successMessage)
        setTimeout(() => setTriggerMessage(null), 5000)
        fetchStatus()
        return
      }

      let backendMessage = 'Failed to trigger job'
      try {
        const errorData = await response.json()
        if (errorData?.error && typeof errorData.error === 'string') {
          backendMessage = errorData.error
        }
      } catch {
        backendMessage = response.status === 401 || response.status === 403
          ? 'Failed to trigger job — check authentication'
          : 'Failed to trigger job'
      }
      setTriggerMessage(backendMessage)
      setTimeout(() => setTriggerMessage(null), 5000)
    } catch (err) {
      setTriggerMessage(err instanceof Error ? err.message : 'Failed to trigger job')
      setTimeout(() => setTriggerMessage(null), 5000)
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchStatus()
    }
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  const formatDate = (dateString: string | null) => {
    if (!dateString || dateString.startsWith('0001-')) return 'Never'
    return new Date(dateString).toISOString().replace('T', ' ').substring(0, 19)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700'
      case 'FAILED':
        return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700'
      case 'IDLE':
        return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
    }
  }

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'bg-blue-500 animate-pulse'
      case 'COMPLETED': return 'bg-green-500'
      case 'FAILED': return 'bg-red-500'
      case 'IDLE': return 'bg-gray-400'
      default: return 'bg-gray-400'
    }
  }

  const getJobDisplayName = (jobType: string): string => {
    switch (jobType) {
      case 'MASTER_DATA_SYNC':
        return 'Reference Data (MASTER_DATA_SYNC)'
      case 'DAILY_FULL':
        return 'Level 1 — LEI Records (DAILY_FULL)'
      case 'DAILY_DELTA':
        return 'Level 1 — LEI Records Delta (DAILY_DELTA)'
      case 'LEVEL2_RR':
        return 'Level 2 — Relationship Records (LEVEL2_RR)'
      case 'LEVEL2_REPEX':
        return 'Level 2 — Reporting Exceptions (LEVEL2_REPEX)'
      default:
        return jobType
    }
  }

  const getCardId = (jobType: string): string => `card-${jobType.toLowerCase()}`

  const calculateProgress = (status: ProcessingStatus | null): number => {
    if (!status?.current_source_file) return 0
    const file = status.current_source_file
    const processed = file.processed_records || 0
    const total = file.total_records || 0
    return total > 0 ? (processed / total) * 100 : 0
  }

  const getFrequencyLabel = (status: ProcessingStatus | null): string => {
    if (!status) return ''
    if (status.job_type === 'MASTER_DATA_SYNC') return 'Daily (01:00)'
    if (status.job_type === 'DAILY_FULL') return 'Daily'
    if (status.job_type === 'DAILY_DELTA') return 'Hourly'
    if (status.job_type === 'LEVEL2_RR' || status.job_type === 'LEVEL2_REPEX') return 'On-demand / chained'
    return ''
  }

  // For chained jobs (LEVEL2_RR, LEVEL2_REPEX) that have no fixed next_run_at, walk up the
  // dependency chain to find the earliest possible run time from the ultimate parent's schedule.
  const getChainedNextRun = (status: ProcessingStatus | null): { nextRun: string | null; ultimateParent: string | null } => {
    if (!status) return { nextRun: null, ultimateParent: null }

    if (status.next_run_at && !status.next_run_at.startsWith('0001-')) {
      return { nextRun: status.next_run_at, ultimateParent: null }
    }

    const dep = status.depends_on_job_type
    if (!dep || dep === 'NONE') return { nextRun: null, ultimateParent: null }

    const statusByType: Record<string, ProcessingStatus | null> = {
      MASTER_DATA_SYNC: masterDataStatus,
      DAILY_FULL: fullStatus,
      DAILY_DELTA: deltaStatus,
      LEVEL2_RR: rrStatus,
      LEVEL2_REPEX: repexStatus,
    }

    const visited = new Set<string>()
    let currentDep: string | null = dep
    let ultimateParent = dep

    while (currentDep) {
      if (visited.has(currentDep)) break
      visited.add(currentDep)

      const parentSt: ProcessingStatus | null = statusByType[currentDep] ?? null
      if (!parentSt) break

      if (parentSt.next_run_at && !parentSt.next_run_at.startsWith('0001-')) {
        return { nextRun: parentSt.next_run_at, ultimateParent }
      }

      const nextDep: string | undefined = parentSt.depends_on_job_type || undefined
      if (!nextDep || nextDep === 'NONE') break
      ultimateParent = nextDep
      currentDep = nextDep
    }

    return { nextRun: null, ultimateParent: dep }
  }

  const isMasterDataRunning = masterDataStatus?.status === 'RUNNING'
  const isFullSyncRunning = fullStatus?.status === 'RUNNING'
  const isDeltaRunning = deltaStatus?.status === 'RUNNING'
  const isRrRunning = rrStatus?.status === 'RUNNING'
  const isRepexRunning = repexStatus?.status === 'RUNNING'

  const canTriggerMasterData = !isMasterDataRunning
  const canTriggerFull = !isFullSyncRunning && !isMasterDataRunning
  const canTriggerDelta = !isDeltaRunning && !isFullSyncRunning
  const canTriggerLevel2 = !isRrRunning && !isRepexRunning && !isFullSyncRunning
  const canTriggerRr = !isRrRunning && !isFullSyncRunning
  const canTriggerRepex = !isRepexRunning && !isRrRunning && !isFullSyncRunning

  const getCardExpandState = (jobKey: string, status: ProcessingStatus | null): boolean => {
    if (status?.status === 'RUNNING') {
      return true
    }
    return expandedCards[jobKey] === true
  }

  const toggleCardExpand = (jobKey: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [jobKey]: !(prev[jobKey] === true),
    }))
  }

  const getNextRunDisplay = (status: ProcessingStatus | null, dependency: string): string => {
    const { nextRun, ultimateParent } = getChainedNextRun(status)
    if (!nextRun) return dependency !== 'None' ? `After ${dependency}` : 'Never'
    if (ultimateParent) return `≥ ${formatDate(nextRun)} (after ${ultimateParent})`
    return formatDate(nextRun)
  }

  const renderStatusCard = (
    title: string,
    status: ProcessingStatus | null,
    isDisabled: boolean = false,
    cardId?: string,
    jobKey: string = 'unknown',
  ) => {
    if (!status) {
      return (
        <div id={cardId} className={`rounded-lg shadow-md p-6 border-2 ${
          isDisabled
            ? 'bg-gray-100 dark:bg-gray-800/30 border-gray-300 dark:border-gray-700 opacity-60'
            : 'bg-white/5 backdrop-blur-sm border-white/10'
        }`}>
          <h2 className="text-2xl font-bold mb-4">{title}</h2>
          <p className="opacity-70">No status data available</p>
        </div>
      )
    }

    const progress = calculateProgress(status)
    const file = status.current_source_file
    const frequency = getFrequencyLabel(status)
    const dependency = status.depends_on_job_type && status.depends_on_job_type !== 'NONE'
      ? getJobDisplayName(status.depends_on_job_type)
      : 'None'
    const isExpanded = getCardExpandState(jobKey, status)
    const canToggle = status.status !== 'RUNNING'

    return (
      <div id={cardId} className={`rounded-lg shadow-md p-6 border-2 ${
        isDisabled
          ? 'bg-gray-100 dark:bg-gray-800/30 border-gray-300 dark:border-gray-700 opacity-60'
          : 'bg-white/5 backdrop-blur-sm border-white/10'
      }`}>
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleCardExpand(jobKey)}
              disabled={!canToggle}
              className="px-3 py-1 rounded-full text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
              title={canToggle ? (isExpanded ? 'Collapse details' : 'Expand details') : 'Running jobs stay expanded'}
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold border-2 ${getStatusColor(status.status)}`}>
              {status.status}
            </span>
          </div>
        </div>

        <div className="mb-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Schedule:</span>
              <span className="font-medium text-gray-900 dark:text-white">{frequency || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Depends On:</span>
              <span className="font-medium text-gray-900 dark:text-white">{dependency}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm mb-4">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Last Run:</span>
            <span className="font-medium text-gray-900 dark:text-white">{formatDate(status.last_run_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Last Success:</span>
            <span className="font-medium text-gray-900 dark:text-white">{formatDate(status.last_success_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Next Run:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {getNextRunDisplay(status, dependency)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Current File:</span>
            <span className="font-medium text-gray-900 dark:text-white truncate max-w-[70%] text-right">
              {file?.file_name || '-'}
            </span>
          </div>
        </div>

        {isExpanded && (
          <>
            {file && status.status === 'RUNNING' && (
              <div className="mb-6">
                {file.total_records > 0 ? (
                  <>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium text-gray-900 dark:text-white">Processing Progress</span>
                      <span className="text-gray-600 dark:text-gray-400">
                        {file.processed_records.toLocaleString()} / {file.total_records.toLocaleString()} records ({progress.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-blue-600 dark:bg-blue-500 h-4 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p className="mb-2">⏳ Downloading file... ({file.processed_records.toLocaleString()} records processed)</p>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                      <div className="bg-blue-600 dark:bg-blue-500 h-4 rounded-full animate-pulse" style={{ width: '30%' }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mb-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-sm text-gray-700 dark:text-gray-200">Processing Summary</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Records:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {file ? file.total_records.toLocaleString() : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Successfully Processed:</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {file ? Math.max(file.processed_records - file.failed_records, 0).toLocaleString() : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Failed Records:</span>
                  <span className={`font-medium ${file && file.failed_records > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
                    {file
                      ? `${file.failed_records > 0 ? '⚠️ ' : ''}${file.failed_records.toLocaleString()}`
                      : '-'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
              <h3 className="font-semibold mb-2 text-sm text-gray-700 dark:text-gray-200">Current File</h3>
              <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
                <p className="truncate"><span className="font-medium text-gray-700 dark:text-gray-300">Name:</span> {file?.file_name || '-'}</p>
                <p><span className="font-medium text-gray-700 dark:text-gray-300">Status:</span> {file?.processing_status || '-'}</p>
                <p><span className="font-medium text-gray-700 dark:text-gray-300">Total Records:</span> {file ? file.total_records.toLocaleString() : '-'}</p>
                <p><span className="font-medium text-gray-700 dark:text-gray-300">Processed:</span> {file ? `${file.processed_records.toLocaleString()} records` : '-'}</p>
                <p className="truncate"><span className="font-medium text-gray-700 dark:text-gray-300">Last LEI:</span> {file?.last_processed_lei || '-'}</p>
                {file?.failure_category && (
                  <p className="text-red-600 dark:text-red-400">
                    <span className="font-medium">Error Category:</span> {file.failure_category}
                  </p>
                )}
                {file?.processing_error && (
                  <p className="text-red-600 dark:text-red-400 text-xs mt-2">
                    <span className="font-medium">Error:</span> {file.processing_error}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {status.error_message && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-300">
              <span className="font-semibold">Error:</span> {status.error_message}
            </p>
          </div>
        )}
      </div>
    )
  }

  const renderLevel2SubJob = (jobType: 'LEVEL2_RR' | 'LEVEL2_REPEX', status: ProcessingStatus | null, dependsOn: string) => {
    const label = getJobDisplayName(jobType)
    const badge = status
      ? <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(status.status)}`}>{status.status}</span>
      : <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-gray-100 text-gray-500 border-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600">UNKNOWN</span>

    return (
      <div className="flex items-start gap-3 py-3 border-b border-gray-200 dark:border-white/10 last:border-b-0">
        <div className="flex flex-col items-center mt-1 shrink-0">
          <div className={`w-3 h-3 rounded-full ${status ? getStatusDot(status.status) : 'bg-gray-400'}`} />
          <div className="w-px flex-1 bg-gray-300 dark:bg-white/10 mt-1" style={{ minHeight: '16px' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a href={`#${getCardId(jobType)}`} className="font-semibold text-sm text-blue-700 hover:underline dark:text-blue-300">{label}</a>
            {badge}
            <span className="text-xs text-gray-500 dark:text-gray-400">depends on: {getJobDisplayName(dependsOn)}</span>
          </div>
          {status && (
            <div className="mt-1 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex gap-4">
                <span>Last run: {formatDate(status.last_run_at)}</span>
                <span>Last success: {formatDate(status.last_success_at)}</span>
              </div>
              {status.error_message && (
                <p className="text-red-600 dark:text-red-400 mt-1 truncate" title={status.error_message}>
                  ⚠️ {status.error_message}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading && !fullStatus && !deltaStatus) {
    return <LoadingSpinner message="Loading LEI processing status..." />
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="LEI Data Processing"
          subtitle="Real-time monitoring of GLEIF data synchronization"
          actions={
            <>
              <button
                onClick={fetchStatus}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                🔄 Refresh Now
              </button>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm opacity-70">Auto-refresh (5s)</span>
              </label>
            </>
          }
        />

        {error && (
          <Alert variant="error" title="Connection Error:" className="mb-6">
            {error}
            <p className="text-sm mt-1 opacity-80">
              Make sure the backend is running and you have proper authentication.
            </p>
          </Alert>
        )}

        {triggerMessage && (
          <Alert variant="info" className="mb-6">
            {triggerMessage}
          </Alert>
        )}

        {/* Pipeline Overview */}
        <div className="mb-8 bg-white dark:bg-white/5 rounded-lg shadow-md p-6 border-2 border-gray-200 dark:border-white/10 backdrop-blur-sm">
          <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Job Pipeline</h2>
          <div className="space-y-1">
            {/* Root: Master Data Sync */}
            <div className="flex items-center gap-3 py-3 border-b border-gray-200 dark:border-white/10">
              <div className={`w-3 h-3 rounded-full shrink-0 ${masterDataStatus ? getStatusDot(masterDataStatus.status) : 'bg-gray-400'}`} />
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <a href={`#${getCardId('MASTER_DATA_SYNC')}`} className="font-semibold text-sm text-blue-700 hover:underline dark:text-blue-300">{getJobDisplayName('MASTER_DATA_SYNC')}</a>
                {masterDataStatus && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(masterDataStatus.status)}`}>
                    {masterDataStatus.status}
                  </span>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400">root job · daily · countries, currencies, languages</span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 text-right shrink-0">
                {formatDate(masterDataStatus?.last_success_at ?? null)}
              </div>
            </div>

            {/* Level 1 Full Sync — depends on MASTER_DATA_SYNC */}
            <div className="pl-6 border-l-2 border-dashed border-gray-300 dark:border-white/10 ml-1.5">
              <div className="flex items-center gap-3 py-3 border-b border-gray-200 dark:border-white/10">
                <div className={`w-3 h-3 rounded-full shrink-0 ${fullStatus ? getStatusDot(fullStatus.status) : 'bg-gray-400'}`} />
                <div className="flex-1 flex items-center gap-2 flex-wrap">
                  <a href={`#${getCardId('DAILY_FULL')}`} className="font-semibold text-sm text-blue-700 hover:underline dark:text-blue-300">{getJobDisplayName('DAILY_FULL')}</a>
                  {fullStatus && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(fullStatus.status)}`}>
                      {fullStatus.status}
                    </span>
                  )}
                  <span className="text-xs text-gray-500 dark:text-gray-400">depends on: MASTER_DATA_SYNC</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 text-right shrink-0">
                  {formatDate(fullStatus?.last_success_at ?? null)}
                </div>
              </div>

              {/* Level 2 dependent sub-jobs — indented under DAILY_FULL */}
              <div className="pl-6 border-l-2 border-dashed border-gray-300 dark:border-white/10 ml-1.5">
                {renderLevel2SubJob('LEVEL2_RR', rrStatus, 'DAILY_FULL')}
                <div className="pl-6 border-l-2 border-dashed border-gray-300 dark:border-white/10 ml-1.5">
                  {renderLevel2SubJob('LEVEL2_REPEX', repexStatus, 'LEVEL2_RR')}
                </div>
              </div>
            </div>

            {/* Delta sync — separate root job (disabled) */}
            <div className="flex items-center gap-3 py-3 opacity-50">
              <div className={`w-3 h-3 rounded-full shrink-0 ${deltaStatus ? getStatusDot(deltaStatus.status) : 'bg-gray-400'}`} />
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <a href={`#${getCardId('DAILY_DELTA')}`} className="font-semibold text-sm text-blue-700 hover:underline dark:text-blue-300">{getJobDisplayName('DAILY_DELTA')}</a>
                <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">DISABLED</span>
              </div>
            </div>
          </div>

          {/* Manual job triggers with dependency-aware disable rules */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manual triggers are available for each job/level. Buttons are disabled while a dependency is running.
            </p>
            <div className="shrink-0 flex flex-wrap items-center gap-2 justify-end">
              <button
                onClick={() => triggerJob('/api/v1/lei/sync/masterdata', 'Master data sync triggered')}
                className="px-3 py-2 bg-cyan-600 text-white text-xs rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50"
                disabled={!canTriggerMasterData}
                title={!canTriggerMasterData ? 'MASTER_DATA_SYNC is already running' : 'Trigger master/reference data sync'}
              >
                ▶ Run Reference Data
              </button>
              <button
                onClick={() => triggerJob('/api/v1/lei/sync/full', 'Level 1 LEI Records sync triggered (DAILY_FULL)')}
                className="px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                disabled={!canTriggerFull}
                title={!canTriggerFull ? 'Blocked while MASTER_DATA_SYNC or DAILY_FULL is running' : 'Trigger Level 1 LEI Records sync (DAILY_FULL)'}
              >
                ▶ Run LEI Records
              </button>
              <button
                onClick={() => triggerJob('/api/v1/lei/sync/delta', 'Delta sync triggered')}
                className="px-3 py-2 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                disabled={!canTriggerDelta}
                title={!canTriggerDelta ? 'Blocked while DAILY_FULL or DAILY_DELTA is running' : 'Trigger delta sync'}
              >
                ▶ Run Delta
              </button>
              <button
                onClick={triggerLevel2Sync}
                className="px-3 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                disabled={!canTriggerLevel2}
                title={!canTriggerLevel2 ? 'Blocked while DAILY_FULL, LEVEL2_RR, or LEVEL2_REPEX is running' : 'Trigger full Level 2 pipeline (RR → REPEX)'}
              >
                ▶ Run Level 2
              </button>
              <button
                onClick={() => triggerJob('/api/v1/lei/sync/level2/rr', 'Level 2 Relationship Records sync triggered (LEVEL2_RR)')}
                className="px-3 py-2 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
                disabled={!canTriggerRr}
                title={!canTriggerRr ? 'Blocked while DAILY_FULL or LEVEL2_RR is running' : 'Trigger Level 2 Relationship Records sync only (LEVEL2_RR)'}
              >
                ▶ Run RR
              </button>
              <button
                onClick={() => triggerJob('/api/v1/lei/sync/level2/repex', 'Level 2 Reporting Exceptions sync triggered (LEVEL2_REPEX)')}
                className="px-3 py-2 bg-fuchsia-600 text-white text-xs rounded-lg hover:bg-fuchsia-700 transition-colors disabled:opacity-50"
                disabled={!canTriggerRepex}
                title={!canTriggerRepex ? 'Blocked while DAILY_FULL, LEVEL2_RR, or LEVEL2_REPEX is running' : 'Trigger Level 2 Reporting Exceptions sync only (LEVEL2_REPEX)'}
              >
                ▶ Run REPEX
              </button>
            </div>
          </div>
        </div>

        {/* Detailed Status Cards */}
        <div className="space-y-6 mb-6">
          {renderStatusCard(getJobDisplayName('MASTER_DATA_SYNC'), masterDataStatus, false, getCardId('MASTER_DATA_SYNC'), 'MASTER_DATA_SYNC')}
          {renderStatusCard(getJobDisplayName('DAILY_FULL'), fullStatus, false, getCardId('DAILY_FULL'), 'DAILY_FULL')}
          {renderStatusCard(getJobDisplayName('LEVEL2_RR'), rrStatus, false, getCardId('LEVEL2_RR'), 'LEVEL2_RR')}
          {renderStatusCard(getJobDisplayName('LEVEL2_REPEX'), repexStatus, false, getCardId('LEVEL2_REPEX'), 'LEVEL2_REPEX')}
          <div className="relative">
            {renderStatusCard(getJobDisplayName('DAILY_DELTA'), deltaStatus, true, getCardId('DAILY_DELTA'), 'DAILY_DELTA')}
            <div className="absolute top-4 right-4 bg-gray-500 text-white text-xs px-2 py-1 rounded">
              DISABLED
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white dark:bg-white/5 rounded-lg shadow-md p-4 border-2 border-gray-200 dark:border-white/10">
          <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">Status Legend</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full font-semibold border-2 ${getStatusColor('IDLE')}`}>IDLE</span>
              <span className="text-gray-600 dark:text-gray-400">Waiting for next scheduled run</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full font-semibold border-2 ${getStatusColor('RUNNING')}`}>RUNNING</span>
              <span className="text-gray-600 dark:text-gray-400">Currently processing data</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full font-semibold border-2 ${getStatusColor('FAILED')}`}>FAILED</span>
              <span className="text-gray-600 dark:text-gray-400">Encountered an error (auto-recovery on next startup)</span>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Data source: GLEIF Golden Copy Files • Updated every 5 seconds when auto-refresh is enabled</p>
        </div>
      </div>
    </div>
  )
}
