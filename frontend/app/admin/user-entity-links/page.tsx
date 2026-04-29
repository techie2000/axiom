'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
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
  entity_role: EntityRole
  include_children: boolean
  granted_by: string
  granted_at: string
  expires_at: string | null
  revoked_at: string | null
  notes: string
}

interface GrantForm {
  user_id: string
  lei: string
  entity_role: EntityRole
  include_children: boolean
  expires_at: string
  notes: string
}

interface EditForm {
  entity_role: EntityRole
  include_children: boolean
  expires_at: string
  notes: string
}

const ROLES: EntityRole[] = ['viewer', 'trader', 'entity_admin']
const ROLE_OPTIONS = ROLES.map((role) => ({ value: role, label: role }))

const EMPTY_GRANT: GrantForm = {
  user_id: '',
  lei: '',
  entity_role: 'viewer',
  include_children: false,
  expires_at: '',
  notes: '',
}

function roleBadge(role: EntityRole) {
  const cls: Record<EntityRole, string> = {
    viewer: 'theme-subtle',
    trader: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    entity_admin: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  }
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${cls[role] ?? 'theme-subtle'}`}>
      {role}
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

  // Filter inputs
  const [filterUser, setFilterUser] = useState('')
  const [filterLEI, setFilterLEI] = useState('')

  // Form state
  const [showGrant, setShowGrant] = useState(false)
  const [grantForm, setGrantForm] = useState<GrantForm>(EMPTY_GRANT)
  const [grantUsers, setGrantUsers] = useState<UserOption[]>([])
  const [userPickerFilter, setUserPickerFilter] = useState('')

  const [editTarget, setEditTarget] = useState<UserEntityLink | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)

  const fetchLinks = useCallback(async () => {
    setLoading(true)
    setError('')
    const token = getAuthToken()
    if (!token) {
      router.push('/login')
      return
    }

    try {
      let url = `${API_BASE_URL}/api/v1/user-entity-links?limit=200`
      if (filterUser.trim()) {
        url = `${API_BASE_URL}/api/v1/user-entity-links/user/${encodeURIComponent(filterUser.trim())}`
      } else if (filterLEI.trim()) {
        url = `${API_BASE_URL}/api/v1/user-entity-links/lei/${encodeURIComponent(filterLEI.trim())}`
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
  }, [router, t, filterUser, filterLEI])

  useEffect(() => {
    fetchLinks()
  }, [fetchLinks])

  const fetchGrantUsers = useCallback(async () => {
    const token = getAuthToken()
    if (!token) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/users?status=active&limit=500`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      const raw: UserOption[] = Array.isArray(data) ? data : []
      setGrantUsers(raw)
    } catch {
      // Non-blocking: grant form still works with direct ID fallback if users cannot be loaded
      setGrantUsers([])
    }
  }, [])

  useEffect(() => {
    fetchGrantUsers()
  }, [fetchGrantUsers])

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
      label: `${u.username} - ${u.full_name || u.email}`,
      title: `${u.username} - ${u.full_name || u.email}`,
    })),
  ]

  const selectedGrantUser = grantUsers.find((u) => u.id === grantForm.user_id)

  const displayed = showActiveOnly ? links.filter((l) => !l.revoked_at) : links

  const handleGrant = async () => {
    const token = getAuthToken()
    if (!token) return
    setActionLoading('grant')
    setError('')
    setSuccess('')
    try {
      const body: Record<string, unknown> = {
        user_id: grantForm.user_id.trim(),
        lei: grantForm.lei.trim().toUpperCase(),
        entity_role: grantForm.entity_role,
        include_children: grantForm.include_children,
        notes: grantForm.notes,
      }
      if (grantForm.expires_at) {
        body.expires_at = new Date(grantForm.expires_at).toISOString()
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
      await fetchLinks()
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
      include_children: link.include_children,
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
        include_children: editForm.include_children,
        notes: editForm.notes,
      }
      if (editForm.expires_at) {
        body.expires_at = new Date(editForm.expires_at).toISOString()
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
            onClick={() => { setShowGrant((v) => !v); setEditTarget(null); }}
            className="px-4 py-2 rounded-md text-sm font-medium theme-btn-primary"
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
                  onChange={(e) => setGrantForm((f) => ({ ...f, lei: e.target.value.toUpperCase() }))}
                  className="w-full rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm font-mono theme-focus"
                  placeholder="20-character LEI"
                  maxLength={20}
                />
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
                <input
                  type="date"
                  value={grantForm.expires_at}
                  onChange={(e) => setGrantForm((f) => ({ ...f, expires_at: e.target.value }))}
                  className="w-full rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm theme-focus"
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
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={grantForm.include_children}
                    onChange={(e) => setGrantForm((f) => ({ ...f, include_children: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  {t('userEntityLinks.form.includeChildren')}
                </label>
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
            <p className="text-xs theme-text-muted mb-4 font-mono">
              {editTarget.user_id} → {editTarget.lei}
            </p>
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
                <input
                  type="date"
                  value={editForm.expires_at}
                  onChange={(e) => setEditForm((f) => f ? { ...f, expires_at: e.target.value } : f)}
                  className="w-full rounded-md border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-rgb))] px-3 py-2 text-sm theme-focus"
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
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.include_children}
                    onChange={(e) => setEditForm((f) => f ? { ...f, include_children: e.target.checked } : f)}
                    className="h-4 w-4"
                  />
                  {t('userEntityLinks.form.includeChildren')}
                </label>
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
                  <th className="px-4 py-3 text-left font-medium theme-table-header-cell">
                    <span title={getEnglishTooltip('userEntityLinks.columns.userId')}>{t('userEntityLinks.columns.userId')}</span>
                  </th>
                  <th className="px-4 py-3 text-left font-medium theme-table-header-cell">
                    <span title={getEnglishTooltip('userEntityLinks.columns.lei')}>{t('userEntityLinks.columns.lei')}</span>
                  </th>
                  <th className="px-4 py-3 text-left font-medium theme-table-header-cell">
                    <span title={getEnglishTooltip('userEntityLinks.columns.role')}>{t('userEntityLinks.columns.role')}</span>
                  </th>
                  <th className="px-4 py-3 text-left font-medium theme-table-header-cell">
                    <span title={getEnglishTooltip('userEntityLinks.columns.children')}>{t('userEntityLinks.columns.children')}</span>
                  </th>
                  <th className="px-4 py-3 text-left font-medium theme-table-header-cell">
                    <span title={getEnglishTooltip('userEntityLinks.columns.grantedAt')}>{t('userEntityLinks.columns.grantedAt')}</span>
                  </th>
                  <th className="px-4 py-3 text-left font-medium theme-table-header-cell">
                    <span title={getEnglishTooltip('userEntityLinks.columns.expiresAt')}>{t('userEntityLinks.columns.expiresAt')}</span>
                  </th>
                  <th className="px-4 py-3 text-left font-medium theme-table-header-cell">
                    <span title={getEnglishTooltip('userEntityLinks.columns.status')}>{t('userEntityLinks.columns.status')}</span>
                  </th>
                  <th className="px-4 py-3 text-left font-medium theme-table-header-cell">
                    <span title={getEnglishTooltip('userEntityLinks.columns.actions')}>{t('userEntityLinks.columns.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((l) => (
                  <tr
                    key={l.id}
                    className={`border-b border-[rgb(var(--border-rgb)/0.4)] theme-table-row-hover transition-colors ${l.revoked_at ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3 align-top font-mono text-xs">{l.user_id}</td>
                    <td className="px-4 py-3 align-top font-mono text-xs">{l.lei}</td>
                    <td className="px-4 py-3 align-top">{roleBadge(l.entity_role)}</td>
                    <td className="px-4 py-3 align-top text-center text-sm">
                      {l.include_children ? '✓' : '—'}
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
