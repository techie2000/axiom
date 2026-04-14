'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/PageHeader'
import Alert from '../../components/Alert'
import LoadingSpinner from '../../components/LoadingSpinner'
import { getApiBaseUrl } from '../../lib/api-base'
import { getAuthToken } from '../../lib/auth-token'
import { buildDocsUrl } from '../../lib/docsLinks'
import { useEnglishTooltips } from '../../lib/useEnglishTooltips'

const API_BASE_URL = getApiBaseUrl()

interface User {
  id: string
  email: string
  username: string
  full_name: string
  role: string
  status: string
  is_bootstrap: boolean
  approved_by?: string
  approved_at?: string
  created_at: string
}

function statusBadge(status: string, label: string) {
  const variants: Record<string, string> = {
    pending: 'theme-subtle',
    active: 'theme-subtle',
    inactive: 'theme-subtle',
  }
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full ${variants[status] ?? 'theme-subtle'}`}
    >
      {label}
    </span>
  )
}

function roleBadge(role: string, label: string) {
  return (
    <span className="px-2 py-0.5 text-xs font-medium rounded-full theme-subtle">
      {label}
    </span>
  )
}

function AdminUsersContent() {
  const { t } = useTranslation('common')
  const { getEnglishTooltip } = useEnglishTooltips()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isBootstrap = searchParams.get('bootstrap') === 'true'

  const [users, setUsers] = useState<User[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const getRoleLabel = (role: string) => {
    if (role === 'admin') return t('admin.users.roles.admin')
    if (role === 'user') return t('admin.users.roles.user')
    return role
  }

  const getStatusLabel = (status: string) => {
    if (status === 'pending') return t('admin.users.status.pending')
    if (status === 'active') return t('admin.users.status.active')
    if (status === 'inactive') return t('admin.users.status.inactive')
    return status
  }

  const getToken = () => getAuthToken()

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    const token = getToken()
    if (!token) {
      router.push('/login')
      return
    }
    try {
      const url = statusFilter
        ? `${API_BASE_URL}/api/v1/auth/users?status=${statusFilter}&limit=100`
        : `${API_BASE_URL}/api/v1/auth/users?limit=100`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401 || res.status === 403) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        setError(t('admin.users.errors.loadFailed'))
        return
      }
      const data = await res.json()
      setUsers(data ?? [])
    } catch {
      setError(t('admin.users.errors.networkRetry'))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, router, t])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleApprove = async (id: string) => {
    const token = getToken()
    if (!token) return
    setActionLoading(id + '-approve')
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/users/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        await fetchUsers()
      } else {
        const data = await res.json()
        setError(data.error || t('admin.users.errors.approvalFailed'))
      }
    } catch {
      setError(t('admin.users.errors.network'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (id: string) => {
    const token = getToken()
    if (!token) return
    setActionLoading(id + '-reject')
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/users/${id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        await fetchUsers()
      } else {
        const data = await res.json()
        setError(data.error || t('admin.users.errors.actionFailed'))
      }
    } catch {
      setError(t('admin.users.errors.network'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleRoleChange = async (id: string, newRole: string) => {
    const token = getToken()
    if (!token) return
    setActionLoading(id + '-role')
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/users/${id}/role`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        await fetchUsers()
      } else {
        const data = await res.json()
        setError(data.error || t('admin.users.errors.roleChangeFailed'))
      }
    } catch {
      setError(t('admin.users.errors.network'))
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title={t('admin.users.title')}
          subtitle={t('admin.users.subtitle')}
          titleTooltip={getEnglishTooltip('admin.users.title')}
          subtitleTooltip={getEnglishTooltip('admin.users.subtitle')}
          backHref="/dashboard"
          docsHref={buildDocsUrl('admin/user-approvals/')}
        />

        {isBootstrap && (
          <div className="mb-6 p-4 rounded-lg theme-panel border-2 border-[rgb(var(--border-rgb)/0.7)]">
            <p className="font-medium">
              {t('admin.users.bootstrapWarning.title')}
            </p>
            <p className="theme-text-muted text-sm mt-1">
              {t('admin.users.bootstrapWarning.bodyBefore')}{' '}
              <strong>{t('admin.users.actions.promoteToAdmin')}</strong>{' '}
              {t('admin.users.bootstrapWarning.bodyAfter')}
            </p>
          </div>
        )}

        {error && (
          <Alert variant="error" className="mb-4">{error}</Alert>
        )}

        <div className="flex gap-2 mb-6">
          {(['pending', 'active', 'inactive', ''] as const).map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setStatusFilter(s)}
              title={s === '' ? getEnglishTooltip('admin.users.filters.all') : undefined}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'theme-btn-primary'
                  : 'theme-btn-neutral'
              }`}
            >
              {s === ''
                ? t('admin.users.filters.all')
                : getStatusLabel(s)}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingSpinner message={t('admin.users.loadingUsers')} />
        ) : users.length === 0 ? (
          <div className="text-center py-16 theme-text-muted">
            {t('admin.users.emptyWithStatus', {
              status: statusFilter
                ? getStatusLabel(statusFilter)
                : t('admin.users.filters.all').toLowerCase(),
            })}
          </div>
        ) : (
          <div className="theme-table-shell border-2 backdrop-blur-sm rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="theme-table-header border-b border-[rgb(var(--border-rgb))]">
                  <th className="px-4 py-3 text-left font-medium theme-table-header-cell"><span title={getEnglishTooltip('admin.users.columns.user')}>{t('admin.users.columns.user')}</span></th>
                  <th className="px-4 py-3 text-left font-medium theme-table-header-cell"><span title={getEnglishTooltip('admin.users.columns.username')}>{t('admin.users.columns.username')}</span></th>
                  <th className="px-4 py-3 text-left font-medium theme-table-header-cell"><span title={getEnglishTooltip('admin.users.columns.role')}>{t('admin.users.columns.role')}</span></th>
                  <th className="px-4 py-3 text-left font-medium theme-table-header-cell"><span title={getEnglishTooltip('admin.users.columns.status')}>{t('admin.users.columns.status')}</span></th>
                  <th className="px-4 py-3 text-left font-medium theme-table-header-cell"><span title={getEnglishTooltip('admin.users.columns.requested')}>{t('admin.users.columns.requested')}</span></th>
                  <th className="px-4 py-3 text-left font-medium theme-table-header-cell"><span title={getEnglishTooltip('admin.users.columns.actions')}>{t('admin.users.columns.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-[rgb(var(--border-rgb)/0.4)] theme-table-row-hover transition-colors"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium">
                        {user.full_name || t('admin.users.fallback.none')}
                      </div>
                      <div className="theme-text-muted text-xs">{user.email}</div>
                    </td>
                    <td className="px-4 py-3 theme-text-muted align-top font-mono text-xs">
                      {user.username}
                    </td>
                    <td className="px-4 py-3 align-top">{roleBadge(user.role, getRoleLabel(user.role))}</td>
                    <td className="px-4 py-3 align-top">{statusBadge(user.status, getStatusLabel(user.status))}</td>
                    <td className="px-4 py-3 theme-text-muted align-top text-xs">
                      {user.created_at && !user.created_at.startsWith('0001-')
                        ? new Date(user.created_at).toISOString().split('T')[0]
                        : t('admin.users.fallback.none')}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-2" role="group" aria-label={t('admin.users.aria.userActions')}>
                        {user.status === 'pending' && (
                          <button
                            onClick={() => handleApprove(user.id)}
                            disabled={actionLoading === user.id + '-approve'}
                            title={getEnglishTooltip('admin.users.actions.approve')}
                            className="px-3 py-1 text-xs rounded theme-btn-primary theme-focus disabled:opacity-60"
                          >
                            {actionLoading === user.id + '-approve' ? t('admin.users.actions.loading') : t('admin.users.actions.approve')}
                          </button>
                        )}
                        {user.status === 'active' && (
                          <button
                            onClick={() => handleReject(user.id)}
                            disabled={actionLoading === user.id + '-reject'}
                            title={getEnglishTooltip('admin.users.actions.deactivate')}
                            className="px-3 py-1 text-xs rounded theme-btn-primary theme-focus disabled:opacity-60"
                          >
                            {actionLoading === user.id + '-reject' ? t('admin.users.actions.loading') : t('admin.users.actions.deactivate')}
                          </button>
                        )}
                        {/* Reactivate — never available for the permanently-locked bootstrap account */}
                        {user.status === 'inactive' && !user.is_bootstrap && (
                          <button
                            onClick={() => handleApprove(user.id)}
                            disabled={actionLoading === user.id + '-approve'}
                            title={getEnglishTooltip('admin.users.actions.reactivate')}
                            className="px-3 py-1 text-xs rounded theme-btn-primary theme-focus disabled:opacity-60"
                          >
                            {actionLoading === user.id + '-approve' ? t('admin.users.actions.loading') : t('admin.users.actions.reactivate')}
                          </button>
                        )}
                        {user.status === 'inactive' && user.is_bootstrap && (
                          <span className="px-2 py-1 text-xs theme-subtle rounded italic">
                            {t('admin.users.status.permanentlyLocked')}
                          </span>
                        )}
                        {/* Role change — only shown for active non-bootstrap users */}
                        {user.status === 'active' && !user.is_bootstrap && (
                          <button
                            onClick={() =>
                              handleRoleChange(user.id, user.role === 'admin' ? 'user' : 'admin')
                            }
                            disabled={actionLoading === user.id + '-role'}
                            title={
                              user.role === 'admin'
                                ? t('admin.users.actions.demoteTooltip')
                                : t('admin.users.actions.promoteTooltip')
                            }
                            className="px-3 py-1 text-xs rounded theme-btn-primary theme-focus disabled:opacity-60"
                          >
                            {actionLoading === user.id + '-role'
                              ? t('admin.users.actions.loading')
                              : user.role === 'admin'
                                ? t('admin.users.actions.demote')
                                : t('admin.users.actions.promoteToAdmin')}
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
          <Link href="/dashboard" className="theme-link hover:opacity-80 text-sm" title={getEnglishTooltip('nav.backToDashboard')}>
            {t('nav.backToDashboard')}
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function AdminUsersPage() {
  const { t } = useTranslation('common')

  return (
    <Suspense fallback={<LoadingSpinner message={t('common.loading')} />}>
      <AdminUsersContent />
    </Suspense>
  )
}
