'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/PageHeader'
import Alert from '../../components/Alert'
import LoadingSpinner from '../../components/LoadingSpinner'
import { getAuthToken } from '../../lib/auth-token'

const API_BASE_URL =
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080'
    : 'http://backend:8080'

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
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    active: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    inactive: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  }
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full ${variants[status] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {label}
    </span>
  )
}

function roleBadge(role: string, label: string) {
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
        role === 'admin'
          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
          : 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300'
      }`}
    >
      {label}
    </span>
  )
}

function AdminUsersContent() {
  const { t } = useTranslation('common')
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
          backHref="/dashboard"
        />

        {isBootstrap && (
          <div className="mb-6 p-4 rounded-lg bg-amber-50 border-2 border-amber-300 dark:bg-amber-900/20 dark:border-amber-600">
            <p className="text-amber-800 dark:text-amber-300 font-medium">
              {t('admin.users.bootstrapWarning.title')}
            </p>
            <p className="text-amber-700 dark:text-amber-400 text-sm mt-1">
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
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10'
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
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            {t('admin.users.emptyWithStatus', {
              status: statusFilter
                ? getStatusLabel(statusFilter)
                : t('admin.users.filters.all').toLowerCase(),
            })}
          </div>
        ) : (
          <div className="bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('admin.users.columns.user')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('admin.users.columns.username')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('admin.users.columns.role')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('admin.users.columns.status')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('admin.users.columns.requested')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">{t('admin.users.columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-100 dark:border-white/5 hover:bg-blue-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {user.full_name || t('admin.users.fallback.none')}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs">{user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 align-top font-mono text-xs">
                      {user.username}
                    </td>
                    <td className="px-4 py-3 align-top">{roleBadge(user.role, getRoleLabel(user.role))}</td>
                    <td className="px-4 py-3 align-top">{statusBadge(user.status, getStatusLabel(user.status))}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 align-top text-xs">
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
                            className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded transition-colors"
                          >
                            {actionLoading === user.id + '-approve' ? t('admin.users.actions.loading') : t('admin.users.actions.approve')}
                          </button>
                        )}
                        {user.status === 'active' && (
                          <button
                            onClick={() => handleReject(user.id)}
                            disabled={actionLoading === user.id + '-reject'}
                            className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded transition-colors"
                          >
                            {actionLoading === user.id + '-reject' ? t('admin.users.actions.loading') : t('admin.users.actions.deactivate')}
                          </button>
                        )}
                        {/* Reactivate — never available for the permanently-locked bootstrap account */}
                        {user.status === 'inactive' && !user.is_bootstrap && (
                          <button
                            onClick={() => handleApprove(user.id)}
                            disabled={actionLoading === user.id + '-approve'}
                            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded transition-colors"
                          >
                            {actionLoading === user.id + '-approve' ? t('admin.users.actions.loading') : t('admin.users.actions.reactivate')}
                          </button>
                        )}
                        {user.status === 'inactive' && user.is_bootstrap && (
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 dark:bg-gray-700/40 dark:text-gray-400 rounded italic">
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
                            className={`px-3 py-1 text-xs rounded transition-colors ${
                              user.role === 'admin'
                                ? 'bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white'
                                : 'bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white'
                            }`}
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
          <Link href="/dashboard" className="text-blue-500 hover:text-blue-400 text-sm">
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
