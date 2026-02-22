'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ThemeToggle from '../components/ThemeToggle'
import { formatStatusLabel } from '../lib/status-label'

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
  current_source_file_id: string | null
  current_source_file: SourceFile | null
  error_message: string
}

const SAMPLE_FULL_STATUS: ProcessingStatus = {
  id: 'sample-full',
  job_type: 'DAILY_FULL',
  status: 'IDLE',
  last_run_at: '2026-02-20T01:00:00Z',
  next_run_at: '2026-02-23T01:00:00Z',
  last_success_at: '2026-02-20T01:25:00Z',
  current_source_file_id: 'sample-file-full',
  current_source_file: {
    id: 'sample-file-full',
    file_name: 'gleif_full_20260220.xml.zip',
    processing_status: 'COMPLETED',
    total_records: 1200,
    processed_records: 1200,
    failed_records: 0,
    last_processed_lei: '529900T8BM49AURSDO55',
    failure_category: '',
    processing_error: '',
  },
  error_message: '',
}

const SAMPLE_DELTA_STATUS: ProcessingStatus = {
  id: 'sample-delta',
  job_type: 'DAILY_DELTA',
  status: 'IDLE',
  last_run_at: '2026-02-22T09:00:00Z',
  next_run_at: '2026-02-22T10:00:00Z',
  last_success_at: '2026-02-22T09:02:30Z',
  current_source_file_id: 'sample-file-delta',
  current_source_file: {
    id: 'sample-file-delta',
    file_name: 'gleif_delta_20260222.xml.zip',
    processing_status: 'COMPLETED',
    total_records: 150,
    processed_records: 150,
    failed_records: 0,
    last_processed_lei: '5493001KJTIIGC8Y1R12',
    failure_category: '',
    processing_error: '',
  },
  error_message: '',
}

const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const keys = ['token', 'jwt', 'authToken', 'access_token']
  for (const key of keys) {
    const value = localStorage.getItem(key)
    if (value && value.trim()) {
      return value.trim()
    }
  }

  return null
}

export default function LEIStatusPage() {
  const [fullStatus, setFullStatus] = useState<ProcessingStatus | null>(null)
  const [deltaStatus, setDeltaStatus] = useState<ProcessingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dataMode, setDataMode] = useState<'api' | 'sample'>('api')
  const [infoMessage, setInfoMessage] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const API_BASE_URL = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080')
    : 'http://backend:8080'

  const fetchStatus = async () => {
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      }

      const token = getAuthToken()
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const [fullResponse, deltaResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/lei/status/DAILY_FULL`, {
          headers,
        }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/lei/status/DAILY_DELTA`, {
          headers,
        }).catch(() => null)
      ])

      const unauthorized = fullResponse?.status === 401 || fullResponse?.status === 403 || deltaResponse?.status === 401 || deltaResponse?.status === 403
      const hasApiData = Boolean((fullResponse && fullResponse.ok) || (deltaResponse && deltaResponse.ok))

      if (fullResponse && fullResponse.ok) {
        const fullData = await fullResponse.json()
        console.log('LEI Full Status:', fullData)
        setFullStatus(fullData)
      } else if (!hasApiData) {
        console.error('Failed to fetch full status:', fullResponse?.status)
        setFullStatus(SAMPLE_FULL_STATUS)
      }

      if (deltaResponse && deltaResponse.ok) {
        const deltaData = await deltaResponse.json()
        console.log('LEI Delta Status:', deltaData)
        setDeltaStatus(deltaData)
      } else if (!hasApiData) {
        console.error('Failed to fetch delta status:', deltaResponse?.status)
        setDeltaStatus(SAMPLE_DELTA_STATUS)
      }

      if (hasApiData) {
        setDataMode('api')
        setInfoMessage('Loaded from LEI status API.')
      } else {
        setDataMode('sample')
        setInfoMessage(
          unauthorized
            ? 'LEI status API requires authentication. Showing sample data.'
            : 'LEI status API unavailable. Showing sample data.'
        )
      }

      setError(null)
    } catch (err) {
      setFullStatus(SAMPLE_FULL_STATUS)
      setDeltaStatus(SAMPLE_DELTA_STATUS)
      setDataMode('sample')
      setInfoMessage('LEI status API unavailable. Showing sample data.')
      setError(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchStatus()
    }
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchStatus, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [autoRefresh])

  const formatDate = (dateString: string | null) => {
    if (!dateString || dateString.startsWith('0001-')) return 'Never'
    const date = new Date(dateString)
    return date.toISOString().replace('T', ' ').substring(0, 19)
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

  const calculateProgress = (status: ProcessingStatus | null): number => {
    if (!status?.current_source_file) return 0
    
    const file = status.current_source_file
    const processed = file.processed_records || 0
    const total = file.total_records || 0
    
    return total > 0 ? (processed / total) * 100 : 0
  }

  const getFrequencyLabel = (status: ProcessingStatus | null): string => {
    if (!status) return ''
    
    // Use job_type as primary indicator (more reliable than time calculation)
    if (status.job_type === 'DAILY_FULL') {
      return 'Daily'
    }
    
    if (status.job_type === 'DAILY_DELTA') {
      return 'Hourly'
    }
    
    // Fallback to time-based detection for unknown job types
    if (status.next_run_at && status.last_run_at) {
      const nextRun = new Date(status.next_run_at)
      const lastRun = new Date(status.last_run_at)
      const hoursDiff = (nextRun.getTime() - lastRun.getTime()) / (1000 * 60 * 60)
      
      if (hoursDiff > 24) {
        return 'Weekly'
      } else if (hoursDiff > 2) {
        return 'Daily'
      } else {
        return 'Hourly'
      }
    }
    
    return 'Unknown'
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
    const runningPhase =
      status.status === 'RUNNING' && file
        ? file.total_records > 0
          ? 'processing'
          : file.processing_status === 'PENDING'
            ? 'downloading'
            : file.processing_status === 'IN_PROGRESS'
              ? 'extracting'
              : 'preparing'
        : null

    return (
      <div className={`rounded-lg shadow-md p-6 border-2 ${
        isDisabled 
          ? 'bg-gray-100 dark:bg-gray-800/30 border-gray-300 dark:border-gray-700 opacity-60' 
          : 'bg-white/5 backdrop-blur-sm border-white/10'
      }`}>
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold">{title}</h2>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold border-2 ${getStatusColor(status.status)}`}>
            {formatStatusLabel(status.status)}
          </span>
        </div>

        {/* Progress Bar */}
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
                <p className="mb-2">
                  {runningPhase === 'downloading' && `⏳ Downloading file... (${file.processed_records.toLocaleString()} records processed)`}
                  {runningPhase === 'extracting' && `⏳ Extracting file... (${file.processed_records.toLocaleString()} records processed)`}
                  {runningPhase === 'preparing' && `⏳ Preparing file... (${file.processed_records.toLocaleString()} records processed)`}
                </p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                  <div className="bg-blue-600 dark:bg-blue-500 h-4 rounded-full animate-pulse" style={{ width: '30%' }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Processing Summary - Show for completed files or RUNNING files with failures */}
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
                  {file.total_records > 0 && (
                    <span className="text-xs ml-1">
                      ({((file.processed_records - file.failed_records) / file.total_records * 100).toFixed(1)}%)
                    </span>
                  )}
                </span>
              </div>
              {file.failed_records > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Failed Records:</span>
                  <span className="font-medium text-orange-600 dark:text-orange-400">
                    ⚠️ {file.failed_records.toLocaleString()}
                    {file.total_records > 0 && (
                      <span className="text-xs ml-1">
                        ({(file.failed_records / file.total_records * 100).toFixed(1)}%)
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Current File Information */}
        {file && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-2 text-sm text-gray-700 dark:text-gray-200">Current File</h3>
            <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
              <p className="truncate"><span className="font-medium text-gray-700 dark:text-gray-300">Name:</span> {file.file_name}</p>
              <p><span className="font-medium text-gray-700 dark:text-gray-300">Status:</span> {formatStatusLabel(file.processing_status)}</p>
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

        {/* Timestamps */}
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

        {/* Error Message */}
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

  if (loading && !fullStatus && !deltaStatus) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 opacity-70">Loading LEI processing status...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 inline-block">
              ← Back to Home
            </Link>
            <h1 className="text-4xl font-bold mb-2">LEI Data Processing</h1>
            <p className="text-lg opacity-70">Real-time monitoring of GLEIF data synchronization</p>
          </div>
          <div className="flex items-center gap-4">
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
            <ThemeToggle />
          </div>
        </div>

        {/* Data Source Alert */}
        <div
          className={`mb-6 p-4 rounded-lg border ${
            dataMode === 'api' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
          }`}
        >
          <p className={dataMode === 'api' ? 'text-green-800' : 'text-yellow-800'}>
            <span className="font-semibold">{dataMode === 'api' ? '✅ Data Source:' : '📋 Notice:'}</span> {infoMessage}
          </p>
          {error && (
            <p className="text-sm mt-1 text-yellow-700">{error}</p>
          )}
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderStatusCard(`Full Sync (${getFrequencyLabel(fullStatus)})`, fullStatus, false)}
          <div className="relative">
            {renderStatusCard(`Delta Sync (${getFrequencyLabel(deltaStatus)})`, deltaStatus, true)}
            <div className="absolute top-4 right-4 bg-gray-500 text-white text-xs px-2 py-1 rounded">
              DISABLED
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-8 bg-white dark:bg-white/5 rounded-lg shadow-md p-4 border-2 border-gray-200 dark:border-white/10">
          <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">Status Legend</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full font-semibold border-2 ${getStatusColor('IDLE')}`}>Idle</span>
              <span className="text-gray-600 dark:text-gray-400">Waiting for next scheduled run</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full font-semibold border-2 ${getStatusColor('RUNNING')}`}>Running</span>
              <span className="text-gray-600 dark:text-gray-400">Currently processing data</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full font-semibold border-2 ${getStatusColor('FAILED')}`}>Failed</span>
              <span className="text-gray-600 dark:text-gray-400">Encountered an error (requires manual intervention)</span>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Data source: GLEIF Golden Copy Files • Updated every 5 seconds when auto-refresh is enabled</p>
        </div>
      </div>
    </div>
  )
}
