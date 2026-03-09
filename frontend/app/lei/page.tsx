'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
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
  progress_message: string
}

interface MasterDataCounts {
  countries: number
  currencies: number
  languages: number
  total: number
}

interface Level2ProcessingFailure {
  id: string
  job_type: string
  source_file_id: string | null
  failure_stage: string
  natural_key: string
  error_message: string
  resolved: boolean
  resolved_at: string | null
  resolved_source_file_id: string | null
  resolved_note: string
  created_at: string
  raw_record: string | null
}

type ImportJobType = 'DAILY_FULL' | 'DAILY_DELTA' | 'LEVEL2_RR' | 'LEVEL2_REPEX'

export default function LEIStatusPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [masterDataStatus, setMasterDataStatus] = useState<ProcessingStatus | null>(null)
  const [fullStatus, setFullStatus] = useState<ProcessingStatus | null>(null)
  const [deltaStatus, setDeltaStatus] = useState<ProcessingStatus | null>(null)
  const [rrStatus, setRrStatus] = useState<ProcessingStatus | null>(null)
  const [repexStatus, setRepexStatus] = useState<ProcessingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null)
  const [triggerVariant, setTriggerVariant] = useState<'info' | 'warning' | 'error' | 'success'>('info')
  const [fullExpanded, setFullExpanded] = useState(false)
  const [rrExpanded, setRrExpanded] = useState(false)
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})
  const [masterDataCounts, setMasterDataCounts] = useState<MasterDataCounts | null>(null)
  const [level2FailuresByJob, setLevel2FailuresByJob] = useState<Record<string, Level2ProcessingFailure[]>>({})
  const [level2FailuresTotalByJob, setLevel2FailuresTotalByJob] = useState<Record<string, number>>({})
  const [level2FailuresExpandedByJob, setLevel2FailuresExpandedByJob] = useState<Record<string, boolean>>({})
  const [level2FailuresLoadingByJob, setLevel2FailuresLoadingByJob] = useState<Record<string, boolean>>({})
  const [level2FailuresErrorByJob, setLevel2FailuresErrorByJob] = useState<Record<string, string | null>>({})
  const [level2FailuresOpenOnlyByJob, setLevel2FailuresOpenOnlyByJob] = useState<Record<string, boolean>>({
    DAILY_FULL: true,
    DAILY_DELTA: true,
    LEVEL2_RR: true,
    LEVEL2_REPEX: true,
  })

  const API_BASE_URL = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080')
    : 'http://backend:8080'

  const fetchStatus = useCallback(async () => {
    try {
      const [
        mdResponse,
        fullResponse,
        deltaResponse,
        rrResponse,
        repexResponse,
        countriesResponse,
        currenciesResponse,
        languagesResponse,
      ] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/lei/status/MASTER_DATA_SYNC`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/lei/status/DAILY_FULL`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/lei/status/DAILY_DELTA`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/lei/status/LEVEL2_RR`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/lei/status/LEVEL2_REPEX`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/countries?limit=5000&offset=0`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/currencies?limit=5000&offset=0`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/languages?limit=5000&offset=0`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
      ])

      if (mdResponse?.ok) setMasterDataStatus(await mdResponse.json())
      if (fullResponse?.ok) setFullStatus(await fullResponse.json())
      if (deltaResponse?.ok) setDeltaStatus(await deltaResponse.json())
      if (rrResponse?.ok) setRrStatus(await rrResponse.json())
      if (repexResponse?.ok) setRepexStatus(await repexResponse.json())

      if (countriesResponse?.ok && currenciesResponse?.ok && languagesResponse?.ok) {
        const [countries, currencies, languages] = await Promise.all([
          countriesResponse.json(),
          currenciesResponse.json(),
          languagesResponse.json(),
        ])

        const countriesCount = Array.isArray(countries) ? countries.length : 0
        const currenciesCount = Array.isArray(currencies) ? currencies.length : 0
        const languagesCount = Array.isArray(languages) ? languages.length : 0

        setMasterDataCounts({
          countries: countriesCount,
          currencies: currenciesCount,
          languages: languagesCount,
          total: countriesCount + currenciesCount + languagesCount,
        })
      }

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status')
    } finally {
      setLoading(false)
    }
  }, [API_BASE_URL])

  const getAuthToken = (): string | null => {
    const rawToken = localStorage.getItem('axiom_token')
    if (!rawToken) return null

    const normalizedToken = rawToken.replace(/^Bearer\s+/i, '').trim()
    if (!normalizedToken || normalizedToken === 'undefined' || normalizedToken === 'null') {
      return null
    }

    return normalizedToken
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsLoggedIn(getAuthToken() !== null)
  }, [])

  const isJwtExpired = (token: string): boolean => {
    const parts = token.split('.')
    if (parts.length !== 3) return true

    try {
      const payloadBase64Url = parts[1]
      const payloadBase64 = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/')
      const paddingLength = (4 - (payloadBase64.length % 4)) % 4
      const paddedPayloadBase64 = payloadBase64 + '='.repeat(paddingLength)
      const payloadJson = atob(paddedPayloadBase64)
      const payload = JSON.parse(payloadJson) as { exp?: number }

      if (typeof payload.exp !== 'number') return false
      const nowEpoch = Math.floor(Date.now() / 1000)
      return payload.exp <= nowEpoch
    } catch {
      return true
    }
  }

  const triggerJob = async (endpoint: string, successMessage: string) => {
    const showTriggerMessage = (message: string, variant: 'info' | 'warning' | 'error' | 'success') => {
      setTriggerVariant(variant)
      setTriggerMessage(message)
      setTimeout(() => setTriggerMessage(null), 5000)
    }

    try {
      const token = getAuthToken()
      const tokenExpired = token ? isJwtExpired(token) : null

      if (!token) {
        showTriggerMessage('Authorization required. Log in again and retry.', 'warning')
        return
      }

      if (tokenExpired) {
        localStorage.removeItem('axiom_token')
        showTriggerMessage('Session expired. Log in again and retry.', 'warning')
        return
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        showTriggerMessage(data.message || successMessage, 'success')
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
      const isAuthFailure = response.status === 401 || response.status === 403
      if (isAuthFailure) {
        localStorage.removeItem('axiom_token')
      }
      const authHint = isAuthFailure ? ' Log in again and retry.' : ''
      showTriggerMessage(`${backendMessage}${authHint}`, isAuthFailure ? 'warning' : 'error')
    } catch (err) {
      showTriggerMessage(err instanceof Error ? err.message : 'Failed to trigger job', 'error')
    }
  }

  const fetchLevel2Failures = async (jobType: ImportJobType, openOnly: boolean) => {
    setLevel2FailuresLoadingByJob(prev => ({ ...prev, [jobType]: true }))
    setLevel2FailuresErrorByJob(prev => ({ ...prev, [jobType]: null }))
    try {
      const params = new URLSearchParams({
        jobType,
        openOnly: openOnly ? 'true' : 'false',
        limit: '50',
        offset: '0',
      })
      const response = await fetch(`${API_BASE_URL}/api/v1/lei/import-failures?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) {
        throw new Error('Failed to fetch Level 2 processing failures')
      }

      const payload = await response.json()
      const items = Array.isArray(payload?.items) ? payload.items as Level2ProcessingFailure[] : []
      const total = typeof payload?.total === 'number' ? payload.total : items.length

      setLevel2FailuresByJob(prev => ({ ...prev, [jobType]: items }))
      setLevel2FailuresTotalByJob(prev => ({ ...prev, [jobType]: total }))
      setLevel2FailuresOpenOnlyByJob(prev => ({ ...prev, [jobType]: openOnly }))
    } catch (err) {
      setLevel2FailuresErrorByJob(prev => ({
        ...prev,
        [jobType]: err instanceof Error ? err.message : 'Failed to fetch Level 2 processing failures',
      }))
    } finally {
      setLevel2FailuresLoadingByJob(prev => ({ ...prev, [jobType]: false }))
    }
  }

  const toggleLevel2Failures = async (jobType: ImportJobType) => {
    const isOpen = level2FailuresExpandedByJob[jobType] === true
    if (isOpen) {
      setLevel2FailuresExpandedByJob(prev => ({ ...prev, [jobType]: false }))
      return
    }

    const openOnly = level2FailuresOpenOnlyByJob[jobType] ?? true
    const hasLoaded = level2FailuresByJob[jobType] !== undefined
    if (!hasLoaded) {
      await fetchLevel2Failures(jobType, openOnly)
    }
    setLevel2FailuresExpandedByJob(prev => ({ ...prev, [jobType]: true }))
  }

  const switchLevel2FailureMode = async (jobType: ImportJobType, openOnly: boolean) => {
    await fetchLevel2Failures(jobType, openOnly)
    setLevel2FailuresExpandedByJob(prev => ({ ...prev, [jobType]: true }))
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchStatus()
    }
  }, [fetchStatus])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchStatus])

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (rrExpanded) {
          setRrExpanded(false)
        } else if (fullExpanded) {
          setFullExpanded(false)
        }
      }
    }
    document.addEventListener('keydown', handleEscapeKey)
    return () => document.removeEventListener('keydown', handleEscapeKey)
  }, [fullExpanded, rrExpanded])

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
    if (status.job_type === 'DAILY_FULL') return 'Daily / chained'
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
    const isImportJob = jobKey === 'DAILY_FULL' || jobKey === 'DAILY_DELTA' || jobKey === 'LEVEL2_RR' || jobKey === 'LEVEL2_REPEX'
    const isMasterDataJob = jobKey === 'MASTER_DATA_SYNC'
    const progressMessage = status.progress_message?.trim() || ''
    const fallbackTotalRecords = isMasterDataJob ? (masterDataCounts?.total ?? 0) : 0
    const totalRecords = file ? file.total_records : fallbackTotalRecords
    const successfulProcessed = file
      ? Math.max(file.processed_records - file.failed_records, 0)
      : fallbackTotalRecords
    const failedRecords = file ? file.failed_records : 0
    const currentFileLabel = file?.file_name || (isMasterDataJob ? 'Master datasets (countries, currencies, languages)' : '-')
    const frequency = getFrequencyLabel(status)
    const dependency = status.depends_on_job_type && status.depends_on_job_type !== 'NONE'
      ? getJobDisplayName(status.depends_on_job_type)
      : 'None'
    const isExpanded = getCardExpandState(jobKey, status)
    const canToggle = status.status !== 'RUNNING'
    const level2JobKey = isImportJob ? (jobKey as ImportJobType) : null
    const level2FailuresOpen = level2JobKey ? (level2FailuresExpandedByJob[level2JobKey] === true) : false
    const level2Failures = level2JobKey ? (level2FailuresByJob[level2JobKey] ?? []) : []
    const level2FailuresTotal = level2JobKey ? (level2FailuresTotalByJob[level2JobKey] ?? level2Failures.length) : 0
    const level2FailuresLoading = level2JobKey ? (level2FailuresLoadingByJob[level2JobKey] === true) : false
    const level2FailuresError = level2JobKey ? level2FailuresErrorByJob[level2JobKey] : null
    const level2OpenOnly = level2JobKey ? (level2FailuresOpenOnlyByJob[level2JobKey] ?? true) : true

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
              {currentFileLabel}
            </span>
          </div>
        </div>

        {isExpanded && (
          <>
            {file && status.status === 'RUNNING' && (
              <div className="mb-6">
                {progressMessage && (
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">⏳ {progressMessage}</p>
                )}
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
                      ⏳ {progressMessage || 'Preparing file for processing...'} ({file.processed_records.toLocaleString()} records processed)
                    </p>
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
                    {totalRecords > 0 ? totalRecords.toLocaleString() : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Successfully Processed:</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {totalRecords > 0 ? successfulProcessed.toLocaleString() : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Failed Records:</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${failedRecords > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
                      {totalRecords > 0
                        ? `${failedRecords > 0 ? '⚠️ ' : ''}${failedRecords.toLocaleString()}`
                        : '-'}
                    </span>
                    {isImportJob && failedRecords > 0 && level2JobKey && (
                      <button
                        type="button"
                        onClick={() => void toggleLevel2Failures(level2JobKey)}
                        className="text-xs px-2 py-1 rounded border border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/20"
                      >
                        {level2FailuresOpen ? 'Hide details' : 'View details'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {isImportJob && level2JobKey && level2FailuresOpen && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">
                    Failed Records {level2OpenOnly ? '(Open)' : '(Open + Resolved)'}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void switchLevel2FailureMode(level2JobKey, true)}
                      className={`text-xs px-2 py-1 rounded border ${level2OpenOnly
                        ? 'border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:bg-blue-900/20'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      Open only
                    </button>
                    <button
                      type="button"
                      onClick={() => void switchLevel2FailureMode(level2JobKey, false)}
                      className={`text-xs px-2 py-1 rounded border ${!level2OpenOnly
                        ? 'border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:bg-blue-900/20'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      Include resolved
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Showing {level2Failures.length.toLocaleString()} of {level2FailuresTotal.toLocaleString()} records
                </p>

                {level2FailuresLoading && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">Loading failure details...</p>
                )}

                {!level2FailuresLoading && level2FailuresError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{level2FailuresError}</p>
                )}

                {!level2FailuresLoading && !level2FailuresError && level2Failures.length === 0 && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">No matching failed records.</p>
                )}

                {!level2FailuresLoading && !level2FailuresError && level2Failures.length > 0 && (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {level2Failures.map((failure) => (
                      <div key={failure.id} className="rounded border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-900/30">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{failure.failure_stage}</span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${failure.resolved
                            ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-300'
                            : 'border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-300'
                          }`}>
                            {failure.resolved ? 'RESOLVED' : 'OPEN'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 break-all">
                          <span className="font-medium">Key:</span> {failure.natural_key || '(none)'}
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1 break-words">{failure.error_message}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                          Raised: {formatDate(failure.created_at)}
                          {failure.resolved_at ? ` • Resolved: ${formatDate(failure.resolved_at)}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
              <h3 className="font-semibold mb-2 text-sm text-gray-700 dark:text-gray-200">Current File</h3>
              <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
                <p className="truncate"><span className="font-medium text-gray-700 dark:text-gray-300">Name:</span> {currentFileLabel}</p>
                <p><span className="font-medium text-gray-700 dark:text-gray-300">Status:</span> {file?.processing_status || status.status}</p>
                <p><span className="font-medium text-gray-700 dark:text-gray-300">Total Records:</span> {totalRecords > 0 ? totalRecords.toLocaleString() : '-'}</p>
                <p><span className="font-medium text-gray-700 dark:text-gray-300">Processed:</span> {totalRecords > 0 ? `${successfulProcessed.toLocaleString()} records` : '-'}</p>
                <p className="truncate"><span className="font-medium text-gray-700 dark:text-gray-300">Last LEI:</span> {file?.last_processed_lei || '-'}</p>
                {status.status === 'RUNNING' && progressMessage && (
                  <p className="text-blue-700 dark:text-blue-300">
                    <span className="font-medium">Progress:</span> {progressMessage}
                  </p>
                )}
                {isMasterDataJob && masterDataCounts && (
                  <p>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Breakdown:</span>{' '}
                    {`Countries ${masterDataCounts.countries.toLocaleString()}, Currencies ${masterDataCounts.currencies.toLocaleString()}, Languages ${masterDataCounts.languages.toLocaleString()}`}
                  </p>
                )}
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

  const renderControlSpacer = () => <div className="w-5 h-5 shrink-0" aria-hidden="true" />

  const renderDisclosureButton = (expanded: boolean, onToggle: () => void, label: string) => (
    <button
      type="button"
      onClick={onToggle}
      className="w-5 h-5 shrink-0 inline-flex items-center justify-center rounded-md border border-transparent bg-transparent text-gray-500 hover:border-gray-300 hover:bg-gray-100/80 hover:text-gray-700 focus-visible:outline-none focus-visible:border-gray-400 dark:text-gray-400 dark:hover:border-white/25 dark:hover:bg-white/10 dark:hover:text-gray-200 dark:focus-visible:border-white/35"
      aria-label={label}
      title={label}
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
        aria-hidden="true"
      >
        <path d="M7 5L12 10L7 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )

  const renderRowActionButton = (onClick: () => void, disabled: boolean, title: string) => (
    <button
      type="button"
      onClick={onClick}
      className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-transparent bg-transparent text-gray-500 hover:border-gray-300 hover:bg-gray-100/80 hover:text-gray-700 focus-visible:outline-none focus-visible:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-400 dark:hover:border-white/25 dark:hover:bg-white/10 dark:hover:text-gray-200 dark:focus-visible:border-white/35"
      disabled={disabled}
      title={title}
      aria-label={title}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3" aria-hidden="true">
        <path d="M6 4.5C6 3.72 6.85 3.24 7.52 3.64L16.52 9.14C17.16 9.53 17.16 10.47 16.52 10.86L7.52 16.36C6.85 16.76 6 16.28 6 15.5V4.5Z" />
      </svg>
    </button>
  )

  const renderRowTimestamps = (status: ProcessingStatus | null, className: string = 'mt-1') => (
    <div className={`${className} text-xs text-gray-500 dark:text-gray-500`}>
      <span>
        Last run: <span className="font-mono text-gray-700 dark:text-gray-300">{formatDate(status?.last_run_at ?? null)}</span>
      </span>
      <span className="ml-4">
        Last success: <span className="font-mono text-gray-700 dark:text-gray-300">{formatDate(status?.last_success_at ?? null)}</span>
      </span>
    </div>
  )

  const renderLevel2SubJob = (
    jobType: 'LEVEL2_RR' | 'LEVEL2_REPEX',
    status: ProcessingStatus | null,
    dependsOn: string,
    indentClass: string,
    control: ReactNode = renderControlSpacer(),
    collapsedHint?: string,
    action?: ReactNode,
  ) => {
    const label = getJobDisplayName(jobType)
    const badge = status
      ? <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(status.status)}`}>{status.status}</span>
      : <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-gray-100 text-gray-500 border-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600">UNKNOWN</span>

    return (
      <div className={`flex items-start gap-3 py-3 ${indentClass} border-b border-gray-200 dark:border-white/10 last:border-b-0`}>
        {control}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a href={`#${getCardId(jobType)}`} className="font-semibold text-sm text-blue-700 hover:underline dark:text-blue-300">{label}</a>
            {badge}
            <span className="text-xs text-gray-500 dark:text-gray-400">depends on: {getJobDisplayName(dependsOn)}</span>
            {collapsedHint && <span className="text-xs text-gray-500 dark:text-gray-400">• {collapsedHint}</span>}
          </div>
          {renderRowTimestamps(status)}
          {status?.error_message && (
            <p className="text-red-600 dark:text-red-400 text-xs mt-1 truncate" title={status.error_message}>
              ⚠️ {status.error_message}
            </p>
          )}
          {!status?.error_message && status?.status === 'RUNNING' && status?.progress_message && (
            <p className="text-blue-700 dark:text-blue-300 text-xs mt-1 truncate" title={status.progress_message}>
              ⏳ {status.progress_message}
            </p>
          )}
        </div>
        {action && <div className="shrink-0 flex items-start">{action}</div>}
      </div>
    )
  }

  if (loading && !fullStatus && !deltaStatus) {
    return <LoadingSpinner message="Loading LEI processing status..." />
  }

  const showFullChildren = fullExpanded || fullStatus?.status === 'RUNNING' || rrStatus?.status === 'RUNNING' || repexStatus?.status === 'RUNNING'
  const showRrChild = rrExpanded || rrStatus?.status === 'RUNNING' || repexStatus?.status === 'RUNNING'
  const backHref = isLoggedIn ? '/dashboard' : '/home'
  const backLabel = isLoggedIn ? '← Back to Dashboard' : '← Back to Home'

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="LEI Data Processing"
          subtitle="Real-time monitoring of GLEIF data synchronization"
          backHref={backHref}
          backLabel={backLabel}
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
          <Alert variant={triggerVariant} className="mb-6">
            {triggerMessage}
          </Alert>
        )}

        {/* Pipeline Overview */}
        <div className="mb-8 bg-white dark:bg-white/5 rounded-lg shadow-md p-6 border-2 border-gray-200 dark:border-white/10 backdrop-blur-sm">
          <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Job Pipeline</h2>
          <div className="space-y-1">
            {/* Root: Master Data Sync */}
            <div className="flex items-center gap-3 py-3 border-b border-gray-200 dark:border-white/10">
              {renderControlSpacer()}
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <a href={`#${getCardId('MASTER_DATA_SYNC')}`} className="font-semibold text-sm text-blue-700 hover:underline dark:text-blue-300">{getJobDisplayName('MASTER_DATA_SYNC')}</a>
                {masterDataStatus && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(masterDataStatus.status)}`}>
                    {masterDataStatus.status}
                  </span>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400">root job · daily · countries, currencies, languages</span>
                {renderRowTimestamps(masterDataStatus, 'w-full mt-1')}
              </div>
              <div className="shrink-0 flex items-center gap-3">
                {renderRowActionButton(
                  () => triggerJob('/api/v1/lei/sync/masterdata', 'Master data sync triggered'),
                  !canTriggerMasterData,
                  !canTriggerMasterData ? 'MASTER_DATA_SYNC is already running' : 'Trigger master/reference data sync',
                )}
              </div>
            </div>

            {/* Level 1 Full Sync — depends on MASTER_DATA_SYNC */}
            <div className="flex items-center gap-3 py-3 pl-4 border-b border-gray-200 dark:border-white/10">
              {renderDisclosureButton(
                showFullChildren,
                () => setFullExpanded((prev) => !prev),
                showFullChildren ? 'Collapse Level 2 jobs' : 'Expand Level 2 jobs',
              )}
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <a href={`#${getCardId('DAILY_FULL')}`} className="font-semibold text-sm text-blue-700 hover:underline dark:text-blue-300">{getJobDisplayName('DAILY_FULL')}</a>
                {fullStatus && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(fullStatus.status)}`}>
                    {fullStatus.status}
                  </span>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400">depends on: MASTER_DATA_SYNC</span>
                {!showFullChildren && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">• 2 child jobs hidden</span>
                )}
                {renderRowTimestamps(fullStatus, 'w-full mt-1')}
              </div>
              <div className="shrink-0 flex items-center gap-3">
                {renderRowActionButton(
                  () => triggerJob('/api/v1/lei/sync/full', 'Level 1 LEI Records sync triggered (DAILY_FULL)'),
                  !canTriggerFull,
                  !canTriggerFull ? 'Blocked while MASTER_DATA_SYNC or DAILY_FULL is running' : 'Trigger Level 1 LEI Records sync (DAILY_FULL)',
                )}
              </div>
            </div>

            {/* Level 2 dependent sub-jobs — accordion under DAILY_FULL */}
            {showFullChildren && (
              <>
                {renderLevel2SubJob(
                  'LEVEL2_RR',
                  rrStatus,
                  'DAILY_FULL',
                  'pl-8',
                  renderDisclosureButton(
                    showRrChild,
                    () => setRrExpanded((prev) => !prev),
                    showRrChild ? 'Collapse REPEX job' : 'Expand REPEX job',
                  ),
                  !showRrChild ? '1 child job hidden' : undefined,
                  <div className="flex items-center gap-2">
                    {renderRowActionButton(
                      () => triggerJob('/api/v1/lei/sync/level2/rr', 'Level 2 Relationship Records sync triggered (LEVEL2_RR)'),
                      !canTriggerRr,
                      !canTriggerRr ? 'Blocked while DAILY_FULL or LEVEL2_RR is running' : 'Trigger Level 2 Relationship Records sync only (LEVEL2_RR)',
                    )}
                  </div>,
                )}
                {showRrChild && renderLevel2SubJob(
                  'LEVEL2_REPEX',
                  repexStatus,
                  'LEVEL2_RR',
                  'pl-10',
                  renderControlSpacer(),
                  undefined,
                  renderRowActionButton(
                    () => triggerJob('/api/v1/lei/sync/level2/repex', 'Level 2 Reporting Exceptions sync triggered (LEVEL2_REPEX)'),
                    !canTriggerRepex,
                    !canTriggerRepex ? 'Blocked while DAILY_FULL, LEVEL2_RR, or LEVEL2_REPEX is running' : 'Trigger Level 2 Reporting Exceptions sync only (LEVEL2_REPEX)',
                  ),
                )}
              </>
            )}

            {/* Delta sync — separate root job (disabled) */}
            <div className="flex items-center gap-3 py-3 opacity-50">
              {renderControlSpacer()}
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <a href={`#${getCardId('DAILY_DELTA')}`} className="font-semibold text-sm text-blue-700 hover:underline dark:text-blue-300">{getJobDisplayName('DAILY_DELTA')}</a>
                <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">DISABLED</span>
                {renderRowTimestamps(deltaStatus, 'w-full mt-1')}
              </div>
              <div className="shrink-0">
                {renderRowActionButton(
                  () => triggerJob('/api/v1/lei/sync/delta', 'Delta sync triggered'),
                  !canTriggerDelta,
                  !canTriggerDelta ? 'Blocked while DAILY_FULL or DAILY_DELTA is running' : 'Trigger delta sync',
                )}
              </div>
            </div>
          </div>

          {/* Manual job triggers with dependency-aware disable rules */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Use the Run buttons on each row. Actions are disabled while blocking dependencies are running.
            </p>
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
