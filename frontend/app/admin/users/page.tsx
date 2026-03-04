'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import PageHeader from '../../components/PageHeader'

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

function statusBadge(status: string) {
  const variants: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    active: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    inactive: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  }
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full ${variants[status] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {status}
    </span>
  )
}

function roleBadge(role: string) {
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
        role === 'admin'
          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
          : 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300'
      }`}
    >
      {role}
    </span>
  )
}

function AdminUsersContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isBootstrap = searchParams.get('bootstrap') === 'true'

  const [users, setUsers] = useState<User[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const getToken = () =>
    typeof window !== 'undefined' ? localStorage.getItem('axiom_token') : null

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
        setError('Failed to load users')
        return
      }
      const data = await res.json()
      setUsers(data ?? [])
    } catch {
      setError('Network error – please try again')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, router])

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
        setError(data.error || 'Approval failed')
      }
    } catch {
      setError('Network error')
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
        setError(data.error || 'Action failed')
      }
    } catch {
      setError('Network error')
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
        setError(data.error || 'Role change failed')
      }
    } catch {
      setError('Network error')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="User Management"
          subtitle="Review and approve user account requests"
          backHref="/"
        />

        {isBootstrap && (
          <div className="mb-6 p-4 rounded-lg bg-amber-50 border-2 border-amber-300 dark:bg-amber-900/20 dark:border-amber-600">
            <p className="text-amber-800 dark:text-amber-300 font-medium">
              ⚠️ You are logged in with the default bootstrap administrator account.
            </p>
            <p className="text-amber-700 dark:text-amber-400 text-sm mt-1">
              Approve a pending user, then use the <strong>Promote to Admin</strong> button to grant
              them admin rights. Once that real admin logs in, the bootstrap account will be
              deactivated automatically.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          </div>
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
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">Loading users…</div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            No {statusFilter || ''} users found.
          </div>
        ) : (
          <div className="bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">User</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Username</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Requested</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Actions</th>
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
                        {user.full_name || '–'}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs">{user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 align-top font-mono text-xs">
                      {user.username}
                    </td>
                    <td className="px-4 py-3 align-top">{roleBadge(user.role)}</td>
                    <td className="px-4 py-3 align-top">{statusBadge(user.status)}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 align-top text-xs">
                      {user.created_at && !user.created_at.startsWith('0001-')
                        ? new Date(user.created_at).toISOString().split('T')[0]
                        : '–'}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-2" role="group" aria-label="User actions">
                        {user.status === 'pending' && (
                          <button
                            onClick={() => handleApprove(user.id)}
                            disabled={actionLoading === user.id + '-approve'}
                            className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded transition-colors"
                          >
                            {actionLoading === user.id + '-approve' ? '…' : 'Approve'}
                          </button>
                        )}
                        {user.status === 'active' && (
                          <button
                            onClick={() => handleReject(user.id)}
                            disabled={actionLoading === user.id + '-reject'}
                            className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded transition-colors"
                          >
                            {actionLoading === user.id + '-reject' ? '…' : 'Deactivate'}
                          </button>
                        )}
                        {/* Reactivate — never available for the permanently-locked bootstrap account */}
                        {user.status === 'inactive' && !user.is_bootstrap && (
                          <button
                            onClick={() => handleApprove(user.id)}
                            disabled={actionLoading === user.id + '-approve'}
                            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded transition-colors"
                          >
                            {actionLoading === user.id + '-approve' ? '…' : 'Reactivate'}
                          </button>
                        )}
                        {user.status === 'inactive' && user.is_bootstrap && (
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 dark:bg-gray-700/40 dark:text-gray-400 rounded italic">
                            Permanently locked
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
                                ? 'Demote to regular user'
                                : 'Promote to administrator'
                            }
                            className={`px-3 py-1 text-xs rounded transition-colors ${
                              user.role === 'admin'
                                ? 'bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white'
                                : 'bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white'
                            }`}
                          >
                            {actionLoading === user.id + '-role'
                              ? '…'
                              : user.role === 'admin'
                                ? 'Demote'
                                : 'Promote to Admin'}
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
          <Link href="/" className="text-blue-500 hover:text-blue-400 text-sm">
            ← Back to Home
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-500">
          Loading…
        </div>
      }
    >
      <AdminUsersContent />
    </Suspense>
  )
}
