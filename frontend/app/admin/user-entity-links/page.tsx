'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/PageHeader'
import Alert from '../../components/Alert'
import LoadingSpinner from '../../components/LoadingSpinner'
import SearchInputWithOverflowTooltip from '../../components/SearchInputWithOverflowTooltip'
import ThemedSelect from '../../components/ThemedSelect'
import { getApiBaseUrl } from '../../lib/api-base'
import { getAuthToken } from '../../lib/auth-token'
import { useEnglishTooltips } from '../../lib/useEnglishTooltips'
import { buildDocsUrl } from '../../lib/docsLinks'
import SortableHeaderCell from '../../components/SortableHeaderCell'
import { formatStatusLabel } from '../../lib/status-label'

const API_BASE_URL = getApiBaseUrl()

type EntityRole = 'viewer' | 'trader' | 'entity_admin'

interface UserOption {
  id: string
  username: string
  full_name: string
  email: string
  status: string
}

interface UserEntityLink {
  id: string
  user_id: string
  lei: string
  lei_name?: string
  entity_role: EntityRole
  children_scope: ChildrenScope
  granted_by: string
  granted_at: string
  expires_at: string | null
  revoked_at: string | null
  notes: string
}

type ChildrenScope = 'none' | 'direct' | 'all'

interface GrantForm {
  user_id: string
  lei: string
  entity_role: EntityRole
  children_scope: ChildrenScope
  expires_at: string
  notes: string
}

interface EditForm {
  entity_role: EntityRole
  children_scope: ChildrenScope
  expires_at: string
  notes: string
}

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/

function normalizeDateOnlyInput(value: string): string {
  const digits = value.replace(/[^\d]/g, '').slice(0, 8)
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
}

function dateOnlyToISOString(value: string): string | null {
  if (!DATE_ONLY_REGEX.test(value)) return null
  return `${value}T00:00:00Z`
}

const ROLES: EntityRole[] = ['viewer', 'trader', 'entity_admin']
const ROLE_OPTIONS = ROLES.map((role) => ({ value: role, label: formatStatusLabel(role) }))

const CHILDREN_SCOPE_OPTIONS = [
  { value: 'none' as ChildrenScope, label: 'userEntityLinks.childrenScope.none' },
  { value: 'direct' as ChildrenScope, label: 'userEntityLinks.childrenScope.direct' },
  { value: 'all' as ChildrenScope, label: 'userEntityLinks.childrenScope.all' },
]

const EMPTY_GRANT: GrantForm = {
  user_id: '',
  lei: '',
  entity_role: 'viewer',
  children_scope: 'none',
  expires_at: '',
  notes: '',
}

function DateOnlyField({
  value,
  onChange,
  placeholder,
  openCalendarLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  openCalendarLabel: string
}) {
  const pickerRef = useRef<HTMLInputElement | null>(null)

  const openPicker = () => {
    const input = pickerRef.current
    if (!input) return
    if (typeof input.showPicker === 'function') {
      input.showPicker()
      return
    }
    input.focus()
    input.click()
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(normalizeDateOnlyInput(e.target.value))}
          className="w-full rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm theme-focus"
          placeholder={placeholder}
          inputMode="numeric"
          maxLength={10}
        />
        <input
          ref={pickerRef}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={openPicker}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] theme-focus"
          aria-label={openCalendarLabel}
          title={openCalendarLabel}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
            <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function roleBadge(role: EntityRole) {
  const cls: Record<EntityRole, string> = {
    viewer: 'theme-subtle',
    trader: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    entity_admin: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  }
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${cls[role] ?? 'theme-subtle'}`}>
      {formatStatusLabel(role)}
    </span>
  )
}

function revokedBadge() {
  return (
    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
      revoked
    </span>
  )
}

function UserEntityLinksContent() {
  const { t } = useTranslation('common')
  const { getEnglishTooltip } = useEnglishTooltips()
  const router = useRouter()

  const [links, setLinks] = useState<UserEntityLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showActiveOnly, setShowActiveOnly] = useState(true)
  const [sortField, setSortField] = useState<string>('granted_at')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Filter inputs
  const [filterUser, setFilterUser] = useState('')
  const [filterLEI, setFilterLEI] = useState('')

  // Form state
  const [showGrant, setShowGrant] = useState(false)
  const [grantForm, setGrantForm] = useState<GrantForm>(EMPTY_GRANT)
  const [grantUsers, setGrantUsers] = useState<UserOption[]>([])
  const [grantUsersError, setGrantUsersError] = useState('')
  const [userPickerFilter, setUserPickerFilter] = useState('')

  const [editTarget, setEditTarget] = useState<UserEntityLink | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [leiError, setLeiError] = useState('')
  const [leiValidating, setLeiValidating] = useState(false)
  const [leiNames, setLeiNames] = useState<Record<string, string>>({})

  const fetchLinks = useCallback(async (overrides?: { filterUser?: string; filterLEI?: string }) => {
    setLoading(true)
    setError('')
    const token = getAuthToken()
    if (!token) {
      router.push('/login')
      return
    }

    const effectiveFilterUser = overrides?.filterUser !== undefined ? overrides.filterUser : filterUser
    const effectiveFilterLEI = overrides?.filterLEI !== undefined ? overrides.filterLEI : filterLEI

    try {
      let url = `${API_BASE_URL}/api/v1/user-entity-links?limit=200`
      if (!showActiveOnly) {
        url = `${url}&include_revoked=true`
      }
      if (effectiveFilterUser.trim()) {
        url = `${API_BASE_URL}/api/v1/user-entity-links/user/${encodeURIComponent(effectiveFilterUser.trim())}`
      } else if (effectiveFilterLEI.trim()) {
        url = `${API_BASE_URL}/api/v1/user-entity-links/lei/${encodeURIComponent(effectiveFilterLEI.trim())}`
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401 || res.status === 403) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        setError(t('userEntityLinks.errors.loadFailed'))
        return
      }
      const data = await res.json()
      // Normalise: endpoint may return array or {data: [...]}
      const raw: UserEntityLink[] = Array.isArray(data) ? data : (data.data ?? [])
      setLinks(raw)
    } catch {
      setError(t('userEntityLinks.errors.network'))
    } finally {
      setLoading(false)
    }
  }, [router, t, filterUser, filterLEI, showActiveOnly])

  useEffect(() => {
    fetchLinks()
  }, [fetchLinks])

  const fetchGrantUsers = useCallback(async () => {
    const token = getAuthToken()
    if (!token) return

    const parseUsers = (payload: unknown): UserOption[] => {
      if (Array.isArray(payload)) {
        return payload as UserOption[]
      }
      if (payload && typeof payload === 'object') {
        const candidate = payload as { data?: unknown; users?: unknown; results?: unknown }
        if (Array.isArray(candidate.data)) return candidate.data as UserOption[]
        if (Array.isArray(candidate.users)) return candidate.users as UserOption[]
        if (Array.isArray(candidate.results)) return candidate.results as UserOption[]
      }
      return []
    }

    try {
      setGrantUsersError('')
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/users?status=active&limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.status === 401 || res.status === 403) {
        setGrantUsers([])
        setGrantUsersError(t('userEntityLinks.errors.userLoadUnauthorized'))
        return
      }

      if (!res.ok) {
        setGrantUsers([])
        setGrantUsersError(t('userEntityLinks.errors.userLoadFailed'))
        return
      }

      const data = await res.json()
      let users = parseUsers(data)

      // Some deployments store status values differently; retry without status filter.
      if (users.length === 0) {
        const retryRes = await fetch(`${API_BASE_URL}/api/v1/auth/users?limit=200`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (retryRes.ok) {
          const retryData = await retryRes.json()
          const retryUsers = parseUsers(retryData)
          const activeUsers = retryUsers.filter((u) => (u.status || '').toLowerCase() === 'active')
          users = activeUsers.length > 0 ? activeUsers : retryUsers
        }
      }

      setGrantUsers(users)
    } catch {
      setGrantUsers([])
      setGrantUsersError(t('userEntityLinks.errors.network'))
    }
  }, [t])

  useEffect(() => {
    fetchGrantUsers()
  }, [fetchGrantUsers])

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
      // Best-effort enrichment only.
    }
  }, [])

  useEffect(() => {
    const codes = Array.from(new Set(links.map((link) => link.lei).filter(Boolean))).filter((code) => !leiNames[code])
    if (codes.length > 0) {
      fetchLeiNames(codes)
    }
  }, [fetchLeiNames, leiNames, links])

  const filteredGrantUsers = userPickerFilter.trim()
    ? grantUsers.filter((u) => {
        const query = userPickerFilter.trim().toLowerCase()
        return (
          u.username.toLowerCase().includes(query) ||
          (u.full_name || '').toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query)
        )
      })
    : grantUsers

  const grantUserOptions = [
    { value: '', label: t('userEntityLinks.form.selectUserPlaceholder') },
    ...filteredGrantUsers.map((u) => ({
      value: u.id,
      label: `${u.username} - ${u.full_name || u.email} (${u.status || 'unknown'})`,
      title: `${u.username} - ${u.full_name || u.email} (${u.status || 'unknown'})`,
    })),
  ]

  const selectedGrantUser = grantUsers.find((u) => u.id === grantForm.user_id)

  const handleLEIBlur = async () => {
    const lei = grantForm.lei.trim().toUpperCase()
    if (lei.length !== 20) {
      setLeiError('')
      return
    }
    const token = getAuthToken()
    if (!token) return
    setLeiValidating(true)
    setLeiError('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/lei/${encodeURIComponent(lei)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 404) {
        setLeiError(t('userEntityLinks.errors.leiNotFound'))
      } else if (res.ok) {
        const data = await res.json()
        const legalName = data?.legal_name ?? data?.data?.legal_name ?? data?.record?.legal_name
        if (typeof legalName === 'string' && legalName.trim()) {
          setLeiNames((current) => ({ ...current, [lei]: legalName }))
        }
      }
    } catch {
      // Don't block on network errors
    } finally {
      setLeiValidating(false)
    }
  }

  const displayed = useMemo(() => {
    const base = showActiveOnly ? links.filter((l) => !l.revoked_at) : links
    return [...base].sort((a, b) => {
      let valA: string
      let valB: string
      switch (sortField) {
        case 'user': {
          const uA = grantUsers.find((u) => u.id === a.user_id)
          const uB = grantUsers.find((u) => u.id === b.user_id)
          valA = uA ? uA.username : a.user_id
          valB = uB ? uB.username : b.user_id
          break
        }
        case 'lei':
          valA = a.lei
          valB = b.lei
          break
        case 'role':
          valA = a.entity_role
          valB = b.entity_role
          break
        case 'children_scope':
          valA = a.children_scope
          valB = b.children_scope
          break
        case 'granted_at':
          valA = a.granted_at ?? ''
          valB = b.granted_at ?? ''
          break
        case 'expires_at':
          valA = a.expires_at ?? ''
          valB = b.expires_at ?? ''
          break
        case 'status':
          valA = a.revoked_at ? '1' : '0'
          valB = b.revoked_at ? '1' : '0'
          break
        default:
          return 0
      }
      const cmp = valA.localeCompare(valB, undefined, { sensitivity: 'base' })
      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [links, showActiveOnly, sortField, sortDirection, grantUsers])

  const handleGrant = async () => {
    const token = getAuthToken()
    if (!token) return
    setActionLoading('grant')
    setError('')
    setSuccess('')
    const leiToCheck = grantForm.lei.trim().toUpperCase()
    if (leiToCheck.length === 20) {
      try {
        const leiRes = await fetch(`${API_BASE_URL}/api/v1/lei/${encodeURIComponent(leiToCheck)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (leiRes.status === 404) {
          setError(t('userEntityLinks.errors.leiNotFound'))
          setActionLoading(null)
          return
        }
      } catch {
        // Let the backend validate if network check fails
      }
    }
    try {
      const body: Record<string, unknown> = {
        user_id: grantForm.user_id.trim(),
        lei: grantForm.lei.trim().toUpperCase(),
        entity_role: grantForm.entity_role,
        children_scope: grantForm.children_scope,
        notes: grantForm.notes,
      }
      if (grantForm.expires_at) {
        const iso = dateOnlyToISOString(grantForm.expires_at)
        if (!iso) {
          setError(t('userEntityLinks.errors.invalidDateFormat'))
          setActionLoading(null)
          return
        }
        body.expires_at = iso
      }
      const res = await fetch(`${API_BASE_URL}/api/v1/user-entity-links`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || t('userEntityLinks.errors.grantFailed'))
        return
      }
      setSuccess(t('userEntityLinks.success.granted'))
      setShowGrant(false)
      setGrantForm(EMPTY_GRANT)
      setUserPickerFilter('')
      setFilterUser('')
      setFilterLEI('')
      await fetchLinks({ filterUser: '', filterLEI: '' })
    } catch {
      setError(t('userEntityLinks.errors.network'))
    } finally {
      setActionLoading(null)
    }
  }

  const openEdit = (link: UserEntityLink) => {
    setEditTarget(link)
    setEditForm({
      entity_role: link.entity_role,
      children_scope: link.children_scope,
      expires_at: link.expires_at ? link.expires_at.split('T')[0] : '',
      notes: link.notes,
    })
    setShowGrant(false)
  }

  const handleEdit = async () => {
    if (!editTarget || !editForm) return
    const token = getAuthToken()
    if (!token) return
    setActionLoading('edit')
    setError('')
    setSuccess('')
    try {
      const body: Record<string, unknown> = {
        entity_role: editForm.entity_role,
        children_scope: editForm.children_scope,
        notes: editForm.notes,
      }
      if (editForm.expires_at) {
        const iso = dateOnlyToISOString(editForm.expires_at)
        if (!iso) {
          setError(t('userEntityLinks.errors.invalidDateFormat'))
          setActionLoading(null)
          return
        }
        body.expires_at = iso
      }
      const res = await fetch(`${API_BASE_URL}/api/v1/user-entity-links/${editTarget.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || t('userEntityLinks.errors.updateFailed'))
        return
      }
      setSuccess(t('userEntityLinks.success.updated'))
      setEditTarget(null)
      setEditForm(null)
      await fetchLinks()
    } catch {
      setError(t('userEntityLinks.errors.network'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleRevoke = async (id: string) => {
    const token = getAuthToken()
    if (!token) return
    setActionLoading(id + '-revoke')
    setError('')
    setSuccess('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/user-entity-links/${id}/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || t('userEntityLinks.errors.revokeFailed'))
        return
      }
      setSuccess(t('userEntityLinks.success.revoked'))
      await fetchLinks()
    } catch {
      setError(t('userEntityLinks.errors.network'))
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title={t('userEntityLinks.title')}
          subtitle={t('userEntityLinks.subtitle')}
          titleTooltip={getEnglishTooltip('userEntityLinks.title')}
          subtitleTooltip={getEnglishTooltip('userEntityLinks.subtitle')}
          backHref="/dashboard"
          docsHref={buildDocsUrl('admin/user-entity-links')}
        />

        {error && <Alert variant="error" className="mb-4">{error}</Alert>}
        {success && <Alert variant="success" className="mb-4">{success}</Alert>}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <SearchInputWithOverflowTooltip
            type="text"
            value={filterUser}
            onChange={(e) => { setFilterUser(e.target.value); setFilterLEI('') }}
            onBlur={() => fetchLinks()}
            onKeyDown={(e) => e.key === 'Enter' && fetchLinks()}
            placeholder={t('userEntityLinks.filters.byUser')}
            className="rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm theme-focus w-72"
          />
          <SearchInputWithOverflowTooltip
            type="text"
            value={filterLEI}
            onChange={(e) => { setFilterLEI(e.target.value.toUpperCase()); setFilterUser('') }}
            onBlur={() => fetchLinks()}
            onKeyDown={(e) => e.key === 'Enter' && fetchLinks()}
            placeholder={t('userEntityLinks.filters.byLEI')}
            className="rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm font-mono theme-focus w-56"
          />
          <button
            onClick={() => { setFilterUser(''); setFilterLEI(''); }}
            className="px-3 py-2 text-sm rounded-md theme-btn-neutral"
          >
            {t('userEntityLinks.filters.clear')}
          </button>
          <label className="flex items-center gap-2 text-sm theme-text-muted ml-auto">
            <input
              type="checkbox"
              checked={showActiveOnly}
              onChange={(e) => setShowActiveOnly(e.target.checked)}
              className="h-4 w-4"
            />
            {t('userEntityLinks.filters.activeOnly')}
          </label>
          <button
            onClick={() => { setShowGrant(true); setEditTarget(null); }}
            disabled={showGrant || editTarget !== null}
            className="px-4 py-2 rounded-md text-sm font-medium theme-btn-primary disabled:opacity-60"
          >
            {t('userEntityLinks.actions.grant')}
          </button>
        </div>

        {/* Grant form */}
        {showGrant && (
          <div className="mb-6 p-5 rounded-lg theme-panel border border-[rgb(var(--border-rgb))]">
            <h2 className="text-base font-semibold mb-4">{t('userEntityLinks.form.grantTitle')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('userEntityLinks.form.user')} *
                </label>
                <SearchInputWithOverflowTooltip
                  type="text"
                  value={userPickerFilter}
                  onChange={(e) => setUserPickerFilter(e.target.value)}
                  className="w-full rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm theme-focus mb-2"
                  placeholder={t('userEntityLinks.form.userPickerSearch')}
                />
                <ThemedSelect
                  value={grantForm.user_id}
                  onChange={(value) => setGrantForm((f) => ({ ...f, user_id: value }))}
                  options={grantUserOptions}
                  ariaLabel={t('userEntityLinks.form.user')}
                  className="w-full"
                />
                {grantUsersError && (
                  <p className="mt-1 text-xs text-red-700 dark:text-red-300">{grantUsersError}</p>
                )}
                {selectedGrantUser && (
                  <p className="mt-1 text-xs theme-text-muted">
                    {t('userEntityLinks.form.selectedUserSummary', {
                      username: selectedGrantUser.username,
                      name: selectedGrantUser.full_name || selectedGrantUser.email,
                    })}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('userEntityLinks.form.lei')} *
                </label>
                <input
                  type="text"
                  value={grantForm.lei}
                  onChange={(e) => { setLeiError(''); setGrantForm((f) => ({ ...f, lei: e.target.value.toUpperCase() })) }}
                  onBlur={handleLEIBlur}
                  className={`w-full rounded-md border bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm font-mono theme-focus ${leiError ? 'border-red-500' : 'border-[rgb(var(--border-rgb))]'}`}
                  placeholder="20-character LEI"
                  maxLength={20}
                />
                {leiValidating && <p className="mt-1 text-xs theme-text-muted">{t('common.loading')}</p>}
                {leiError && <p className="mt-1 text-xs text-red-700 dark:text-red-300">{leiError}</p>}
                {!leiError && leiNames[grantForm.lei.trim().toUpperCase()] && (
                  <p className="mt-1 text-xs theme-text-muted">{leiNames[grantForm.lei.trim().toUpperCase()]}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('userEntityLinks.form.role')}
                </label>
                <ThemedSelect
                  value={grantForm.entity_role}
                  onChange={(value) => setGrantForm((f) => ({ ...f, entity_role: value as EntityRole }))}
                  options={ROLE_OPTIONS}
                  ariaLabel={t('userEntityLinks.form.role')}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('userEntityLinks.form.expiresAt')}
                </label>
                <DateOnlyField
                  value={grantForm.expires_at}
                  onChange={(value) => setGrantForm((f) => ({ ...f, expires_at: value }))}
                  placeholder={t('userEntityLinks.form.datePlaceholder')}
                  openCalendarLabel={t('userEntityLinks.form.openCalendar')}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('userEntityLinks.form.notes')}
                </label>
                <input
                  type="text"
                  value={grantForm.notes}
                  onChange={(e) => setGrantForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm theme-focus"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('userEntityLinks.form.childrenScope')}
                </label>
                <ThemedSelect
                  ariaLabel={t('userEntityLinks.form.childrenScope')}
                  options={CHILDREN_SCOPE_OPTIONS.map((opt) => ({ value: opt.value, label: t(opt.label) }))}
                  value={grantForm.children_scope}
                  onChange={(scope) => {
                    setGrantForm((f) => ({
                      ...f,
                      children_scope: scope as ChildrenScope,
                    }))
                  }}
                />
                <p className="mt-1 text-xs theme-text-muted">
                  {grantForm.children_scope === 'direct'
                    ? t('userEntityLinks.form.childrenScopeDirectHint')
                    : grantForm.children_scope === 'all'
                      ? t('userEntityLinks.form.childrenScopeAllHint')
                      : t('userEntityLinks.form.childrenScopeNoneHint')}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleGrant}
                disabled={!grantForm.user_id.trim() || !grantForm.lei.trim() || actionLoading === 'grant'}
                className="px-4 py-2 text-sm rounded-md theme-btn-primary disabled:opacity-60"
              >
                {actionLoading === 'grant' ? t('common.saving') : t('userEntityLinks.actions.grantSave')}
              </button>
              <button
                onClick={() => setShowGrant(false)}
                className="px-4 py-2 text-sm rounded-md theme-btn-neutral"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Edit form */}
        {editTarget && editForm && (
          <div className="mb-6 p-5 rounded-lg theme-panel border border-[rgb(var(--border-rgb))]">
            <h2 className="text-base font-semibold mb-1">{t('userEntityLinks.form.editTitle')}</h2>
            <p className="text-xs theme-text-muted mb-1">
              {(() => {
                const u = grantUsers.find((usr) => usr.id === editTarget.user_id)
                const userDisplay = u
                  ? `${u.username} (${u.full_name || u.email})`
                  : editTarget.user_id
                return <><span>{userDisplay}</span>{' → '}<span className="font-mono">{editTarget.lei}</span></>
              })()}
            </p>
            {leiNames[editTarget.lei] && (
              <p className="mb-4 text-xs theme-text-muted">{leiNames[editTarget.lei]}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('userEntityLinks.form.role')}
                </label>
                <ThemedSelect
                  value={editForm.entity_role}
                  onChange={(value) => setEditForm((f) => f ? { ...f, entity_role: value as EntityRole } : f)}
                  options={ROLE_OPTIONS}
                  ariaLabel={t('userEntityLinks.form.role')}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('userEntityLinks.form.expiresAt')}
                </label>
                <DateOnlyField
                  value={editForm.expires_at}
                  onChange={(value) => setEditForm((f) => f ? { ...f, expires_at: value } : f)}
                  placeholder={t('userEntityLinks.form.datePlaceholder')}
                  openCalendarLabel={t('userEntityLinks.form.openCalendar')}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('userEntityLinks.form.notes')}
                </label>
                <input
                  type="text"
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => f ? { ...f, notes: e.target.value } : f)}
                  className="w-full rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm theme-focus"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 theme-text-muted">
                  {t('userEntityLinks.form.childrenScope')}
                </label>
                <ThemedSelect
                  ariaLabel={t('userEntityLinks.form.childrenScope')}
                  options={CHILDREN_SCOPE_OPTIONS.map((opt) => ({ value: opt.value, label: t(opt.label) }))}
                  value={editForm.children_scope}
                  onChange={(scope) => {
                    setEditForm((f) =>
                      f
                        ? {
                            ...f,
                            children_scope: scope as ChildrenScope,
                          }
                        : f,
                    )
                  }}
                />
                <p className="mt-1 text-xs theme-text-muted">
                  {editForm.children_scope === 'direct'
                    ? t('userEntityLinks.form.childrenScopeDirectHint')
                    : editForm.children_scope === 'all'
                      ? t('userEntityLinks.form.childrenScopeAllHint')
                      : t('userEntityLinks.form.childrenScopeNoneHint')}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleEdit}
                disabled={actionLoading === 'edit'}
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

        {/* Table */}
        {loading ? (
          <LoadingSpinner message={t('userEntityLinks.loading')} />
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 theme-text-muted">{t('userEntityLinks.empty')}</div>
        ) : (
          <div className="theme-table-shell border-2 backdrop-blur-sm rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="theme-table-header border-b border-[rgb(var(--border-rgb))]">
                  <SortableHeaderCell
                    className="px-4 py-3 font-medium theme-table-header-cell"
                    label={<span title={getEnglishTooltip('userEntityLinks.columns.userId')}>{t('userEntityLinks.columns.userId')}</span>}
                    onSort={() => handleSort('user')}
                    isActiveSort={sortField === 'user'}
                    sortDirection={sortDirection}
                  />
                  <SortableHeaderCell
                    className="px-4 py-3 font-medium theme-table-header-cell"
                    label={<span title={getEnglishTooltip('userEntityLinks.columns.lei')}>{t('userEntityLinks.columns.lei')}</span>}
                    onSort={() => handleSort('lei')}
                    isActiveSort={sortField === 'lei'}
                    sortDirection={sortDirection}
                  />
                  <SortableHeaderCell
                    className="px-4 py-3 font-medium theme-table-header-cell"
                    label={<span title={getEnglishTooltip('userEntityLinks.columns.role')}>{t('userEntityLinks.columns.role')}</span>}
                    onSort={() => handleSort('role')}
                    isActiveSort={sortField === 'role'}
                    sortDirection={sortDirection}
                  />
                  <SortableHeaderCell
                    className="px-4 py-3 font-medium theme-table-header-cell"
                    align="center"
                    label={<span title={getEnglishTooltip('userEntityLinks.columns.children')}>{t('userEntityLinks.columns.children')}</span>}
                    onSort={() => handleSort('children_scope')}
                    isActiveSort={sortField === 'children_scope'}
                    sortDirection={sortDirection}
                  />
                  <SortableHeaderCell
                    className="px-4 py-3 font-medium theme-table-header-cell"
                    label={<span title={getEnglishTooltip('userEntityLinks.columns.grantedAt')}>{t('userEntityLinks.columns.grantedAt')}</span>}
                    onSort={() => handleSort('granted_at')}
                    isActiveSort={sortField === 'granted_at'}
                    sortDirection={sortDirection}
                  />
                  <SortableHeaderCell
                    className="px-4 py-3 font-medium theme-table-header-cell"
                    label={<span title={getEnglishTooltip('userEntityLinks.columns.expiresAt')}>{t('userEntityLinks.columns.expiresAt')}</span>}
                    onSort={() => handleSort('expires_at')}
                    isActiveSort={sortField === 'expires_at'}
                    sortDirection={sortDirection}
                  />
                  <SortableHeaderCell
                    className="px-4 py-3 font-medium theme-table-header-cell"
                    label={<span title={getEnglishTooltip('userEntityLinks.columns.status')}>{t('userEntityLinks.columns.status')}</span>}
                    onSort={() => handleSort('status')}
                    isActiveSort={sortField === 'status'}
                    sortDirection={sortDirection}
                  />
                  <SortableHeaderCell
                    className="px-4 py-3 font-medium theme-table-header-cell"
                    label={<span title={getEnglishTooltip('userEntityLinks.columns.actions')}>{t('userEntityLinks.columns.actions')}</span>}
                    sortable={false}
                  />
                </tr>
              </thead>
              <tbody>
                {displayed.map((l) => (
                  <tr
                    key={l.id}
                    className={`border-b border-[rgb(var(--border-rgb)/0.4)] theme-table-row-hover transition-colors ${l.revoked_at ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3 align-top text-xs">
                      {(() => {
                        const u = grantUsers.find((usr) => usr.id === l.user_id)
                        return u ? (
                          <span title={l.user_id}>
                            <span className="font-medium">{u.username}</span>
                            <br />
                            <span className="opacity-60">{u.full_name || u.email}</span>
                          </span>
                        ) : (
                          <span className="font-mono opacity-70">{l.user_id}</span>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3 align-top text-xs">
                      <div className="font-mono">{l.lei}</div>
                      {leiNames[l.lei] && <div className="opacity-60">{leiNames[l.lei]}</div>}
                    </td>
                    <td className="px-4 py-3 align-top">{roleBadge(l.entity_role)}</td>
                    <td className="px-4 py-3 align-top text-center text-sm">
                      {t(`userEntityLinks.childrenScope.${l.children_scope}`)}
                    </td>
                    <td className="px-4 py-3 align-top text-xs theme-text-muted">
                      {l.granted_at ? new Date(l.granted_at).toISOString().split('T')[0] : '—'}
                    </td>
                    <td className="px-4 py-3 align-top text-xs theme-text-muted">
                      {l.expires_at ? new Date(l.expires_at).toISOString().split('T')[0] : '—'}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {l.revoked_at ? revokedBadge() : (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {t('userEntityLinks.status.active')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {!l.revoked_at && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openEdit(l)}
                            className="px-3 py-1 text-xs rounded theme-btn-neutral theme-focus"
                          >
                            {t('userEntityLinks.actions.edit')}
                          </button>
                          <button
                            onClick={() => handleRevoke(l.id)}
                            disabled={actionLoading === l.id + '-revoke'}
                            className="px-3 py-1 text-xs rounded theme-btn-neutral theme-focus disabled:opacity-60"
                          >
                            {actionLoading === l.id + '-revoke' ? t('common.saving') : t('userEntityLinks.actions.revoke')}
                          </button>
                        </div>
                      )}
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
      </div>
    </main>
  )
}

export default function UserEntityLinksPage() {
  const { t } = useTranslation('common')
  return (
    <Suspense fallback={<LoadingSpinner message={t('common.loading')} />}>
      <UserEntityLinksContent />
    </Suspense>
  )
}
