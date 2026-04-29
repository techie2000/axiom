'use client'

import { useState, useEffect, useCallback, Suspense, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/PageHeader'
import Alert from '../../components/Alert'
import LoadingSpinner from '../../components/LoadingSpinner'
import PreferenceSavePrompt from '../../components/PreferenceSavePrompt'
import { getApiBaseUrl } from '../../lib/api-base'
import { getAuthToken } from '../../lib/auth-token'
import { buildDocsUrl } from '../../lib/docsLinks'
import { useDeferredBooleanPreference } from '../../lib/useDeferredBooleanPreference'
import { useEnglishTooltips } from '../../lib/useEnglishTooltips'
import { useUserPreference } from '../../lib/useUserPreference'

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
  is_provisional: boolean
  created_at: string
  updated_at: string
}

type ProvisionalColumnKey =
  | 'lei'
  | 'legal_name'
  | 'provisioning_source'
  | 'entity_status'
  | 'successor_lei'
  | 'legal_address_country'
  | 'legal_address_city'
  | 'legal_jurisdiction'
  | 'created_at'
  | 'updated_at'

interface ProvisionalColumn {
  key: ProvisionalColumnKey
  labelKey: string
  defaultVisible: boolean
}

const PROVISIONAL_COLUMNS: ProvisionalColumn[] = [
  { key: 'lei', labelKey: 'provisionalLei.columns.lei', defaultVisible: true },
  { key: 'legal_name', labelKey: 'provisionalLei.columns.legalName', defaultVisible: true },
  { key: 'provisioning_source', labelKey: 'provisionalLei.columns.source', defaultVisible: true },
  { key: 'entity_status', labelKey: 'provisionalLei.columns.status', defaultVisible: true },
  { key: 'successor_lei', labelKey: 'provisionalLei.columns.successorLei', defaultVisible: true },
  { key: 'legal_address_country', labelKey: 'provisionalLei.columns.country', defaultVisible: true },
  { key: 'legal_address_city', labelKey: 'provisionalLei.columns.city', defaultVisible: true },
  { key: 'legal_jurisdiction', labelKey: 'provisionalLei.columns.jurisdiction', defaultVisible: true },
  { key: 'created_at', labelKey: 'provisionalLei.columns.created', defaultVisible: true },
  { key: 'updated_at', labelKey: 'provisionalLei.columns.updated', defaultVisible: false },
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
}

interface EditForm {
  legal_name: string
  legal_address_country: string
  legal_address_city: string
  legal_jurisdiction: string
  entity_status: string
  provisioning_source: string
}

const EMPTY_CREATE: CreateForm = {
  legal_name: '',
  legal_address_country: '',
  legal_address_city: '',
  legal_jurisdiction: '',
  provisioning_source: '',
  notes: '',
}

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
  const router = useRouter()

  const [records, setRecords] = useState<ProvisionalLEI[]>([])
  const [countryNameByCode, setCountryNameByCode] = useState<Map<string, string>>(new Map())
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE)
  const [editTarget, setEditTarget] = useState<ProvisionalLEI | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [succeedTarget, setSucceedTarget] = useState<ProvisionalLEI | null>(null)
  const [officialLEI, setOfficialLEI] = useState('')
  const [showColumnSelector, setShowColumnSelector] = useState(false)

  const [storedColumns, setStoredColumns] = useUserPreference('provisional-lei', 'visible_columns', DEFAULT_VISIBLE_KEYS)
  const expandedWidthPreference = useDeferredBooleanPreference({
    pageKey: 'provisional-lei',
    preferenceKey: 'expanded_width',
    defaultValue: false,
  })
  const locationDisplayPreference = useDeferredBooleanPreference({
    pageKey: 'provisional-lei',
    preferenceKey: 'display_location_codes',
    defaultValue: true,
  })

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

  const effectiveVisibleColumns = localColumns ?? visibleColumns
  const isExpandedView = expandedWidthPreference.value
  const showCodes = locationDisplayPreference.value
  const showNames = !showCodes

  const activeColumns = useMemo(
    () => PROVISIONAL_COLUMNS.filter((column) => effectiveVisibleColumns.has(column.key)),
    [effectiveVisibleColumns],
  )

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
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 font-sans">
              {t('provisionalLei.badge')}
            </span>
          </>
        )
      case 'legal_name':
        return record.legal_name || '—'
      case 'provisioning_source':
        return record.provisioning_source || '—'
      case 'entity_status':
        return statusBadge(record.entity_status)
      case 'successor_lei':
        return record.successor_lei || '—'
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
    })
    setSucceedTarget(null)
    setShowCreate(false)
  }

  const handleEdit = async () => {
    if (!editTarget || !editForm) return
    const token = getAuthToken()
    if (!token) return
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
    setEditTarget(null)
    setEditForm(null)
    setShowCreate(false)
  }

  const handleSucceed = async () => {
    if (!succeedTarget || !officialLEI.trim()) return
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
      await fetchRecords()
    } catch {
      setError(t('provisionalLei.errors.network'))
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className={`${isExpandedView ? 'max-w-[95vw]' : 'max-w-7xl'} mx-auto`}>
        <PageHeader
          title={t('provisionalLei.title')}
          subtitle={t('provisionalLei.subtitle')}
          titleTooltip={getEnglishTooltip('provisionalLei.title')}
          subtitleTooltip={getEnglishTooltip('provisionalLei.subtitle')}
          backHref="/dashboard"
          docsHref={buildDocsUrl('admin/provisional-lei/')}
        />

        {error && <Alert variant="error" className="mb-4">{error}</Alert>}
        {success && <Alert variant="success" className="mb-4">{success}</Alert>}

        <div className="flex items-center justify-between mb-4">
          <span className="text-sm theme-text-muted">
            {t('provisionalLei.totalCount', { count: total })}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={locationDisplayPreference.toggle}
              className="px-3 py-2 rounded-md text-sm font-medium theme-btn-neutral"
              title={getEnglishTooltip('provisionalLei.controls.displayMode')}
            >
              {showNames ? t('provisionalLei.controls.displayNames') : t('provisionalLei.controls.displayCodes')}
            </button>
            <button
              onClick={expandedWidthPreference.toggle}
              className="px-3 py-2 rounded-md text-sm font-medium theme-btn-neutral"
              title={getEnglishTooltip('provisionalLei.controls.viewMode')}
            >
              {isExpandedView ? t('provisionalLei.controls.normalView') : t('provisionalLei.controls.expandedView')}
            </button>
            <button
              onClick={() => setShowColumnSelector((value) => !value)}
              className="px-3 py-2 rounded-md text-sm font-medium theme-btn-neutral"
              title={getEnglishTooltip('provisionalLei.controls.columns')}
            >
              {t('provisionalLei.controls.columns')}
            </button>
            <button
              onClick={() => { setShowCreate((v) => !v); setEditTarget(null); setSucceedTarget(null) }}
              className="px-4 py-2 rounded-md text-sm font-medium theme-btn-primary"
              title={getEnglishTooltip('provisionalLei.actions.create')}
            >
              {t('provisionalLei.actions.create')}
            </button>
          </div>
        </div>

        {showColumnSelector && (
          <div className="mb-4 p-4 rounded-lg theme-panel border border-[rgb(var(--border-rgb))]">
            <p className="text-sm font-medium mb-3">{t('provisionalLei.controls.chooseColumns')}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {PROVISIONAL_COLUMNS.map((column) => (
                <label key={column.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={effectiveVisibleColumns.has(column.key)}
                    onChange={() => toggleColumn(column.key)}
                    className="rounded border-[rgb(var(--border-rgb))]"
                  />
                  <span>{t(column.labelKey)}</span>
                </label>
              ))}
            </div>
          </div>
        )}

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
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleCreate}
                disabled={!createForm.legal_name.trim() || actionLoading === 'create'}
                className="px-4 py-2 text-sm rounded-md theme-btn-primary disabled:opacity-60"
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
                <select
                  value={editForm.entity_status}
                  onChange={(e) => setEditForm((f) => f ? { ...f, entity_status: e.target.value } : f)}
                  className="w-full rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm theme-focus"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="MERGED">MERGED</option>
                </select>
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
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleEdit}
                disabled={!editForm.legal_name.trim() || actionLoading === 'edit'}
                className="px-4 py-2 text-sm rounded-md theme-btn-primary disabled:opacity-60"
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
                onChange={(e) => setOfficialLEI(e.target.value.toUpperCase())}
                className="w-full rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm font-mono theme-focus"
                placeholder="20-character official LEI"
                maxLength={20}
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSucceed}
                disabled={officialLEI.trim().length !== 20 || actionLoading === 'succeed'}
                className="px-4 py-2 text-sm rounded-md theme-btn-primary disabled:opacity-60"
              >
                {actionLoading === 'succeed' ? t('common.saving') : t('provisionalLei.actions.succeed')}
              </button>
              <button
                onClick={() => { setSucceedTarget(null); setOfficialLEI('') }}
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
        ) : (
          <div className="theme-table-shell border-2 backdrop-blur-sm rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="theme-table-header border-b border-[rgb(var(--border-rgb))]">
                  {activeColumns.map((column) => (
                    <th key={column.key} className="px-4 py-3 text-left font-medium theme-table-header-cell">
                      <span title={getEnglishTooltip(column.labelKey)}>{t(column.labelKey)}</span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left font-medium theme-table-header-cell">
                    <span title={getEnglishTooltip('provisionalLei.columns.actions')}>{t('provisionalLei.columns.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr
                    key={record.id}
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
                          className={`px-4 py-3 align-top ${isMonospace ? 'font-mono text-xs' : ''} ${isMuted ? 'theme-text-muted' : ''}`}
                        >
                          {renderCell(record, column.key)}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openEdit(record)}
                          className="px-3 py-1 text-xs rounded theme-btn-neutral theme-focus"
                        >
                          {t('provisionalLei.actions.edit')}
                        </button>
                        {!record.successor_lei && (
                          <button
                            onClick={() => openSucceed(record)}
                            className="px-3 py-1 text-xs rounded theme-btn-neutral theme-focus"
                          >
                            {t('provisionalLei.actions.succeed')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
