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
  const [fullStatus, setFullStatus] = useState<ProcessingStatus | null>(null)
  const [deltaStatus, setDeltaStatus] = useState<ProcessingStatus | null>(null)
  const [rrStatus, setRrStatus] = useState<ProcessingStatus | null>(null)
  const [repexStatus, setRepexStatus] = useState<ProcessingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null)

  const API_BASE_URL = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080')
    : 'http://backend:8080'

  const fetchStatus = async () => {
    try {
      const [fullResponse, deltaResponse, rrResponse, repexResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/lei/status/DAILY_FULL`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/lei/status/DAILY_DELTA`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/lei/status/LEVEL2_RR`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/lei/status/LEVEL2_REPEX`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
      ])

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
        setTriggerMessage('Failed to trigger Level 2 sync — check authentication')
        setTimeout(() => setTriggerMessage(null), 5000)
      }
    } catch (err) {
      setTriggerMessage(err instanceof Error ? err.message : 'Failed to trigger Level 2 sync')
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

  const calculateProgress = (status: ProcessingStatus | null): number => {
    if (!status?.current_source_file) return 0
    const file = status.current_source_file
    const processed = file.processed_records || 0
    const total = file.total_records || 0
    return total > 0 ? (processed / total) * 100 : 0
  }

  const getFrequencyLabel = (status: ProcessingStatus | null): string => {
    if (!status) return ''
    if (status.job_type === 'DAILY_FULL') return 'Daily'
    if (status.job_type === 'DAILY_DELTA') return 'Hourly'
    return ''
  }

  const renderStatusCard = (title: string, status: ProcessingStatus | null, isDisabled: boolean = false) => {
    if (!status) {
      return (
        <div className={`rounded-lg shadow-md p-6 border-2 ${
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

    return (
      <div className={`rounded-lg shadow-md p-6 border-2 ${
        isDisabled
          ? 'bg-gray-100 dark:bg-gray-800/30 border-gray-300 dark:border-gray-700 opacity-60'
          : 'bg-white/5 backdrop-blur-sm border-white/10'
      }`}>
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold">{title}</h2>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold border-2 ${getStatusColor(status.status)}`}>
            {status.status}
          </span>
        </div>

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

        {file && (status.status === 'COMPLETED' || status.status === 'IDLE' || file.failed_records > 0) && (
          <div className="mb-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h3 className="font-semibold mb-2 text-sm text-gray-700 dark:text-gray-200">Processing Summary</h3>
            <div className="space-y-1 text-sm">
              {file.total_records > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Records:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{file.total_records.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Successfully Processed:</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {(file.processed_records - file.failed_records).toLocaleString()}
                </span>
              </div>
              {file.failed_records > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Failed Records:</span>
                  <span className="font-medium text-orange-600 dark:text-orange-400">⚠️ {file.failed_records.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {file && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-2 text-sm text-gray-700 dark:text-gray-200">Current File</h3>
            <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
              <p className="truncate"><span className="font-medium text-gray-700 dark:text-gray-300">Name:</span> {file.file_name}</p>
              <p><span className="font-medium text-gray-700 dark:text-gray-300">Status:</span> {file.processing_status}</p>
              {file.total_records > 0 && (
                <p><span className="font-medium text-gray-700 dark:text-gray-300">Total Records:</span> {file.total_records.toLocaleString()}</p>
              )}
              <p><span className="font-medium text-gray-700 dark:text-gray-300">Processed:</span> {file.processed_records.toLocaleString()} records</p>
              {file.last_processed_lei && (
                <p className="truncate"><span className="font-medium text-gray-700 dark:text-gray-300">Last LEI:</span> {file.last_processed_lei}</p>
              )}
              {file.failure_category && (
                <p className="text-red-600 dark:text-red-400">
                  <span className="font-medium">Error Category:</span> {file.failure_category}
                </p>
              )}
              {file.processing_error && (
                <p className="text-red-600 dark:text-red-400 text-xs mt-2">
                  <span className="font-medium">Error:</span> {file.processing_error}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2 text-sm">
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
            <span className="font-medium text-gray-900 dark:text-white">{formatDate(status.next_run_at)}</span>
          </div>
        </div>

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

  const renderLevel2SubJob = (label: string, status: ProcessingStatus | null, dependsOn: string) => {
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
            <span className="font-semibold text-sm text-gray-900 dark:text-white">{label}</span>
            {badge}
            <span className="text-xs text-gray-500 dark:text-gray-400">depends on: {dependsOn}</span>
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
            {/* Level 1 root jobs */}
            <div className="flex items-center gap-3 py-3 border-b border-gray-200 dark:border-white/10">
              <div className={`w-3 h-3 rounded-full shrink-0 ${fullStatus ? getStatusDot(fullStatus.status) : 'bg-gray-400'}`} />
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-gray-900 dark:text-white">Level 1 — Full Sync (DAILY_FULL)</span>
                {fullStatus && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(fullStatus.status)}`}>
                    {fullStatus.status}
                  </span>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400">root job · daily</span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 text-right shrink-0">
                {formatDate(fullStatus?.last_success_at ?? null)}
              </div>
            </div>

            {/* Level 2 dependent sub-jobs — indented */}
            <div className="pl-6 border-l-2 border-dashed border-gray-300 dark:border-white/10 ml-1.5">
              {renderLevel2SubJob('Level 2 — Relationship Records (LEVEL2_RR)', rrStatus, 'DAILY_FULL')}
              <div className="pl-6 border-l-2 border-dashed border-gray-300 dark:border-white/10 ml-1.5">
                {renderLevel2SubJob('Level 2 — Reporting Exceptions (LEVEL2_REPEX)', repexStatus, 'LEVEL2_RR')}
              </div>
            </div>

            {/* Delta sync — separate root job (disabled) */}
            <div className="flex items-center gap-3 py-3 opacity-50">
              <div className={`w-3 h-3 rounded-full shrink-0 ${deltaStatus ? getStatusDot(deltaStatus.status) : 'bg-gray-400'}`} />
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-gray-900 dark:text-white">Level 1 — Delta Sync (DAILY_DELTA)</span>
                <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">DISABLED</span>
              </div>
            </div>
          </div>

          {/* Manual Level 2 trigger */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Trigger an intra-day Level 2 sync (RR → REPEX) independently of the daily schedule.
            </p>
            <button
              onClick={triggerLevel2Sync}
              className="shrink-0 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              disabled={rrStatus?.status === 'RUNNING' || repexStatus?.status === 'RUNNING'}
            >
              ▶ Run Level 2 Now
            </button>
          </div>
        </div>

        {/* Detailed Status Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {renderStatusCard(`Full Sync (${getFrequencyLabel(fullStatus)})`, fullStatus, false)}
          <div className="relative">
            {renderStatusCard(`Delta Sync (${getFrequencyLabel(deltaStatus)})`, deltaStatus, true)}
            <div className="absolute top-4 right-4 bg-gray-500 text-white text-xs px-2 py-1 rounded">
              DISABLED
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {renderStatusCard('Level 2 — Relationship Records', rrStatus, false)}
          {renderStatusCard('Level 2 — Reporting Exceptions', repexStatus, false)}
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
