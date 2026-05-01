'use client'

import { MouseEvent as ReactMouseEvent, useState, useEffect, useCallback, Suspense, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/PageHeader'
import SortableHeaderCell from '../../components/SortableHeaderCell'
import SearchInputWithOverflowTooltip from '../../components/SearchInputWithOverflowTooltip'
import Alert from '../../components/Alert'
import Badge from '../../components/Badge'
import LoadingSpinner from '../../components/LoadingSpinner'
import PreferenceSavePrompt from '../../components/PreferenceSavePrompt'
import ThemedSelect from '../../components/ThemedSelect'
import LEIAuditHistoryModal from '../../components/LEIAuditHistoryModal'
import { getApiBaseUrl } from '../../lib/api-base'
import { getAuthToken } from '../../lib/auth-token'
import { PROVISIONAL_BADGE_VARIANT } from '../../lib/badge-presets'
import { buildDocsUrl } from '../../lib/docsLinks'
import { useDeferredBooleanPreference } from '../../lib/useDeferredBooleanPreference'
import { useEnglishTooltips } from '../../lib/useEnglishTooltips'
import { useSearchFocusShortcut } from '../../lib/useSearchFocusShortcut'
import { useUserPreference } from '../../lib/useUserPreference'
import { ensureLeadingEmoji, useButtonEmojiMode } from '../../lib/useButtonEmojiMode'
import { getRelatedLeiNotFoundErrorKey, isCompleteLei, ProvisionalLeiLookupField } from '@/app/lib/provisional-lei-lookup'

const API_BASE_URL = getApiBaseUrl()

interface ProvisionalLEI {
  id: string
  lei: string
  legal_name: string
  legal_address_country: string
  legal_address_city: string
  legal_jurisdiction: string
  entity_status: string
  provisioning_source: string
  successor_lei: string
  notes?: string
  is_provisional: boolean
  created_at: string
  updated_at: string
  // Parent/child relationships are hydrated from lei_relationship_records (level 2 data)
  parent_lei?: string
  child_lei?: string
}

type ProvisionalColumnKey =
  | 'lei'
  | 'legal_name'
  | 'provisioning_source'
  | 'entity_status'
  | 'successor_lei'
  | 'parent_lei'
  | 'legal_address_country'
  | 'legal_address_city'
  | 'legal_jurisdiction'
  | 'notes'
  | 'created_at'
  | 'updated_at'

interface ProvisionalColumn {
  key: ProvisionalColumnKey
  labelKey: string
  groupKey: string
  defaultVisible: boolean
  width: string
}

const PROVISIONAL_COLUMNS: ProvisionalColumn[] = [
  // Core fields
  { key: 'lei', labelKey: 'provisionalLei.columns.lei', groupKey: 'provisionalLei.columns.groups.core', defaultVisible: true, width: 'w-44' },
  { key: 'legal_name', labelKey: 'provisionalLei.columns.legalName', groupKey: 'provisionalLei.columns.groups.core', defaultVisible: true, width: 'min-w-96' },
  { key: 'provisioning_source', labelKey: 'provisionalLei.columns.source', groupKey: 'provisionalLei.columns.groups.core', defaultVisible: true, width: 'w-32' },
  { key: 'entity_status', labelKey: 'provisionalLei.columns.status', groupKey: 'provisionalLei.columns.groups.core', defaultVisible: true, width: 'w-32' },
  
  // Associated Entities
  { key: 'successor_lei', labelKey: 'provisionalLei.columns.successorLei', groupKey: 'provisionalLei.columns.groups.associated', defaultVisible: true, width: 'w-44' },
  { key: 'parent_lei', labelKey: 'provisionalLei.columns.parentLei', groupKey: 'provisionalLei.columns.groups.associated', defaultVisible: true, width: 'w-44' },
  
  // Address
  { key: 'legal_address_country', labelKey: 'provisionalLei.columns.country', groupKey: 'provisionalLei.columns.groups.address', defaultVisible: true, width: 'w-24' },
  { key: 'legal_address_city', labelKey: 'provisionalLei.columns.city', groupKey: 'provisionalLei.columns.groups.address', defaultVisible: true, width: 'w-32' },
  { key: 'legal_jurisdiction', labelKey: 'provisionalLei.columns.jurisdiction', groupKey: 'provisionalLei.columns.groups.address', defaultVisible: true, width: 'w-32' },
  
  // Metadata
  { key: 'notes', labelKey: 'provisionalLei.columns.notes', groupKey: 'provisionalLei.columns.groups.metadata', defaultVisible: false, width: 'min-w-64' },
  
  // Dates
  { key: 'created_at', labelKey: 'provisionalLei.columns.created', groupKey: 'provisionalLei.columns.groups.dates', defaultVisible: true, width: 'w-32' },
  { key: 'updated_at', labelKey: 'provisionalLei.columns.updated', groupKey: 'provisionalLei.columns.groups.dates', defaultVisible: false, width: 'w-32' },
]

const DEFAULT_VISIBLE_KEYS = PROVISIONAL_COLUMNS.filter((column) => column.defaultVisible)
  .map((column) => column.key)
  .join(',')

interface CreateForm {
  legal_name: string
  legal_address_country: string
  legal_address_city: string
  legal_jurisdiction: string
  provisioning_source: string
  notes: string
  parent_lei: string
}

interface EditForm {
  legal_name: string
  legal_address_country: string
  legal_address_city: string
  legal_jurisdiction: string
  entity_status: string
  provisioning_source: string
  notes: string
  parent_lei: string
}

const EMPTY_CREATE: CreateForm = {
  legal_name: '',
  legal_address_country: '',
  legal_address_city: '',
  legal_jurisdiction: '',
  provisioning_source: '',
  notes: '',
  parent_lei: '',
}

const ENTITY_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'ACTIVE' },
  { value: 'INACTIVE', label: 'INACTIVE' },
  { value: 'MERGED', label: 'MERGED' },
]

function statusBadge(status: string) {
  const cls =
    status?.toUpperCase() === 'ACTIVE'
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      : status?.toUpperCase() === 'MERGED'
        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
        : 'theme-subtle'
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>
      {status || '—'}
    </span>
  )
}

function ProvisionalLEIContent() {
  const { t } = useTranslation('common')
  const { getEnglishTooltip } = useEnglishTooltips()
  const { formatLabel } = useButtonEmojiMode()
  const router = useRouter()

  const [records, setRecords] = useState<ProvisionalLEI[]>([])
  const [countryNameByCode, setCountryNameByCode] = useState<Map<string, string>>(new Map())
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [sortColumn, setSortColumn] = useState<ProvisionalColumnKey | ''>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE)
  const [editTarget, setEditTarget] = useState<ProvisionalLEI | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [leiNames, setLeiNames] = useState<Record<string, string>>({})
  const [leiLookupLoading, setLeiLookupLoading] = useState<Record<string, boolean>>({})
  const [leiLookupError, setLeiLookupError] = useState<Record<string, string>>({})
  const [succeedTarget, setSucceedTarget] = useState<ProvisionalLEI | null>(null)
  const [officialLEI, setOfficialLEI] = useState('')
  const [succeedLeiError, setSucceedLeiError] = useState('')
  const [succeedLeiValidating, setSucceedLeiValidating] = useState(false)
  const [isSucceedLeiValid, setIsSucceedLeiValid] = useState(false)
  const lastValidatedSucceedLeiRef = useRef('')
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const columnSelectorRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; record: ProvisionalLEI } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const contextMenuEditRef = useRef<HTMLButtonElement>(null)
  const contextMenuCloneRef = useRef<HTMLButtonElement>(null)
  const contextMenuLinkOfficialRef = useRef<HTMLButtonElement>(null)
  const [auditRecord, setAuditRecord] = useState<ProvisionalLEI | null>(null)

  const [storedColumns, setStoredColumns] = useUserPreference('provisional-lei', 'visible_columns', DEFAULT_VISIBLE_KEYS)
  const expandedWidthPreference = useDeferredBooleanPreference({
    pageKey: 'provisional-lei',
    preferenceKey: 'expanded_width',
    defaultValue: false,
  })
  const locationDisplayPreference = useDeferredBooleanPreference({
    pageKey: 'provisional-lei',
    preferenceKey: 'display_location_codes',
    defaultValue: false,
  })

  // Close column selector on click-outside or Escape key
  useEffect(() => {
    if (!showColumnSelector) return
    const handleClickOutside = (e: MouseEvent) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(e.target as Node)) {
        setShowColumnSelector(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowColumnSelector(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showColumnSelector])

  const visibleColumns = useMemo<Set<ProvisionalColumnKey>>(() => {
    if (!storedColumns) {
      return new Set(PROVISIONAL_COLUMNS.filter((column) => column.defaultVisible).map((column) => column.key))
    }
    return new Set(storedColumns.split(',').filter(Boolean) as ProvisionalColumnKey[])
  }, [storedColumns])

  const [showColumnSavePrompt, setShowColumnSavePrompt] = useState(false)
  const [columnSaveVersion, setColumnSaveVersion] = useState(0)
  const pendingColumns = useRef<Set<ProvisionalColumnKey> | null>(null)
  const previousColumns = useRef<string | null>(null)
  const [localColumns, setLocalColumns] = useState<Set<ProvisionalColumnKey> | null>(null)
  const [showColumnUndoToast, setShowColumnUndoToast] = useState(false)
  const [columnUndoVersion, setColumnUndoVersion] = useState(0)
  const [hasHydrated, setHasHydrated] = useState(false)

  useEffect(() => {
    setHasHydrated(true)
  }, [])

  useSearchFocusShortcut(searchInputRef)

  const effectiveVisibleColumns = localColumns ?? visibleColumns
  const isExpandedView = hasHydrated ? expandedWidthPreference.value : false
  const showCodes = locationDisplayPreference.value
  const showNames = !showCodes
  const displayModeLabel = showNames
    ? ensureLeadingEmoji(t('referenceLayout.displayNamesButton'), '🏷️')
    : ensureLeadingEmoji(t('referenceLayout.displayCodesButton'), '🏷️')
  const columnsButtonA11yLabel = hasHydrated
    ? t('buttons.columnsWithCount', { count: effectiveVisibleColumns.size })
    : t('common.columns')
  const columnsButtonLabel = ensureLeadingEmoji(columnsButtonA11yLabel, '⚙️')

  const getColumnsByGroup = useCallback(() => {
    const groups: Record<string, ProvisionalColumn[]> = {}
    PROVISIONAL_COLUMNS.forEach((col) => {
      if (!groups[col.groupKey]) groups[col.groupKey] = []
      groups[col.groupKey].push(col)
    })
    return groups
  }, [])

  const activeColumns = useMemo(
    () => PROVISIONAL_COLUMNS.filter((column) => effectiveVisibleColumns.has(column.key)),
    [effectiveVisibleColumns],
  )

  const normalizeLEI = (value: string) => value.trim().toUpperCase()

  const handleSort = (key: ProvisionalColumnKey) => {
    if (sortColumn === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(key)
      setSortDirection('asc')
    }
  }

  const sourceFilterOptions = useMemo(() => {
    const values = Array.from(new Set(records.map((r) => String(r.provisioning_source || '').trim()).filter(Boolean)))
    return values.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [records])

  const countryFilterOptions = useMemo(() => {
    const codes = Array.from(new Set(records.map((r) => String(r.legal_address_country || '').trim().toUpperCase()).filter(Boolean)))
    return codes
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map((code) => ({
        value: code,
        label: countryNameByCode.get(code) ? `${code} - ${countryNameByCode.get(code)}` : code,
      }))
  }, [records, countryNameByCode])

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    statusFilter !== '' ||
    sourceFilter !== '' ||
    countryFilter !== ''

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('')
    setSourceFilter('')
    setCountryFilter('')
  }

  const filteredRecords = useMemo(() => {
    let result = records
    const q = searchTerm.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (r) =>
          r.legal_name?.toLowerCase().includes(q) ||
          r.lei?.toLowerCase().includes(q) ||
          r.provisioning_source?.toLowerCase().includes(q) ||
          r.notes?.toLowerCase().includes(q),
      )
    }
    if (statusFilter) {
      result = result.filter((r) => (r.entity_status || '').toUpperCase() === statusFilter.toUpperCase())
    }
    if (sourceFilter) {
      result = result.filter((r) => String(r.provisioning_source || '').trim().toLowerCase() === sourceFilter.toLowerCase())
    }
    if (countryFilter) {
      result = result.filter((r) => String(r.legal_address_country || '').trim().toUpperCase() === countryFilter.toUpperCase())
    }
    if (sortColumn) {
      result = [...result].sort((a, b) => {
        const aVal = String(a[sortColumn as keyof ProvisionalLEI] ?? '')
        const bVal = String(b[sortColumn as keyof ProvisionalLEI] ?? '')
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      })
    }
    return result
  }, [records, searchTerm, statusFilter, sourceFilter, countryFilter, sortColumn, sortDirection])

  const getLeiName = (value: string) => leiNames[normalizeLEI(value)]

  const hasCreateRelatedLeiError = Boolean(leiLookupError.createParent)
  const hasEditRelatedLeiError = Boolean(leiLookupError.editParent)
  const isCreateRelatedLeiValidating = Boolean(leiLookupLoading.createParent)
  const isEditRelatedLeiValidating = Boolean(leiLookupLoading.editParent)
  const canCreateSubmit = Boolean(
    createForm.legal_name.trim() &&
      actionLoading !== 'create' &&
      !hasCreateRelatedLeiError &&
      !isCreateRelatedLeiValidating,
  )
  const canEditSubmit = Boolean(
    editForm?.legal_name.trim() &&
      actionLoading !== 'edit' &&
      !hasEditRelatedLeiError &&
      !isEditRelatedLeiValidating,
  )

  const lookupLEIName = useCallback(async (value: string, fieldKey: ProvisionalLeiLookupField) => {
    const lei = normalizeLEI(value)
    if (!isCompleteLei(lei)) {
      setLeiLookupLoading((current) => ({ ...current, [fieldKey]: false }))
      setLeiLookupError((current) => ({
        ...current,
        [fieldKey]: lei.length > 0 ? t(getRelatedLeiNotFoundErrorKey(fieldKey)) : '',
      }))
      return
    }

    if (leiNames[lei]) {
      setLeiLookupError((current) => ({ ...current, [fieldKey]: '' }))
      return
    }

    const token = getAuthToken()
    if (!token) return

    setLeiLookupLoading((current) => ({ ...current, [fieldKey]: true }))
    setLeiLookupError((current) => ({ ...current, [fieldKey]: '' }))

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/lei/${encodeURIComponent(lei)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.status === 404) {
        setLeiLookupError((current) => ({ ...current, [fieldKey]: t(getRelatedLeiNotFoundErrorKey(fieldKey)) }))
        return
      }

      if (!res.ok) return

      const data = await res.json()
      const legalName = data?.legal_name ?? data?.data?.legal_name ?? data?.record?.legal_name
      if (typeof legalName === 'string' && legalName.trim()) {
        setLeiNames((current) => ({ ...current, [lei]: legalName }))
        setLeiLookupError((current) => ({ ...current, [fieldKey]: '' }))
      }
    } catch {
      // Best-effort display enrichment.
    } finally {
      setLeiLookupLoading((current) => ({ ...current, [fieldKey]: false }))
    }
  }, [leiNames, t])

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    setError('')
    const token = getAuthToken()
    if (!token) {
      router.push('/login')
      return
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/lei/provisional?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401 || res.status === 403) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        setError(t('provisionalLei.errors.loadFailed'))
        return
      }
      const data = await res.json()
      setRecords(data.data ?? [])
      setTotal(data.total ?? 0)
    } catch {
      setError(t('provisionalLei.errors.network'))
    } finally {
      setLoading(false)
    }
  }, [router, t])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  const fetchLeiNames = useCallback(async (codes: string[]) => {
    if (codes.length === 0) return
    const token = getAuthToken()
    if (!token) return

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/lei/names?codes=${encodeURIComponent(codes.join(','))}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return

      const data = await res.json()
      if (!data || typeof data !== 'object' || Array.isArray(data)) return
      setLeiNames((current) => ({ ...current, ...(data as Record<string, string>) }))
    } catch {
      // Best-effort table enrichment only.
    }
  }, [])

  useEffect(() => {
    const tableLeiCodes = Array.from(new Set(records.flatMap((record) => [
      normalizeLEI(record.successor_lei || ''),
      normalizeLEI(record.parent_lei || ''),
    ]).filter((code) => code.length === 20)))
    const missingCodes = tableLeiCodes.filter((code) => !leiNames[code])
    if (missingCodes.length > 0) {
      fetchLeiNames(missingCodes)
    }
  }, [fetchLeiNames, leiNames, records])

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/lei-countries`)
        if (!response.ok) return
        const data = await response.json()
        const next = new Map<string, string>()
        if (Array.isArray(data)) {
          data.forEach((country: unknown) => {
            if (!country || typeof country !== 'object') return
            const candidate = country as { code?: unknown; name?: unknown }
            const code = String(candidate.code || '').trim().toUpperCase()
            const name = String(candidate.name || '').trim()
            if (code && name) {
              next.set(code, name)
            }
          })
        }
        setCountryNameByCode(next)
      } catch {
        // Optional metadata; fall back to code display.
      }
    }

    fetchCountries()
  }, [])

  const handleSetVisibleColumns = useCallback((nextColumns: Set<ProvisionalColumnKey>) => {
    setLocalColumns(nextColumns)
    pendingColumns.current = nextColumns
    setShowColumnSavePrompt(true)
    setColumnSaveVersion((version) => version + 1)
  }, [])

  const toggleColumn = useCallback((key: ProvisionalColumnKey) => {
    const current = localColumns ?? visibleColumns
    const next = new Set(current)
    if (next.has(key)) {
      if (next.size > 1) {
        next.delete(key)
      }
    } else {
      next.add(key)
    }
    handleSetVisibleColumns(next)
  }, [handleSetVisibleColumns, localColumns, visibleColumns])

  const toggleGroupColumns = useCallback((groupKey: string) => {
    const groupColumns = PROVISIONAL_COLUMNS.filter((column) => column.groupKey === groupKey)
    const allGroupColumnsVisible = groupColumns.every((column) => effectiveVisibleColumns.has(column.key))

    const nextVisibleColumns = new Set(effectiveVisibleColumns)
    if (allGroupColumnsVisible) {
      groupColumns.forEach((column) => nextVisibleColumns.delete(column.key))
    } else {
      groupColumns.forEach((column) => nextVisibleColumns.add(column.key))
    }
    handleSetVisibleColumns(nextVisibleColumns)
  }, [effectiveVisibleColumns, handleSetVisibleColumns])

  const isGroupFullySelected = useCallback((groupKey: string) => {
    const groupColumns = PROVISIONAL_COLUMNS.filter((column) => column.groupKey === groupKey)
    return groupColumns.every((column) => effectiveVisibleColumns.has(column.key))
  }, [effectiveVisibleColumns])

  const isGroupPartiallySelected = useCallback((groupKey: string) => {
    const groupColumns = PROVISIONAL_COLUMNS.filter((column) => column.groupKey === groupKey)
    const visibleCount = groupColumns.filter((column) => effectiveVisibleColumns.has(column.key)).length
    return visibleCount > 0 && visibleCount < groupColumns.length
  }, [effectiveVisibleColumns])

  const handleSaveColumns = useCallback(() => {
    if (pendingColumns.current) {
      previousColumns.current = storedColumns
      setStoredColumns(Array.from(pendingColumns.current).join(','))
      setLocalColumns(null)
      pendingColumns.current = null
    }
    setShowColumnSavePrompt(false)
    setShowColumnUndoToast(true)
    setColumnUndoVersion((version) => version + 1)
  }, [setStoredColumns, storedColumns])

  const handleDismissColumns = useCallback(() => {
    setShowColumnSavePrompt(false)
  }, [])

  const handleUndoColumns = useCallback(() => {
    if (previousColumns.current !== null) {
      setStoredColumns(previousColumns.current)
      setLocalColumns(null)
      previousColumns.current = null
    }
    setShowColumnUndoToast(false)
  }, [setStoredColumns])

  const handleUndoDismissColumns = useCallback(() => {
    setShowColumnUndoToast(false)
  }, [])

  const resolveCountryOrJurisdiction = (code: string) => {
    const normalized = String(code || '').trim().toUpperCase()
    if (!normalized) return '—'
    if (!showNames) return normalized
    return countryNameByCode.get(normalized) || normalized
  }

  const formatDateCell = (value: string) => {
    if (!value || value.startsWith('0001-')) return '—'
    return new Date(value).toISOString().split('T')[0]
  }

  const renderCell = (record: ProvisionalLEI, key: ProvisionalColumnKey) => {
    switch (key) {
      case 'lei':
        return (
          <>
            {record.lei}
            <Badge variant={PROVISIONAL_BADGE_VARIANT} className="ml-1 inline-block w-fit px-1.5 py-0.5 text-[10px] font-sans select-none">
              {t('provisionalLei.badge')}
            </Badge>
          </>
        )
      case 'legal_name':
        return record.legal_name || '—'
      case 'provisioning_source':
        return record.provisioning_source || '—'
      case 'entity_status':
        return statusBadge(record.entity_status)
      case 'successor_lei':
        return record.successor_lei ? (
          <div>
            <div className="font-mono">{record.successor_lei}</div>
            {getLeiName(record.successor_lei) && <div className="opacity-60">{getLeiName(record.successor_lei)}</div>}
          </div>
        ) : '—'
      case 'parent_lei':
        return record.parent_lei ? (
          <div>
            <div className="font-mono">{record.parent_lei}</div>
            {getLeiName(record.parent_lei) && <div className="opacity-60">{getLeiName(record.parent_lei)}</div>}
          </div>
        ) : '—'
      case 'notes':
        return record.notes || '—'
      case 'legal_address_country':
        return resolveCountryOrJurisdiction(record.legal_address_country)
      case 'legal_address_city':
        return record.legal_address_city || '—'
      case 'legal_jurisdiction':
        return resolveCountryOrJurisdiction(record.legal_jurisdiction)
      case 'created_at':
        return formatDateCell(record.created_at)
      case 'updated_at':
        return formatDateCell(record.updated_at)
      default:
        return '—'
    }
  }

  const handleCreate = async () => {
    const token = getAuthToken()
    if (!token) return
    if (hasCreateRelatedLeiError || isCreateRelatedLeiValidating) {
      return
    }
    setActionLoading('create')
    setError('')
    setSuccess('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/lei/provisional`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || t('provisionalLei.errors.createFailed'))
        return
      }
      setSuccess(t('provisionalLei.success.created'))
      setShowCreate(false)
      setCreateForm(EMPTY_CREATE)
      await fetchRecords()
    } catch {
      setError(t('provisionalLei.errors.network'))
    } finally {
      setActionLoading(null)
    }
  }

  const openEdit = (r: ProvisionalLEI) => {
    setEditTarget(r)
    setEditForm({
      legal_name: r.legal_name,
      legal_address_country: r.legal_address_country,
      legal_address_city: r.legal_address_city,
      legal_jurisdiction: r.legal_jurisdiction,
      entity_status: r.entity_status,
      provisioning_source: r.provisioning_source,
      notes: r.notes || '',
      parent_lei: r.parent_lei || '',
    })
    // Pre-load LEI names if parent is present
    if (r.parent_lei) lookupLEIName(r.parent_lei, 'editParent')
    setSucceedTarget(null)
    setShowCreate(false)
  }

  const handleEdit = async () => {
    if (!editTarget || !editForm) return
    const token = getAuthToken()
    if (!token) return
    if (hasEditRelatedLeiError || isEditRelatedLeiValidating) {
      return
    }
    setActionLoading('edit')
    setError('')
    setSuccess('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/lei/provisional/${editTarget.lei}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || t('provisionalLei.errors.updateFailed'))
        return
      }
      setSuccess(t('provisionalLei.success.updated'))
      setEditTarget(null)
      setEditForm(null)
      await fetchRecords()
    } catch {
      setError(t('provisionalLei.errors.network'))
    } finally {
      setActionLoading(null)
    }
  }

  const openSucceed = (r: ProvisionalLEI) => {
    setSucceedTarget(r)
    setOfficialLEI('')
    setSucceedLeiError('')
    setSucceedLeiValidating(false)
    setIsSucceedLeiValid(false)
    lastValidatedSucceedLeiRef.current = ''
    setEditTarget(null)
    setEditForm(null)
    setShowCreate(false)
  }

  const openClone = (record: ProvisionalLEI) => {
    setCreateForm({
      legal_name: record.legal_name || '',
      legal_address_country: record.legal_address_country || '',
      legal_address_city: record.legal_address_city || '',
      legal_jurisdiction: record.legal_jurisdiction || '',
      provisioning_source: record.provisioning_source || '',
      notes: record.notes || '',
      parent_lei: record.parent_lei || '',
    })

    if (record.parent_lei) lookupLEIName(record.parent_lei, 'createParent')

    setEditTarget(null)
    setEditForm(null)
    setSucceedTarget(null)
    setShowCreate(true)
  }

  const handleRowContextMenu = useCallback((event: ReactMouseEvent, record: ProvisionalLEI) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({ x: event.clientX, y: event.clientY, record })
  }, [])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  useEffect(() => {
    const handleClick = () => closeContextMenu()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu()
    }
    if (contextMenu) {
      document.addEventListener('click', handleClick)
      document.addEventListener('keydown', handleKey)
    }
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [contextMenu, closeContextMenu])

  useEffect(() => {
    if (contextMenu && contextMenuRef.current) {
      contextMenuRef.current.focus()
    }
  }, [contextMenu])

  const validateSucceedLEI = useCallback(async (rawLei: string) => {
    const lei = normalizeLEI(rawLei)
    if (!/^[A-Z0-9]{20}$/.test(lei)) {
      setSucceedLeiValidating(false)
      setSucceedLeiError(lei.length > 0 ? t('provisionalLei.errors.successorLeiNotFound') : '')
      setIsSucceedLeiValid(false)
      lastValidatedSucceedLeiRef.current = ''
      return
    }

    if (leiNames[lei]) {
      setSucceedLeiError('')
      setIsSucceedLeiValid(true)
      lastValidatedSucceedLeiRef.current = lei
      return
    }

    if (lastValidatedSucceedLeiRef.current === lei) {
      return
    }

    const token = getAuthToken()
    if (!token) return

    lastValidatedSucceedLeiRef.current = lei
    setSucceedLeiValidating(true)
    setSucceedLeiError('')
    setIsSucceedLeiValid(false)

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/lei/${encodeURIComponent(lei)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.status === 404) {
        setSucceedLeiError(t('provisionalLei.errors.successorLeiNotFound'))
        return
      }

      if (!res.ok) {
        return
      }

      const data = await res.json()
      const legalName = data?.legal_name ?? data?.data?.legal_name ?? data?.record?.legal_name
      if (typeof legalName === 'string' && legalName.trim()) {
        setLeiNames((current) => ({ ...current, [lei]: legalName }))
        setSucceedLeiError('')
        setIsSucceedLeiValid(true)
      } else {
        setSucceedLeiError(t('provisionalLei.errors.successorLeiNotFound'))
      }
    } catch {
      // Best-effort validation. Do not block with a network-specific inline error.
    } finally {
      setSucceedLeiValidating(false)
    }
  }, [leiNames, t])

  const handleSucceed = async () => {
    if (!succeedTarget || !officialLEI.trim() || !isSucceedLeiValid) return
    const token = getAuthToken()
    if (!token) return
    setActionLoading('succeed')
    setError('')
    setSuccess('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/lei/provisional/${succeedTarget.lei}/succeed`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ official_lei: officialLEI.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || t('provisionalLei.errors.succeedFailed'))
        return
      }
      setSuccess(t('provisionalLei.success.succeeded'))
      setSucceedTarget(null)
      setOfficialLEI('')
      setSucceedLeiError('')
      setSucceedLeiValidating(false)
      setIsSucceedLeiValid(false)
      lastValidatedSucceedLeiRef.current = ''
      await fetchRecords()
    } catch {
      setError(t('provisionalLei.errors.network'))
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div suppressHydrationWarning className={`${isExpandedView ? 'max-w-[95vw]' : 'max-w-7xl'} mx-auto`}>
        <PageHeader
          title={t('provisionalLei.title')}
          subtitle={t('provisionalLei.subtitle')}
          titleTooltip={getEnglishTooltip('provisionalLei.title')}
          subtitleTooltip={getEnglishTooltip('provisionalLei.subtitle')}
          backHref="/dashboard"
          docsHref={buildDocsUrl('admin/provisional-lei/')}
          actions={
            <>
              <button
                onClick={locationDisplayPreference.toggle}
                className="h-9 px-3 rounded-lg theme-btn-neutral theme-focus text-sm font-medium"
                title={showNames ? getEnglishTooltip('referenceLayout.displayNamesButton') : getEnglishTooltip('referenceLayout.displayCodesButton')}
                aria-label={showNames ? t('referenceLayout.displayNamesButton') : t('referenceLayout.displayCodesButton')}
              >
                {formatLabel(displayModeLabel)}
              </button>

              <button
                suppressHydrationWarning
                onClick={expandedWidthPreference.toggle}
                className="h-9 px-3 rounded-lg theme-btn-neutral theme-focus text-sm font-medium"
                title={isExpandedView ? getEnglishTooltip('referenceLayout.normalButton') : getEnglishTooltip('referenceLayout.expandButton')}
                aria-label={isExpandedView ? t('referenceLayout.normalButton') : t('referenceLayout.expandButton')}
              >
                {formatLabel(isExpandedView ? t('referenceLayout.normalButton') : t('referenceLayout.expandButton'))}
              </button>

              <div className="relative" ref={columnSelectorRef}>
                <button
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="h-9 px-3 rounded-lg theme-btn-neutral theme-focus text-sm font-medium"
                  title={getEnglishTooltip('common.columns')}
                  aria-label={columnsButtonA11yLabel}
                >
                  {formatLabel(columnsButtonLabel)}
                </button>

                {showColumnSelector && (
                  <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto theme-scrollbar theme-dropdown rounded-lg shadow-xl z-50">
                    <div className="sticky top-0 theme-dropdown border-b p-3">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold">{t('provisionalLei.controls.chooseColumns')}</h3>
                        <button
                          onClick={() => setShowColumnSelector(false)}
                          className="theme-text-muted hover:opacity-80"
                          title={t('common.close')}
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <button
                          onClick={() => handleSetVisibleColumns(new Set(PROVISIONAL_COLUMNS.map(c => c.key)))}
                          className="px-2 py-1 theme-filterchip rounded"
                          title={getEnglishTooltip('provisionalLei.controls.selectAll')}
                        >
                          {t('provisionalLei.controls.selectAll')}
                        </button>
                        <button
                          onClick={() => handleSetVisibleColumns(new Set(PROVISIONAL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key)))}
                          className="px-2 py-1 theme-btn-neutral rounded"
                          title={getEnglishTooltip('provisionalLei.controls.resetToDefault')}
                        >
                          {t('provisionalLei.controls.resetToDefault')}
                        </button>
                      </div>
                    </div>

                    {Object.entries(getColumnsByGroup()).map(([groupKey, columns]) => (
                      <div key={groupKey} className="border-b last:border-b-0" style={{ borderColor: 'rgb(var(--border-rgb) / 0.75)' }}>
                        <button
                          type="button"
                          onClick={() => toggleGroupColumns(groupKey)}
                          className="w-full px-3 py-2.5 theme-subtle font-semibold text-sm cursor-pointer transition-colors flex items-center justify-between gap-3 theme-focus"
                        >
                          <span className="flex items-center gap-2.5">
                            <span className="text-base leading-none">
                              {isGroupFullySelected(groupKey) ? '☑' : isGroupPartiallySelected(groupKey) ? '◐' : '☐'}
                            </span>
                            <span>{t(groupKey)}</span>
                          </span>
                          <span className="text-xs theme-text-muted font-normal">
                            {columns.filter((column) => effectiveVisibleColumns.has(column.key)).length}/{columns.length}
                          </span>
                        </button>
                        <div className="p-2">
                          {columns.map((col) => (
                            <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 theme-table-row-hover transition-colors rounded cursor-pointer text-sm">
                              <input
                                type="checkbox"
                                checked={effectiveVisibleColumns.has(col.key)}
                                onChange={() => toggleColumn(col.key)}
                                className="rounded"
                              />
                              <span>{t(col.labelKey)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => { setShowCreate((v) => !v); setEditTarget(null); setSucceedTarget(null) }}
                disabled={showCreate}
                aria-pressed={showCreate}
                className="h-9 px-3 rounded-lg theme-btn-primary theme-focus text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                title={getEnglishTooltip('provisionalLei.actions.create')}
              >
                {formatLabel(t('provisionalLei.actions.create'))}
              </button>
            </>
          }
        />

        {error && <Alert variant="error" className="mb-4">{error}</Alert>}
        {success && <Alert variant="success" className="mb-4">{success}</Alert>}

        <div className="flex items-center justify-between mb-4">
          <span className="text-sm theme-text-muted">
            {hasActiveFilters
              ? t('provisionalLei.filters.resultCount', { shown: filteredRecords.length, total })
              : t('provisionalLei.totalCount', { count: total })}
          </span>
        </div>

        {/* Filter bar */}
        <div className="relative z-40 bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg p-4 mb-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium theme-text-muted mb-1">{t('provisionalLei.filters.search')}</label>
            <SearchInputWithOverflowTooltip
              ref={searchInputRef}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('provisionalLei.filters.searchPlaceholder')}
              className="w-full h-9 px-3 rounded-lg border theme-input text-sm"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium theme-text-muted mb-1">{t('provisionalLei.filters.status')}</label>
            <ThemedSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: '', label: t('provisionalLei.filters.allStatuses') },
                { value: 'ACTIVE', label: t('provisionalLei.filters.statusActive') },
                { value: 'INACTIVE', label: t('provisionalLei.filters.statusInactive') },
                { value: 'MERGED', label: t('provisionalLei.filters.statusMerged') },
              ]}
              ariaLabel={t('provisionalLei.filters.status')}
              className="w-full"
            />
          </div>
          <div className="min-w-[200px]">
            <label className="block text-xs font-medium theme-text-muted mb-1">{t('provisionalLei.filters.source')}</label>
            <ThemedSelect
              value={sourceFilter}
              onChange={setSourceFilter}
              options={[
                { value: '', label: t('provisionalLei.filters.allSources') },
                ...sourceFilterOptions.map((source) => ({ value: source, label: source })),
              ]}
              ariaLabel={t('provisionalLei.filters.source')}
              className="w-full"
            />
          </div>
          <div className="min-w-[220px]">
            <label className="block text-xs font-medium theme-text-muted mb-1">{t('provisionalLei.filters.country')}</label>
            <ThemedSelect
              value={countryFilter}
              onChange={setCountryFilter}
              options={[
                { value: '', label: t('provisionalLei.filters.allCountries') },
                ...countryFilterOptions,
              ]}
              ariaLabel={t('provisionalLei.filters.country')}
              className="w-full"
            />
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="h-9 px-3 rounded-lg theme-btn-neutral theme-focus text-sm font-medium"
            >
              {t('common.clearFilters')}
            </button>
          )}
        </div>

        {showCreate && (
          <div className="mb-6 p-5 rounded-lg theme-panel border border-[rgb(var(--border-rgb))]">
            <h2 className="text-base font-semibold mb-4">{t('provisionalLei.form.createTitle')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('provisionalLei.form.legalName')} *
                </label>
                <input
                  type="text"
                  value={createForm.legal_name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, legal_name: e.target.value }))}
                  className="w-full rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm theme-focus"
                  placeholder={t('provisionalLei.form.legalNamePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('provisionalLei.form.provisioningSource')}
                </label>
                <input
                  type="text"
                  value={createForm.provisioning_source}
                  onChange={(e) => setCreateForm((f) => ({ ...f, provisioning_source: e.target.value }))}
                  className="w-full rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm theme-focus"
                  placeholder={t('provisionalLei.form.provisioningSourcePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('provisionalLei.form.country')}
                </label>
                <input
                  type="text"
                  value={createForm.legal_address_country}
                  onChange={(e) => setCreateForm((f) => ({ ...f, legal_address_country: e.target.value }))}
                  className="w-full rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm theme-focus"
                  placeholder="GB"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('provisionalLei.form.city')}
                </label>
                <input
                  type="text"
                  value={createForm.legal_address_city}
                  onChange={(e) => setCreateForm((f) => ({ ...f, legal_address_city: e.target.value }))}
                  className="w-full rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm theme-focus"
                  placeholder="London"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('provisionalLei.form.jurisdiction')}
                </label>
                <input
                  type="text"
                  value={createForm.legal_jurisdiction}
                  onChange={(e) => setCreateForm((f) => ({ ...f, legal_jurisdiction: e.target.value }))}
                  className="w-full rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm theme-focus"
                  placeholder="GB"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('provisionalLei.form.notes')}
                </label>
                <input
                  type="text"
                  value={createForm.notes}
                  onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm theme-focus"
                  placeholder={t('provisionalLei.form.notesPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('provisionalLei.form.parentLei')}
                </label>
                <input
                  type="text"
                  value={createForm.parent_lei}
                  onChange={(e) => {
                    const nextLei = e.target.value.toUpperCase()
                    setCreateForm((f) => ({ ...f, parent_lei: nextLei }))
                    const normalized = normalizeLEI(nextLei)
                    if (normalized.length === 0) {
                      setLeiLookupError((current) => ({ ...current, createParent: '' }))
                    } else if (!isCompleteLei(normalized)) {
                      setLeiLookupError((current) => ({ ...current, createParent: t('provisionalLei.errors.parentLeiNotFound') }))
                    } else {
                      setLeiLookupError((current) => ({ ...current, createParent: '' }))
                      void lookupLEIName(normalized, 'createParent')
                    }
                  }}
                  onBlur={() => lookupLEIName(createForm.parent_lei, 'createParent')}
                  className={`w-full rounded-md border bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm font-mono theme-focus ${leiLookupError.createParent ? 'border-red-500' : 'border-[rgb(var(--border-rgb))]'}`}
                  placeholder={t('provisionalLei.form.parentLeiPlaceholder')}
                  maxLength={20}
                />
                {leiLookupLoading.createParent && <p className="mt-1 text-xs theme-text-muted">{t('common.loading')}</p>}
                {leiLookupError.createParent && <p className="mt-1 text-xs text-red-700 dark:text-red-300">{leiLookupError.createParent}</p>}
                {!leiLookupError.createParent && !leiLookupLoading.createParent && getLeiName(createForm.parent_lei) && (
                  <p className="mt-1 text-xs theme-text-muted">{getLeiName(createForm.parent_lei)}</p>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleCreate}
                disabled={!canCreateSubmit}
                aria-disabled={!canCreateSubmit}
                title={!canCreateSubmit && (hasCreateRelatedLeiError || isCreateRelatedLeiValidating)
                  ? t('provisionalLei.form.fixRelatedLeiBeforeSave')
                  : undefined}
                className={`px-4 py-2 text-sm rounded-md ${canCreateSubmit ? 'theme-btn-primary' : 'theme-btn-neutral opacity-60 cursor-not-allowed pointer-events-none'}`}
              >
                {actionLoading === 'create' ? t('common.saving') : t('provisionalLei.actions.save')}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm rounded-md theme-btn-neutral"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {editTarget && editForm && (
          <div className="mb-6 p-5 rounded-lg theme-panel border border-[rgb(var(--border-rgb))]">
            <h2 className="text-base font-semibold mb-1">{t('provisionalLei.form.editTitle')}</h2>
            <p className="text-xs theme-text-muted mb-4 font-mono">{editTarget.lei}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('provisionalLei.form.legalName')} *
                </label>
                <input
                  type="text"
                  value={editForm.legal_name}
                  onChange={(e) => setEditForm((f) => f ? { ...f, legal_name: e.target.value } : f)}
                  className="w-full rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm theme-focus"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('provisionalLei.form.entityStatus')}
                </label>
                <ThemedSelect
                  value={editForm.entity_status}
                  onChange={(value) => setEditForm((f) => f ? { ...f, entity_status: value } : f)}
                  options={ENTITY_STATUS_OPTIONS}
                  ariaLabel={t('provisionalLei.form.entityStatus')}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('provisionalLei.form.provisioningSource')}
                </label>
                <input
                  type="text"
                  value={editForm.provisioning_source}
                  onChange={(e) => setEditForm((f) => f ? { ...f, provisioning_source: e.target.value } : f)}
                  className="w-full rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm theme-focus"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('provisionalLei.form.country')}
                </label>
                <input
                  type="text"
                  value={editForm.legal_address_country}
                  onChange={(e) => setEditForm((f) => f ? { ...f, legal_address_country: e.target.value } : f)}
                  className="w-full rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm theme-focus"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('provisionalLei.form.city')}
                </label>
                <input
                  type="text"
                  value={editForm.legal_address_city}
                  onChange={(e) => setEditForm((f) => f ? { ...f, legal_address_city: e.target.value } : f)}
                  className="w-full rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm theme-focus"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('provisionalLei.form.jurisdiction')}
                </label>
                <input
                  type="text"
                  value={editForm.legal_jurisdiction}
                  onChange={(e) => setEditForm((f) => f ? { ...f, legal_jurisdiction: e.target.value } : f)}
                  className="w-full rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm theme-focus"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('provisionalLei.form.parentLei')}
                </label>
                <input
                  type="text"
                  value={editForm.parent_lei}
                  onChange={(e) => {
                    const nextLei = e.target.value.toUpperCase()
                    setEditForm((f) => f ? { ...f, parent_lei: nextLei } : f)
                    const normalized = normalizeLEI(nextLei)
                    if (normalized.length === 0) {
                      setLeiLookupError((current) => ({ ...current, editParent: '' }))
                    } else if (!isCompleteLei(normalized)) {
                      setLeiLookupError((current) => ({ ...current, editParent: t('provisionalLei.errors.parentLeiNotFound') }))
                    } else {
                      setLeiLookupError((current) => ({ ...current, editParent: '' }))
                      void lookupLEIName(normalized, 'editParent')
                    }
                  }}
                  onBlur={() => lookupLEIName(editForm.parent_lei, 'editParent')}
                  className={`w-full rounded-md border bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm font-mono theme-focus ${leiLookupError.editParent ? 'border-red-500' : 'border-[rgb(var(--border-rgb))]'}`}
                  placeholder={t('provisionalLei.form.parentLeiPlaceholder')}
                  maxLength={20}
                />
                {leiLookupLoading.editParent && <p className="mt-1 text-xs theme-text-muted">{t('common.loading')}</p>}
                {leiLookupError.editParent && <p className="mt-1 text-xs text-red-700 dark:text-red-300">{leiLookupError.editParent}</p>}
                {!leiLookupError.editParent && !leiLookupLoading.editParent && getLeiName(editForm.parent_lei) && (
                  <p className="mt-1 text-xs theme-text-muted">{getLeiName(editForm.parent_lei)}</p>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleEdit}
                disabled={!canEditSubmit}
                aria-disabled={!canEditSubmit}
                title={!canEditSubmit && (hasEditRelatedLeiError || isEditRelatedLeiValidating)
                  ? t('provisionalLei.form.fixRelatedLeiBeforeSave')
                  : undefined}
                className={`px-4 py-2 text-sm rounded-md ${canEditSubmit ? 'theme-btn-primary' : 'theme-btn-neutral opacity-60 cursor-not-allowed pointer-events-none'}`}
              >
                {actionLoading === 'edit' ? t('common.saving') : t('provisionalLei.actions.save')}
              </button>
              <button
                onClick={() => { setEditTarget(null); setEditForm(null) }}
                className="px-4 py-2 text-sm rounded-md theme-btn-neutral"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {succeedTarget && (
          <div className="mb-6 p-5 rounded-lg theme-panel border border-[rgb(var(--border-rgb))]">
            <h2 className="text-base font-semibold mb-1">{t('provisionalLei.form.succeedTitle')}</h2>
            <p className="text-xs theme-text-muted mb-4">
              {t('provisionalLei.form.succeedHint', { lei: succeedTarget.lei, name: succeedTarget.legal_name })}
            </p>
            <div className="max-w-md">
              <label className="block text-xs font-medium mb-1 theme-text-muted">
                {t('provisionalLei.form.officialLEI')} *
              </label>
              <input
                type="text"
                value={officialLEI}
                onChange={(e) => {
                  const nextLei = e.target.value.toUpperCase()
                  setOfficialLEI(nextLei)
                  setSucceedLeiError('')

                  const normalized = normalizeLEI(nextLei)
                  if (leiNames[normalized]) {
                    setIsSucceedLeiValid(true)
                  } else {
                    setIsSucceedLeiValid(false)
                  }

                  if (normalized.length === 0) {
                    setSucceedLeiError('')
                  } else if (/^[A-Z0-9]{20}$/.test(normalized)) {
                    void validateSucceedLEI(normalized)
                  } else {
                    setSucceedLeiError(t('provisionalLei.errors.successorLeiNotFound'))
                  }
                }}
                onBlur={() => {
                  void validateSucceedLEI(officialLEI)
                }}
                className="w-full rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm font-mono theme-focus"
                placeholder={t('provisionalLei.form.successorLeiPlaceholder')}
                maxLength={20}
              />
              {succeedLeiValidating && (
                <p className="mt-1 text-xs theme-text-muted opacity-60">⟳ {t('common.loading')}</p>
              )}
              {succeedLeiError && (
                <p className="mt-1 text-xs text-red-700 dark:text-red-300">{succeedLeiError}</p>
              )}
              {!succeedLeiError && !succeedLeiValidating && getLeiName(officialLEI) && (
                <p className="mt-1 text-xs theme-text-muted">{getLeiName(officialLEI)}</p>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSucceed}
                disabled={!isSucceedLeiValid || actionLoading === 'succeed'}
                className="px-4 py-2 text-sm rounded-md theme-btn-primary disabled:opacity-60"
              >
                {actionLoading === 'succeed' ? t('common.saving') : t('provisionalLei.actions.succeed')}
              </button>
              <button
                onClick={() => {
                  setSucceedTarget(null)
                  setOfficialLEI('')
                  setSucceedLeiError('')
                  setSucceedLeiValidating(false)
                  setIsSucceedLeiValid(false)
                  lastValidatedSucceedLeiRef.current = ''
                }}
                className="px-4 py-2 text-sm rounded-md theme-btn-neutral"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <LoadingSpinner message={t('provisionalLei.loading')} />
        ) : records.length === 0 ? (
          <div className="text-center py-16 theme-text-muted">{t('provisionalLei.empty')}</div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-16 theme-text-muted">{t('provisionalLei.filters.noResults')}</div>
        ) : (
          <div className="theme-table-shell border-2 backdrop-blur-sm rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="theme-table-header border-b border-[rgb(var(--border-rgb))]">
                  {activeColumns.map((column) => (
                    <SortableHeaderCell
                      key={column.key}
                      label={<span title={getEnglishTooltip(column.labelKey)}>{t(column.labelKey)}</span>}
                      className={`${column.width} px-4 py-3 font-medium theme-table-header-cell`}
                      sortable
                      onSort={() => handleSort(column.key as ProvisionalColumnKey)}
                      isActiveSort={sortColumn === column.key}
                      sortDirection={sortDirection}
                    />
                  ))}
                  <th className="px-4 py-3 text-left font-medium theme-table-header-cell min-w-[220px]">
                    <span title={getEnglishTooltip('provisionalLei.columns.actions')}>{t('provisionalLei.columns.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    onContextMenu={(event) => handleRowContextMenu(event, record)}
                    className="border-b border-[rgb(var(--border-rgb)/0.4)] theme-table-row-hover transition-colors"
                  >
                    {activeColumns.map((column) => {
                      const isMonospace =
                        column.key === 'lei' ||
                        column.key === 'successor_lei' ||
                        column.key === 'created_at' ||
                        column.key === 'updated_at'
                      const isMuted =
                        column.key === 'provisioning_source' ||
                        column.key === 'successor_lei' ||
                        column.key === 'created_at' ||
                        column.key === 'updated_at'

                      return (
                        <td
                          key={`${record.id}-${column.key}`}
                          className={`${column.width} px-4 py-3 align-top ${isMonospace ? 'font-mono text-xs' : ''} ${isMuted ? 'theme-text-muted' : ''}`}
                        >
                          {renderCell(record, column.key)}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 align-top min-w-[220px]">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openEdit(record)}
                          className="px-3 py-1 text-xs rounded theme-btn-neutral theme-focus"
                          title={getEnglishTooltip('provisionalLei.actions.edit')}
                        >
                          {formatLabel(t('provisionalLei.actions.edit'))}
                        </button>
                        <button
                          onClick={() => openClone(record)}
                          className="px-3 py-1 text-xs rounded theme-btn-neutral theme-focus"
                          title={getEnglishTooltip('provisionalLei.actions.clone')}
                        >
                          {formatLabel(t('provisionalLei.actions.clone'))}
                        </button>
                        {!record.successor_lei && (
                          <button
                            onClick={() => openSucceed(record)}
                            className="px-3 py-1 text-xs rounded theme-btn-neutral theme-focus"
                            title={getEnglishTooltip('provisionalLei.actions.succeed')}
                          >
                            {formatLabel(t('provisionalLei.actions.succeed'))}
                          </button>
                        )}
                        <button
                          onClick={() => setAuditRecord(record)}
                          className="px-3 py-1 text-xs rounded theme-btn-neutral theme-focus"
                          title={getEnglishTooltip('leiAudit.viewAuditHistory')}
                        >
                          {formatLabel(t('leiAudit.historyButton'))}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {contextMenu && (
          <div
            ref={contextMenuRef}
            role="menu"
            tabIndex={-1}
            aria-label={t('provisionalLei.columns.actions')}
            className="fixed z-[60] min-w-56 theme-dropdown rounded-lg shadow-xl border border-[rgb(var(--border-rgb))] overflow-hidden"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                closeContextMenu()
              } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                contextMenuCloneRef.current?.focus()
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                contextMenuEditRef.current?.focus()
              }
            }}
          >
            <button
              ref={contextMenuEditRef}
              role="menuitem"
              type="button"
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-[rgb(var(--surface-muted-rgb))] transition-colors focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  contextMenuCloneRef.current?.focus()
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  contextMenuRef.current?.focus()
                } else if (e.key === 'Escape') {
                  closeContextMenu()
                }
              }}
              onClick={() => {
                closeContextMenu()
                openEdit(contextMenu.record)
              }}
            >
              {formatLabel(t('provisionalLei.actions.edit'))}
            </button>
            <button
              ref={contextMenuCloneRef}
              role="menuitem"
              type="button"
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-[rgb(var(--surface-muted-rgb))] transition-colors focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  if (contextMenu.record.successor_lei) {
                    contextMenuEditRef.current?.focus()
                  } else {
                    contextMenuLinkOfficialRef.current?.focus()
                  }
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  contextMenuEditRef.current?.focus()
                } else if (e.key === 'Escape') {
                  closeContextMenu()
                }
              }}
              onClick={() => {
                closeContextMenu()
                openClone(contextMenu.record)
              }}
            >
              {formatLabel(t('provisionalLei.actions.clone'))}
            </button>
            <div
              title={
                contextMenu.record.successor_lei
                  ? t('provisionalLei.actions.succeedDisabledReason')
                  : getEnglishTooltip('provisionalLei.actions.succeed')
              }
            >
              <button
                ref={contextMenuLinkOfficialRef}
                role="menuitem"
                type="button"
                disabled={Boolean(contextMenu.record.successor_lei)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-[rgb(var(--surface-muted-rgb))] transition-colors focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    contextMenuEditRef.current?.focus()
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    contextMenuCloneRef.current?.focus()
                  } else if (e.key === 'Escape') {
                    closeContextMenu()
                  }
                }}
                onClick={() => {
                  if (contextMenu.record.successor_lei) return
                  closeContextMenu()
                  openSucceed(contextMenu.record)
                }}
              >
                {formatLabel(t('provisionalLei.actions.succeed'))}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/dashboard" className="theme-link hover:opacity-80 text-sm">
            {t('nav.backToDashboard')}
          </Link>
        </div>

        <PreferenceSavePrompt
          visible={showColumnSavePrompt}
          resetKey={columnSaveVersion}
          label={t('leiRecords.saveColumnPrompt')}
          onSave={handleSaveColumns}
          onDismiss={handleDismissColumns}
          showUndo={showColumnUndoToast}
          undoResetKey={columnUndoVersion}
          onUndo={handleUndoColumns}
          onUndoDismiss={handleUndoDismissColumns}
          undoLabel={t('preferences.savedUndo')}
        />
        <PreferenceSavePrompt
          visible={expandedWidthPreference.showPrompt}
          resetKey={expandedWidthPreference.promptResetKey}
          label={t('referenceLayout.savePageWidthDefault')}
          onSave={expandedWidthPreference.save}
          onDismiss={expandedWidthPreference.dismiss}
          showUndo={expandedWidthPreference.showUndo}
          undoResetKey={expandedWidthPreference.undoResetKey}
          onUndo={expandedWidthPreference.undo}
          onUndoDismiss={expandedWidthPreference.undoDismiss}
          undoLabel={t('preferences.savedUndo')}
        />
        <PreferenceSavePrompt
          visible={locationDisplayPreference.showPrompt}
          resetKey={locationDisplayPreference.promptResetKey}
          label={t('referenceLayout.saveDisplayModeDefault')}
          onSave={locationDisplayPreference.save}
          onDismiss={locationDisplayPreference.dismiss}
          showUndo={locationDisplayPreference.showUndo}
          undoResetKey={locationDisplayPreference.undoResetKey}
          onUndo={locationDisplayPreference.undo}
          onUndoDismiss={locationDisplayPreference.undoDismiss}
          undoLabel={t('preferences.savedUndo')}
        />

        {/* Audit History Modal */}
        {auditRecord && (
          <LEIAuditHistoryModal
            lei={auditRecord.lei}
            legalName={auditRecord.legal_name}
            onClose={() => setAuditRecord(null)}
            apiBaseUrl={API_BASE_URL}
            availableColumns={[
              { key: 'legal_name', labelKey: 'provisionalLei.columns.legalName', groupKey: 'provisionalLei.columns.groups.core', defaultVisible: true },
              { key: 'legal_address_country', labelKey: 'provisionalLei.columns.country', groupKey: 'provisionalLei.columns.groups.address', defaultVisible: true },
              { key: 'legal_address_city', labelKey: 'provisionalLei.columns.city', groupKey: 'provisionalLei.columns.groups.address', defaultVisible: true },
              { key: 'legal_jurisdiction', labelKey: 'provisionalLei.columns.jurisdiction', groupKey: 'provisionalLei.columns.groups.address', defaultVisible: true },
              { key: 'entity_status', labelKey: 'provisionalLei.columns.status', groupKey: 'provisionalLei.columns.groups.core', defaultVisible: true },
              { key: 'provisioning_source', labelKey: 'provisionalLei.columns.source', groupKey: 'provisionalLei.columns.groups.core', defaultVisible: true },
              { key: 'successor_lei', labelKey: 'provisionalLei.columns.successorLei', groupKey: 'provisionalLei.columns.groups.associated', defaultVisible: true },
              { key: 'parent_lei', labelKey: 'provisionalLei.columns.parentLei', groupKey: 'provisionalLei.columns.groups.hierarchy', defaultVisible: false },
              { key: 'child_lei', labelKey: 'provisionalLei.columns.childLei', groupKey: 'provisionalLei.columns.groups.hierarchy', defaultVisible: false },
            ]}
            visibleColumns={new Set(['legal_name', 'legal_address_country', 'legal_address_city', 'legal_jurisdiction', 'entity_status', 'provisioning_source', 'successor_lei', 'parent_lei', 'child_lei'])}
            onLeiClick={() => { /* no-op for provisional LEI */ }}
          />
        )}
      </div>
    </main>
  )
}

export default function ProvisionalLEIPage() {
  const { t } = useTranslation('common')
  return (
    <Suspense fallback={<LoadingSpinner message={t('common.loading')} />}>
      <ProvisionalLEIContent />
    </Suspense>
  )
}
