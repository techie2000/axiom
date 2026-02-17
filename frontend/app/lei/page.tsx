'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ThemeToggle from '../components/ThemeToggle'

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

export default function LEIStatusPage() {
  const [fullStatus, setFullStatus] = useState<ProcessingStatus | null>(null)
  const [deltaStatus, setDeltaStatus] = useState<ProcessingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const API_BASE_URL = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080')
    : 'http://backend:8080'

  const fetchStatus = async () => {
    try {
      // For now, we'll call without auth - you'll need to add JWT token
      const [fullResponse, deltaResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/lei/status/DAILY_FULL`, {
          headers: {
            'Accept': 'application/json',
            // Add auth when ready: 'Authorization': `Bearer ${token}`
          }
        }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/lei/status/DAILY_DELTA`, {
          headers: {
            'Accept': 'application/json',
            // Add auth when ready: 'Authorization': `Bearer ${token}`
          }
        }).catch(() => null)
      ])

      if (fullResponse && fullResponse.ok) {
        const fullData = await fullResponse.json()
        console.log('LEI Full Status:', fullData)
        setFullStatus(fullData)
      } else {
        console.error('Failed to fetch full status:', fullResponse?.status)
      }

      if (deltaResponse && deltaResponse.ok) {
        const deltaData = await deltaResponse.json()
        console.log('LEI Delta Status:', deltaData)
        setDeltaStatus(deltaData)
      } else {
        console.error('Failed to fetch delta status:', deltaResponse?.status)
      }

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status')
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
                <p className="mb-2">⏳ Downloading file... ({file.processed_records.toLocaleString()} records processed)</p>
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
            <ThemeToggle />
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
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">
              <span className="font-semibold">Connection Error:</span> {error}
            </p>
            <p className="text-sm text-red-600 mt-1">
              Make sure the backend is running and you have proper authentication.
            </p>
          </div>
        )}

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
              <span className={`px-3 py-1 rounded-full font-semibold border-2 ${getStatusColor('IDLE')}`}>IDLE</span>
              <span className="text-gray-600 dark:text-gray-400">Waiting for next scheduled run</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full font-semibold border-2 ${getStatusColor('RUNNING')}`}>RUNNING</span>
              <span className="text-gray-600 dark:text-gray-400">Currently processing data</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full font-semibold border-2 ${getStatusColor('FAILED')}`}>FAILED</span>
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
