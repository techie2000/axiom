'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Alert from '../components/Alert'
import LoadingSpinner from '../components/LoadingSpinner'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../lib/api-base'
import { getAuthToken } from '../lib/auth-token'
import { formatDateTimeDisplay, isPlaceholderDateValue } from '../lib/date-display'
import { buildDocsUrl } from '../lib/docsLinks'

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

interface GleifListStats {
  records?: number
  files_saved?: number
  bytes_saved?: number
  source_type?: string
  source_url?: string
}

interface GleifSyncStats {
  run_at_utc?: string
  total_records?: number
  files_saved?: number
  bytes_saved?: number
  lists?: Record<string, GleifListStats>
}

interface ImportProgressStats {
  kind?: string
  evaluated?: number
  upserted?: number
  unchanged?: number
  failed?: number
  total?: number
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
  const { t } = useTranslation('common')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [gleifReferenceStatus, setGleifReferenceStatus] = useState<ProcessingStatus | null>(null)
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

  const API_BASE_URL = getApiBaseUrl()

  const fetchStatus = useCallback(async () => {
    try {
      const [
        gleifReferenceResponse,
        mdResponse,
        fullResponse,
        deltaResponse,
        rrResponse,
        repexResponse,
        countriesResponse,
        currenciesResponse,
        languagesResponse,
      ] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/lei/status/GLEIF_REFERENCE_SYNC`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/lei/status/MASTER_DATA_SYNC`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/lei/status/DAILY_FULL`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/lei/status/DAILY_DELTA`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/lei/status/LEVEL2_RR`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/lei/status/LEVEL2_REPEX`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/countries?limit=5000&offset=0`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/currencies?limit=5000&offset=0`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/v1/languages?limit=5000&offset=0`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
      ])

      if (gleifReferenceResponse?.ok) setGleifReferenceStatus(await gleifReferenceResponse.json())
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
    return formatDateTimeDisplay(dateString, 'Never')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return 'theme-filterchip border-[rgb(var(--ring-rgb))]'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700'
      case 'FAILED':
        return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700'
      case 'IDLE':
        return 'theme-subtle border-[rgb(var(--border-rgb))]'
      default:
        return 'theme-subtle border-[rgb(var(--border-rgb))]'
    }
  }

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'bg-[rgb(var(--primary-rgb))] animate-pulse'
      case 'COMPLETED': return 'bg-green-500'
      case 'FAILED': return 'bg-red-500'
      case 'IDLE': return 'bg-[rgb(var(--muted-foreground-rgb))]'
      default: return 'bg-[rgb(var(--muted-foreground-rgb))]'
    }
  }

  const getJobDisplayName = (jobType: string): string => {
    switch (jobType) {
      case 'GLEIF_REFERENCE_SYNC':
        return t('leiStatus.jobDisplay.gleifReferenceSync')
      case 'MASTER_DATA_SYNC':
        return t('leiStatus.jobDisplay.masterDataSync')
      case 'DAILY_FULL':
        return t('leiStatus.jobDisplay.dailyFull')
      case 'DAILY_DELTA':
        return t('leiStatus.jobDisplay.dailyDelta')
      case 'LEVEL2_RR':
        return t('leiStatus.jobDisplay.level2Rr')
      case 'LEVEL2_REPEX':
        return t('leiStatus.jobDisplay.level2Repex')
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

  const parseImportProgressStats = (progressMessage: string): ImportProgressStats | null => {
    if (!progressMessage.startsWith('{')) {
      return null
    }

    try {
      const parsed = JSON.parse(progressMessage) as ImportProgressStats
      if (parsed.kind !== 'level2-progress' && parsed.kind !== 'level1-progress') {
        return null
      }
      return parsed
    } catch {
      return null
    }
  }

  const formatImportProgressMessage = (progressMessage: string, stats: ImportProgressStats | null): string => {
    if (!stats) {
      return progressMessage
    }

    const parts: string[] = []

    if (typeof stats.upserted === 'number') {
      parts.push(`${stats.upserted.toLocaleString()} ${t('leiStatus.page.changedNew')}`)
    }

    if (typeof stats.unchanged === 'number') {
      parts.push(`${stats.unchanged.toLocaleString()} ${t('leiStatus.page.noChangeLower')}`)
    }

    if (typeof stats.failed === 'number' && stats.failed > 0) {
      parts.push(`${stats.failed.toLocaleString()} ${t('leiStatus.page.failedLower')}`)
    }

    return parts.length > 0 ? parts.join(' | ') : progressMessage
  }

  const getFrequencyLabel = (status: ProcessingStatus | null): string => {
    if (!status) return ''
    if (status.job_type === 'GLEIF_REFERENCE_SYNC') return 'On-demand / pre-step'
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

    if (status.next_run_at && !isPlaceholderDateValue(status.next_run_at)) {
      return { nextRun: status.next_run_at, ultimateParent: null }
    }

    const dep = status.depends_on_job_type
    if (!dep || dep === 'NONE') return { nextRun: null, ultimateParent: null }

    const statusByType: Record<string, ProcessingStatus | null> = {
      GLEIF_REFERENCE_SYNC: gleifReferenceStatus,
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

      if (parentSt.next_run_at && !isPlaceholderDateValue(parentSt.next_run_at)) {
        return { nextRun: parentSt.next_run_at, ultimateParent }
      }

      const nextDep: string | undefined = parentSt.depends_on_job_type || undefined
      if (!nextDep || nextDep === 'NONE') break
      ultimateParent = nextDep
      currentDep = nextDep
    }

    return { nextRun: null, ultimateParent: dep }
  }

  const isGleifReferenceRunning = gleifReferenceStatus?.status === 'RUNNING'
  const isMasterDataRunning = masterDataStatus?.status === 'RUNNING'
  const isFullSyncRunning = fullStatus?.status === 'RUNNING'
  const isDeltaRunning = deltaStatus?.status === 'RUNNING'
  const isRrRunning = rrStatus?.status === 'RUNNING'
  const isRepexRunning = repexStatus?.status === 'RUNNING'
  const hasGleifReferenceSuccess = Boolean(
    gleifReferenceStatus?.last_success_at && !isPlaceholderDateValue(gleifReferenceStatus.last_success_at),
  )

  const canTriggerGleifReference = !isGleifReferenceRunning && !isMasterDataRunning
  const canTriggerMasterData = !isMasterDataRunning
  const canTriggerFull = !isFullSyncRunning && !isMasterDataRunning && !isGleifReferenceRunning && hasGleifReferenceSuccess
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

  const getNextRunDisplay = (status: ProcessingStatus | null): string => {
    const { nextRun, ultimateParent } = getChainedNextRun(status)
    const dependsOn = status?.depends_on_job_type
    const hasDependency = Boolean(dependsOn && dependsOn !== 'NONE')
    if (!nextRun) {
      return hasDependency && dependsOn ? `${t('leiStatus.page.after')} ${getJobDisplayName(dependsOn)}` : t('leiStatus.page.never')
    }
    if (ultimateParent) return `≥ ${formatDate(nextRun)} (${t('leiStatus.page.afterLower')} ${getJobDisplayName(ultimateParent)})`
    return formatDate(nextRun)
  }

  const formatGleifBreakdown = (lists?: Record<string, GleifListStats>): string => {
    if (!lists || Object.keys(lists).length === 0) {
      return '-'
    }

    return Object.entries(lists)
      .map(([name, stats]) => `${name}: ${typeof stats.records === 'number' ? stats.records.toLocaleString() : 0}`)
      .join(', ')
  }

  const formatGleifListNames = (lists?: Record<string, GleifListStats>): string => {
    if (!lists || Object.keys(lists).length === 0) {
      return t('leiStatus.page.gleifReferenceCodeLists')
    }

    return Object.keys(lists).join(', ')
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
            ? 'bg-[rgb(var(--surface-muted-rgb))] dark:bg-[rgb(var(--surface-muted-rgb))]/30 border-[rgb(var(--border-rgb))] dark:border-[rgb(var(--border-rgb))] opacity-60'
            : 'bg-white/5 backdrop-blur-sm border-white/10'
        }`}>
          <h2 className="text-2xl font-bold mb-4">{title}</h2>
          <p className="opacity-70">{t('leiStatus.page.noStatusData')}</p>
        </div>
      )
    }

    const fallbackProgress = calculateProgress(status)
    const file = status.current_source_file
    const isImportJob = jobKey === 'DAILY_FULL' || jobKey === 'DAILY_DELTA' || jobKey === 'LEVEL2_RR' || jobKey === 'LEVEL2_REPEX'
    const isMasterDataJob = jobKey === 'MASTER_DATA_SYNC'
    const progressMessage = status.progress_message?.trim() || ''
    const importStats = (jobKey === 'DAILY_FULL' || jobKey === 'DAILY_DELTA' || jobKey === 'LEVEL2_RR' || jobKey === 'LEVEL2_REPEX')
      ? parseImportProgressStats(progressMessage)
      : null
    const displayProgressMessage = formatImportProgressMessage(progressMessage, importStats)
    let gleifStats: GleifSyncStats | null = null
    if (jobKey === 'GLEIF_REFERENCE_SYNC' && progressMessage.startsWith('{')) {
      try {
        gleifStats = JSON.parse(progressMessage) as GleifSyncStats
      } catch {
        gleifStats = null
      }
    }
    const fallbackTotalRecords = isMasterDataJob ? (masterDataCounts?.total ?? 0) : 0
    const totalRecords = file ? file.total_records : (gleifStats?.total_records ?? fallbackTotalRecords)
    const evaluatedRecords = importStats?.evaluated ?? (file ? file.processed_records : (gleifStats?.total_records ?? fallbackTotalRecords))
    const failedRecords = importStats?.failed ?? (file ? file.failed_records : 0)
    const hasAuthoritativeImportBreakdown = Boolean(importStats && typeof importStats.upserted === 'number' && typeof importStats.unchanged === 'number')
    const upsertedRecords = hasAuthoritativeImportBreakdown ? importStats?.upserted ?? null : null
    const unchangedRecords = hasAuthoritativeImportBreakdown ? importStats?.unchanged ?? null : null
    const progress = totalRecords > 0
      ? (Math.min(evaluatedRecords, totalRecords) / totalRecords) * 100
      : fallbackProgress
    const gleifReferencePath = 'data/main/lei/gleif-reference'
    const currentFileLabel = file?.file_name || (isMasterDataJob
      ? t('leiStatus.page.masterDatasetsSummary')
      : (jobKey === 'GLEIF_REFERENCE_SYNC' ? t('leiStatus.page.persistedUnderPath', { path: gleifReferencePath }) : '-'))
    const currentFileSummaryLabel = jobKey === 'GLEIF_REFERENCE_SYNC'
      ? formatGleifListNames(gleifStats?.lists)
      : currentFileLabel
    const frequency = getFrequencyLabel(status)
    const dependency = status.depends_on_job_type && status.depends_on_job_type !== 'NONE'
      ? getJobDisplayName(status.depends_on_job_type)
      : t('leiStatus.page.none')
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
          ? 'bg-[rgb(var(--surface-muted-rgb))] dark:bg-[rgb(var(--surface-muted-rgb))]/30 border-[rgb(var(--border-rgb))] dark:border-[rgb(var(--border-rgb))] opacity-60'
          : 'bg-white/5 backdrop-blur-sm border-white/10'
      }`}>
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleCardExpand(jobKey)}
              disabled={!canToggle}
              className="px-3 py-1 rounded-full text-xs font-semibold border border-[rgb(var(--border-rgb))] text-[rgb(var(--muted-foreground-rgb))] hover:bg-[rgb(var(--surface-muted-rgb))] dark:border-[rgb(var(--border-rgb))] dark:text-[rgb(var(--muted-foreground-rgb))] dark:hover:bg-[rgb(var(--surface-muted-rgb))] disabled:opacity-60 disabled:cursor-not-allowed"
              title={canToggle
                ? (isExpanded ? t('leiStatus.page.collapseDetails') : t('leiStatus.page.expandDetails'))
                : t('leiStatus.page.runningJobsStayExpanded')}
            >
              {isExpanded ? t('leiStatus.page.collapse') : t('leiStatus.page.expand')}
            </button>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold border-2 ${getStatusColor(status.status)}`}>
              {status.status}
            </span>
          </div>
        </div>

        <div className="mb-4 bg-[rgb(var(--surface-muted-rgb))] rounded-lg p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.schedule')}:</span>
              <span className="font-medium text-[rgb(var(--foreground-rgb))]">{frequency || t('leiStatus.page.notAvailable')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.dependsOn')}:</span>
              <span className="font-medium text-[rgb(var(--foreground-rgb))]">{dependency}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm mb-4">
          <div className="flex justify-between">
            <span className="text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.lastRun')}:</span>
            <span className="font-medium text-[rgb(var(--foreground-rgb))]">{formatDate(status.last_run_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.lastSuccess')}:</span>
            <span className="font-medium text-[rgb(var(--foreground-rgb))]">{formatDate(status.last_success_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.nextRun')}:</span>
            <span className="font-medium text-[rgb(var(--foreground-rgb))]">
              {getNextRunDisplay(status)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.currentFile')}:</span>
            <span className="font-medium text-[rgb(var(--foreground-rgb))] truncate max-w-[70%] text-right">
              {currentFileSummaryLabel}
            </span>
          </div>
        </div>

        {isExpanded && (
          <>
            {file && status.status === 'RUNNING' && (
              <div className="mb-6">
                {progressMessage && (
                  <p className="text-sm text-[rgb(var(--primary-rgb))] dark:text-[rgb(var(--primary-rgb))] mb-2">⏳ {displayProgressMessage}</p>
                )}
                {file.total_records > 0 ? (
                  <>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium text-[rgb(var(--foreground-rgb))]">{t('leiStatus.page.processingProgress')}:</span>
                      <span className="text-[rgb(var(--muted-foreground-rgb))]">
                        {evaluatedRecords.toLocaleString()} / {file.total_records.toLocaleString()} {t('leiStatus.page.records')} ({progress.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-[rgb(var(--surface-muted-rgb))] dark:bg-[rgb(var(--surface-muted-rgb))] rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-[rgb(var(--primary-rgb))] dark:bg-[rgb(var(--surface-soft-rgb))]0 h-4 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-[rgb(var(--muted-foreground-rgb))]">
                    <p className="mb-2">
                      ⏳ {displayProgressMessage || t('leiStatus.page.preparingFile')} ({evaluatedRecords.toLocaleString()} {t('leiStatus.page.recordsEvaluated')})
                    </p>
                    <div className="w-full bg-[rgb(var(--surface-muted-rgb))] dark:bg-[rgb(var(--surface-muted-rgb))] rounded-full h-4 overflow-hidden">
                      <div className="bg-[rgb(var(--primary-rgb))] dark:bg-[rgb(var(--surface-soft-rgb))]0 h-4 rounded-full animate-pulse" style={{ width: '30%' }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mb-4 bg-[rgb(var(--surface-muted-rgb))] rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-sm text-[rgb(var(--muted-foreground-rgb))] dark:text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.processingSummary')}</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.totalRecords')}:</span>
                  <span className="font-medium text-[rgb(var(--foreground-rgb))]">
                    {totalRecords > 0 ? totalRecords.toLocaleString() : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.recordsEvaluatedTitle')}:</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {totalRecords > 0 ? evaluatedRecords.toLocaleString() : '-'}
                  </span>
                </div>
                {(jobKey === 'DAILY_FULL' || jobKey === 'DAILY_DELTA' || jobKey === 'LEVEL2_RR' || jobKey === 'LEVEL2_REPEX') && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.upsertedChangedNew')}:</span>
                      <span className="font-medium text-[rgb(var(--foreground-rgb))]">
                        {totalRecords > 0 && typeof upsertedRecords === 'number' ? upsertedRecords.toLocaleString() : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.noChange')}:</span>
                      <span className="font-medium text-[rgb(var(--foreground-rgb))]">
                        {totalRecords > 0 && typeof unchangedRecords === 'number' ? unchangedRecords.toLocaleString() : '-'}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.failedRecords')}:</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${failedRecords > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-[rgb(var(--foreground-rgb))]'}`}>
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
                        {level2FailuresOpen ? t('leiStatus.page.hideDetails') : t('leiStatus.page.viewDetails')}
                      </button>
                    )}
                  </div>
                </div>
                {jobKey === 'GLEIF_REFERENCE_SYNC' && gleifStats && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.filesSaved')}:</span>
                      <span className="font-medium text-[rgb(var(--foreground-rgb))]">
                        {typeof gleifStats.files_saved === 'number' ? gleifStats.files_saved.toLocaleString() : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.bytesSaved')}:</span>
                      <span className="font-medium text-[rgb(var(--foreground-rgb))]">
                        {typeof gleifStats.bytes_saved === 'number' ? gleifStats.bytes_saved.toLocaleString() : '-'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {isImportJob && level2JobKey && level2FailuresOpen && (
              <div className="bg-[rgb(var(--surface-muted-rgb))] rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm text-[rgb(var(--muted-foreground-rgb))] dark:text-[rgb(var(--muted-foreground-rgb))]">
                    {t('leiStatus.page.failedRecords')} {level2OpenOnly ? t('leiStatus.page.openOnlySuffix') : t('leiStatus.page.openResolvedSuffix')}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void switchLevel2FailureMode(level2JobKey, true)}
                      className={`text-xs px-2 py-1 rounded border ${level2OpenOnly
                        ? 'theme-filterchip border-[rgb(var(--ring-rgb))]'
                        : 'theme-btn-neutral'
                      }`}
                    >
                      {t('leiStatus.page.openOnly')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void switchLevel2FailureMode(level2JobKey, false)}
                      className={`text-xs px-2 py-1 rounded border ${!level2OpenOnly
                        ? 'theme-filterchip border-[rgb(var(--ring-rgb))]'
                        : 'theme-btn-neutral'
                      }`}
                    >
                      {t('leiStatus.page.includeResolved')}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[rgb(var(--muted-foreground-rgb))] mb-3">
                  {t('leiStatus.page.showingRecords', {
                    shown: level2Failures.length.toLocaleString(),
                    total: level2FailuresTotal.toLocaleString(),
                  })}
                </p>

                {level2FailuresLoading && (
                  <p className="text-sm text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.loadingFailureDetails')}</p>
                )}

                {!level2FailuresLoading && level2FailuresError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{level2FailuresError}</p>
                )}

                {!level2FailuresLoading && !level2FailuresError && level2Failures.length === 0 && (
                  <p className="text-sm text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.noMatchingFailedRecords')}</p>
                )}

                {!level2FailuresLoading && !level2FailuresError && level2Failures.length > 0 && (
                  <div className="space-y-2 max-h-72 overflow-y-auto theme-scrollbar">
                    {level2Failures.map((failure) => (
                      <div key={failure.id} className="rounded border border-[rgb(var(--border-rgb))] p-3 bg-[rgb(var(--surface-rgb))]/30">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-[rgb(var(--muted-foreground-rgb))] dark:text-[rgb(var(--muted-foreground-rgb))]">{failure.failure_stage}</span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${failure.resolved
                            ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-300'
                            : 'border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-300'
                          }`}>
                            {failure.resolved ? t('leiStatus.page.resolved') : t('leiStatus.page.open')}
                          </span>
                        </div>
                        <p className="text-xs text-[rgb(var(--muted-foreground-rgb))] dark:text-[rgb(var(--muted-foreground-rgb))] break-all">
                          <span className="font-medium">{t('leiStatus.page.key')}:</span> {failure.natural_key || t('leiStatus.page.noneLower')}
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1 break-words">{failure.error_message}</p>
                        <p className="text-[11px] text-[rgb(var(--muted-foreground-rgb))] mt-1">
                          {t('leiStatus.page.raised')}: {formatDate(failure.created_at)}
                          {failure.resolved_at ? ` • ${t('leiStatus.page.resolvedAt')}: ${formatDate(failure.resolved_at)}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="bg-[rgb(var(--surface-muted-rgb))] rounded-lg p-4 mb-4">
              <h3 className="font-semibold mb-2 text-sm text-[rgb(var(--muted-foreground-rgb))] dark:text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.currentFile')}</h3>
              <div className="space-y-1 text-sm text-[rgb(var(--foreground-rgb))]">
                <p className="truncate"><span className="font-medium text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.name')}:</span> {currentFileLabel}</p>
                <p><span className="font-medium text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.status')}:</span> {file?.processing_status || status.status}</p>
                <p><span className="font-medium text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.totalRecords')}:</span> {totalRecords > 0 ? totalRecords.toLocaleString() : '-'}</p>
                <p><span className="font-medium text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.processed')}:</span> {totalRecords > 0 ? `${evaluatedRecords.toLocaleString()} ${t('leiStatus.page.records')}` : '-'}</p>
                {(jobKey === 'DAILY_FULL' || jobKey === 'DAILY_DELTA' || jobKey === 'LEVEL2_RR' || jobKey === 'LEVEL2_REPEX') && (
                  <>
                    <p><span className="font-medium text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.upserted')}:</span> {totalRecords > 0 && typeof upsertedRecords === 'number' ? `${upsertedRecords.toLocaleString()} ${t('leiStatus.page.records')}` : '-'}</p>
                    <p><span className="font-medium text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.noChange')}:</span> {totalRecords > 0 && typeof unchangedRecords === 'number' ? `${unchangedRecords.toLocaleString()} ${t('leiStatus.page.records')}` : '-'}</p>
                  </>
                )}
                {(jobKey === 'DAILY_FULL' || jobKey === 'DAILY_DELTA' || jobKey === 'LEVEL2_RR' || jobKey === 'LEVEL2_REPEX') && (
                  <p className="truncate"><span className="font-medium text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.lastLei')}:</span> {file?.last_processed_lei || '-'}</p>
                )}
                {jobKey === 'GLEIF_REFERENCE_SYNC' && gleifStats?.run_at_utc && (
                  <p><span className="font-medium text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.snapshotRun')}:</span> {formatDate(gleifStats.run_at_utc)}</p>
                )}
                {status.status === 'RUNNING' && progressMessage && (
                  <p className="text-[rgb(var(--primary-rgb))] dark:text-[rgb(var(--primary-rgb))]">
                    <span className="font-medium">{t('leiStatus.page.progress')}:</span> {displayProgressMessage}
                  </p>
                )}
                {jobKey === 'GLEIF_REFERENCE_SYNC' && gleifStats?.lists && (
                  <p className="break-words">
                    <span className="font-medium text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.breakdown')}</span>{' '}
                    {formatGleifBreakdown(gleifStats.lists)}
                  </p>
                )}
                {isMasterDataJob && masterDataCounts && (
                  <p>
                    <span className="font-medium text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.breakdown')}</span>{' '}
                    {`Countries ${masterDataCounts.countries.toLocaleString()}, Currencies ${masterDataCounts.currencies.toLocaleString()}, Languages ${masterDataCounts.languages.toLocaleString()}`}
                  </p>
                )}
                {file?.failure_category && (
                  <p className="text-red-600 dark:text-red-400">
                    <span className="font-medium">{t('leiStatus.page.errorCategory')}:</span> {file.failure_category}
                  </p>
                )}
                {file?.processing_error && (
                  <p className="text-red-600 dark:text-red-400 text-xs mt-2">
                    <span className="font-medium">{t('leiStatus.page.error')}:</span> {file.processing_error}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {status.error_message && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-300">
              <span className="font-semibold">{t('leiStatus.page.error')}:</span> {status.error_message}
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
      className="w-5 h-5 shrink-0 inline-flex items-center justify-center rounded-md border border-transparent bg-transparent text-[rgb(var(--muted-foreground-rgb))] hover:border-[rgb(var(--border-rgb))] hover:bg-[rgb(var(--surface-muted-rgb))]/80 hover:text-[rgb(var(--muted-foreground-rgb))] focus-visible:outline-none focus-visible:border-[rgb(var(--border-rgb))] dark:text-[rgb(var(--muted-foreground-rgb))] dark:hover:border-white/25 dark:hover:bg-white/10 dark:hover:text-[rgb(var(--muted-foreground-rgb))] dark:focus-visible:border-white/35"
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
      className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-transparent bg-transparent text-[rgb(var(--muted-foreground-rgb))] hover:border-[rgb(var(--border-rgb))] hover:bg-[rgb(var(--surface-muted-rgb))]/80 hover:text-[rgb(var(--muted-foreground-rgb))] focus-visible:outline-none focus-visible:border-[rgb(var(--border-rgb))] disabled:opacity-50 disabled:cursor-not-allowed dark:text-[rgb(var(--muted-foreground-rgb))] dark:hover:border-white/25 dark:hover:bg-white/10 dark:hover:text-[rgb(var(--muted-foreground-rgb))] dark:focus-visible:border-white/35"
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
    <div className={`${className} text-xs text-[rgb(var(--muted-foreground-rgb))]`}>
      <span>
        {t('leiStatus.page.lastRun')}: <span className="font-mono text-[rgb(var(--muted-foreground-rgb))]">{formatDate(status?.last_run_at ?? null)}</span>
      </span>
      <span className="ml-4">
        {t('leiStatus.page.lastSuccess')}: <span className="font-mono text-[rgb(var(--muted-foreground-rgb))]">{formatDate(status?.last_success_at ?? null)}</span>
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
      : <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-[rgb(var(--surface-muted-rgb))] text-[rgb(var(--muted-foreground-rgb))] border-[rgb(var(--border-rgb))] dark:bg-[rgb(var(--surface-muted-rgb))] dark:text-[rgb(var(--muted-foreground-rgb))] dark:border-[rgb(var(--border-rgb))]">UNKNOWN</span>

    return (
      <div className={`flex items-start gap-3 py-3 ${indentClass} border-b border-[rgb(var(--border-rgb))] last:border-b-0`}>
        {control}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a href={`#${getCardId(jobType)}`} className="font-semibold text-sm theme-link hover:underline">{label}</a>
            {badge}
            <span className="text-xs text-[rgb(var(--muted-foreground-rgb))]">depends on: {getJobDisplayName(dependsOn)}</span>
            {collapsedHint && <span className="text-xs text-[rgb(var(--muted-foreground-rgb))]">• {collapsedHint}</span>}
          </div>
          {renderRowTimestamps(status)}
          {status?.error_message && (
            <p className="text-red-600 dark:text-red-400 text-xs mt-1 truncate" title={status.error_message}>
              ⚠️ {status.error_message}
            </p>
          )}
          {!status?.error_message && status?.status === 'RUNNING' && status?.progress_message && (
            <p className="text-[rgb(var(--primary-rgb))] dark:text-[rgb(var(--primary-rgb))] text-xs mt-1 truncate" title={formatImportProgressMessage(status.progress_message, parseImportProgressStats(status.progress_message))}>
              ⏳ {formatImportProgressMessage(status.progress_message, parseImportProgressStats(status.progress_message))}
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

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="LEI Data Processing"
          subtitle="Real-time monitoring of GLEIF data synchronization"
          backHref={backHref}
          docsHref={buildDocsUrl('workflows/entities/')}
          actions={
            <>
              <button
                onClick={fetchStatus}
                className="h-9 px-3 inline-flex items-center justify-center theme-btn-primary rounded-lg transition-colors text-sm font-medium"
              >
                🔄 {t('leiStatus.page.refreshNow')}
              </button>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm opacity-70">{t('leiStatus.page.autoRefresh')}</span>
              </label>
            </>
          }
        />

        {error && (
          <Alert variant="error" title={`${t('leiStatus.page.connectionError')}:`} className="mb-6">
            {error}
            <p className="text-sm mt-1 opacity-80">
              {t('leiStatus.page.connectionErrorHint')}
            </p>
          </Alert>
        )}

        {triggerMessage && (
          <Alert variant={triggerVariant} className="mb-6">
            {triggerMessage}
          </Alert>
        )}

        {/* Pipeline Overview */}
        <div className="mb-8 bg-white dark:bg-white/5 rounded-lg shadow-md p-6 border-2 border-[rgb(var(--border-rgb))] backdrop-blur-sm">
          <h2 className="text-lg font-bold mb-4 text-[rgb(var(--foreground-rgb))]">Job Pipeline</h2>
          <div className="space-y-1">
            {/* Root: Master Data Sync */}
            <div className="flex items-center gap-3 py-3 border-b border-[rgb(var(--border-rgb))]">
              {renderControlSpacer()}
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <a href={`#${getCardId('MASTER_DATA_SYNC')}`} className="font-semibold text-sm theme-link hover:underline">{getJobDisplayName('MASTER_DATA_SYNC')}</a>
                {masterDataStatus && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(masterDataStatus.status)}`}>
                    {masterDataStatus.status}
                  </span>
                )}
                <span className="text-xs text-[rgb(var(--muted-foreground-rgb))]">root job · daily · countries, currencies, languages</span>
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

            {/* GLEIF reference code-list sync — depends on MASTER_DATA_SYNC */}
            <div className="flex items-center gap-3 py-3 pl-4 border-b border-[rgb(var(--border-rgb))]">
              {renderControlSpacer()}
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <a href={`#${getCardId('GLEIF_REFERENCE_SYNC')}`} className="font-semibold text-sm theme-link hover:underline">{getJobDisplayName('GLEIF_REFERENCE_SYNC')}</a>
                {gleifReferenceStatus && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(gleifReferenceStatus.status)}`}>
                    {gleifReferenceStatus.status}
                  </span>
                )}
                <span className="text-xs text-[rgb(var(--muted-foreground-rgb))]">depends on: MASTER_DATA_SYNC · must succeed before ingest</span>
                {renderRowTimestamps(gleifReferenceStatus, 'w-full mt-1')}
              </div>
              <div className="shrink-0 flex items-center gap-3">
                {renderRowActionButton(
                  () => triggerJob('/api/v1/lei/sync/gleif-reference', 'GLEIF reference sync triggered'),
                  !canTriggerGleifReference,
                  !canTriggerGleifReference ? 'Blocked while MASTER_DATA_SYNC or GLEIF_REFERENCE_SYNC is running' : 'Trigger GLEIF reference code-list sync',
                )}
              </div>
            </div>

            {/* Level 1 Full Sync — depends on MASTER_DATA_SYNC */}
            <div className="flex items-center gap-3 py-3 pl-4 border-b border-[rgb(var(--border-rgb))]">
              {renderDisclosureButton(
                showFullChildren,
                () => setFullExpanded((prev) => !prev),
                showFullChildren ? 'Collapse Level 2 jobs' : 'Expand Level 2 jobs',
              )}
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <a href={`#${getCardId('DAILY_FULL')}`} className="font-semibold text-sm theme-link hover:underline">{getJobDisplayName('DAILY_FULL')}</a>
                {fullStatus && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(fullStatus.status)}`}>
                    {fullStatus.status}
                  </span>
                )}
                <span className="text-xs text-[rgb(var(--muted-foreground-rgb))]">depends on: GLEIF_REFERENCE_SYNC</span>
                {!showFullChildren && (
                  <span className="text-xs text-[rgb(var(--muted-foreground-rgb))]">• 2 child jobs hidden</span>
                )}
                {renderRowTimestamps(fullStatus, 'w-full mt-1')}
              </div>
              <div className="shrink-0 flex items-center gap-3">
                {renderRowActionButton(
                  () => triggerJob('/api/v1/lei/sync/full', 'Level 1 LEI Records sync triggered (DAILY_FULL)'),
                  !canTriggerFull,
                  !canTriggerFull
                    ? 'Blocked until GLEIF_REFERENCE_SYNC has completed successfully and no blocking jobs are running'
                    : 'Trigger Level 1 LEI Records sync (DAILY_FULL)',
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
                    showRrChild
                      ? t('leiStatus.pipeline.collapseReportingExceptionsJob')
                      : t('leiStatus.pipeline.expandReportingExceptionsJob'),
                  ),
                  !showRrChild ? '1 child job hidden' : undefined,
                  <div className="flex items-center gap-2">
                    {renderRowActionButton(
                      () => triggerJob('/api/v1/lei/sync/level2/rr', t('leiStatus.pipeline.rrTriggered')),
                      !canTriggerRr,
                      !canTriggerRr
                        ? t('leiStatus.pipeline.rrBlocked')
                        : t('leiStatus.pipeline.triggerOnlyRr'),
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
                    () => triggerJob('/api/v1/lei/sync/level2/repex', t('leiStatus.pipeline.repexTriggered')),
                    !canTriggerRepex,
                    !canTriggerRepex
                      ? t('leiStatus.pipeline.repexBlocked')
                      : t('leiStatus.pipeline.triggerOnlyRepex'),
                  ),
                )}
              </>
            )}

            {/* Delta sync — separate root job (disabled) */}
            <div className="flex items-center gap-3 py-3 opacity-50">
              {renderControlSpacer()}
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <a href={`#${getCardId('DAILY_DELTA')}`} className="font-semibold text-sm theme-link hover:underline">{getJobDisplayName('DAILY_DELTA')}</a>
                <span className="text-xs theme-subtle px-2 py-0.5 rounded">DISABLED</span>
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
          <div className="mt-4 pt-4 border-t border-[rgb(var(--border-rgb))]">
            <p className="text-sm text-[rgb(var(--muted-foreground-rgb))]">
              Use the Run buttons on each row. Actions are disabled while blocking dependencies are running.
            </p>
          </div>
        </div>

        {/* Detailed Status Cards */}
        <div className="space-y-6 mb-6">
          {renderStatusCard(getJobDisplayName('MASTER_DATA_SYNC'), masterDataStatus, false, getCardId('MASTER_DATA_SYNC'), 'MASTER_DATA_SYNC')}
          {renderStatusCard(getJobDisplayName('GLEIF_REFERENCE_SYNC'), gleifReferenceStatus, false, getCardId('GLEIF_REFERENCE_SYNC'), 'GLEIF_REFERENCE_SYNC')}
          {renderStatusCard(getJobDisplayName('DAILY_FULL'), fullStatus, false, getCardId('DAILY_FULL'), 'DAILY_FULL')}
          {renderStatusCard(getJobDisplayName('LEVEL2_RR'), rrStatus, false, getCardId('LEVEL2_RR'), 'LEVEL2_RR')}
          {renderStatusCard(getJobDisplayName('LEVEL2_REPEX'), repexStatus, false, getCardId('LEVEL2_REPEX'), 'LEVEL2_REPEX')}
          <div className="relative">
            {renderStatusCard(getJobDisplayName('DAILY_DELTA'), deltaStatus, true, getCardId('DAILY_DELTA'), 'DAILY_DELTA')}
            <div className="absolute top-4 right-4 bg-[rgb(var(--surface-muted-rgb))] text-white text-xs px-2 py-1 rounded">
              DISABLED
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white dark:bg-white/5 rounded-lg shadow-md p-4 border-2 border-[rgb(var(--border-rgb))]">
          <h3 className="font-semibold mb-3 text-[rgb(var(--muted-foreground-rgb))] dark:text-[rgb(var(--muted-foreground-rgb))]">{ t('leiStatus.page.legendTitle')}</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full font-semibold border-2 ${getStatusColor('IDLE')}`}>{t('leiStatus.page.statusIdle')}</span>
              <span className="text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.legendIdle')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full font-semibold border-2 ${getStatusColor('RUNNING')}`}>{t('leiStatus.page.statusRunning')}</span>
              <span className="text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.legendRunning')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full font-semibold border-2 ${getStatusColor('FAILED')}`}>{t('leiStatus.page.statusFailed')}</span>
              <span className="text-[rgb(var(--muted-foreground-rgb))]">{t('leiStatus.page.legendFailed')}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-[rgb(var(--muted-foreground-rgb))]">
          <p>{t('leiStatus.page.dataSourceFooter')}</p>
        </div>
      </div>
    </div>
  )
}
