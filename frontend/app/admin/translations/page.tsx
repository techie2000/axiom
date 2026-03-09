'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import '../../lib/i18n'
import PageHeader from '../../components/PageHeader'
import Alert from '../../components/Alert'
import Badge from '../../components/Badge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { SUPPORTED_LANGUAGES } from '../../lib/i18n'

const API_BASE_URL =
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080'
    : 'http://backend:8080'

interface UITranslation {
  id: string
  translation_key: string
  language_code: string
  translation_value: string
  status: 'pending' | 'approved' | 'rejected'
  notes?: string
  submitted_by?: string
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
  updated_at: string
}

function statusBadge(status: string, t: (key: string) => string) {
  const variants: Record<string, 'yellow' | 'green' | 'red'> = {
    pending: 'yellow',
    approved: 'green',
    rejected: 'red',
  }
  const labels: Record<string, string> = {
    pending: t('admin.translations.statusPending'),
    approved: t('admin.translations.statusApproved'),
    rejected: t('admin.translations.statusRejected'),
  }
  return (
    <Badge variant={variants[status] ?? 'gray'} shape="pill">
      {labels[status] ?? status}
    </Badge>
  )
}

interface TranslationFormData {
  translation_key: string
  language_code: string
  translation_value: string
  notes: string
}

const EMPTY_FORM: TranslationFormData = {
  translation_key: '',
  language_code: 'en',
  translation_value: '',
  notes: '',
}

export default function AdminTranslationsPage() {
  const router = useRouter()
  const { t } = useTranslation('common')

  const [translations, setTranslations] = useState<UITranslation[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Filters
  const [langFilter, setLangFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 50

  // Form / modal state
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<TranslationFormData>(EMPTY_FORM)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const getToken = () =>
    typeof window !== 'undefined' ? localStorage.getItem('axiom_token') : null

  const fetchTranslations = useCallback(async () => {
    setLoading(true)
    setError('')
    const token = getToken()
    if (!token) {
      router.push('/login')
      return
    }
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(page * pageSize),
      })
      if (langFilter) params.set('language', langFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (search) params.set('search', search)

      const res = await fetch(`${API_BASE_URL}/api/v1/translations?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load translations')
      const data = await res.json()
      setTranslations(data.records ?? [])
      setTotal(data.total ?? 0)
    } catch {
      setError('Failed to load translations')
    } finally {
      setLoading(false)
    }
  }, [router, langFilter, statusFilter, search, page])

  useEffect(() => {
    fetchTranslations()
  }, [fetchTranslations])

  // Close form on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowForm(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const handleApprove = async (id: string) => {
    setActionLoading(id + '-approve')
    const token = getToken()
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/translations/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to approve')
      showSuccess(t('admin.translations.approveSuccess'))
      fetchTranslations()
    } catch {
      setError('Failed to approve translation')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (id: string) => {
    setActionLoading(id + '-reject')
    const token = getToken()
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/translations/${id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to reject')
      showSuccess(t('admin.translations.rejectSuccess'))
      fetchTranslations()
    } catch {
      setError('Failed to reject translation')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin.translations.deleteConfirm'))) return
    setActionLoading(id + '-delete')
    const token = getToken()
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/translations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to delete')
      showSuccess(t('admin.translations.deleteSuccess'))
      fetchTranslations()
    } catch {
      setError('Failed to delete translation')
    } finally {
      setActionLoading(null)
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    const token = getToken()
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/translations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to submit')
      }
      setShowForm(false)
      setFormData(EMPTY_FORM)
      showSuccess(t('admin.translations.saveSuccess'))
      fetchTranslations()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setFormLoading(false)
    }
  }

  const handleOpenNewTranslationForm = useCallback(() => {
    setFormData(EMPTY_FORM)
    setFormError('')
    setShowForm(true)
  }, [])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={t('admin.translations.title')}
          subtitle={t('admin.translations.subtitle')}
          actions={
            <button
            onClick={() => handleOpenNewTranslationForm()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              + {t('admin.translations.addTranslation')}
            </button>
          }
        />

        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}
        {successMessage && (
          <Alert variant="success" className="mb-4">
            {successMessage}
          </Alert>
        )}

        {/* Filters */}
        <div className="bg-white/5 backdrop-blur-sm border-2 border-white/10 rounded-lg p-4 mb-6 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              {t('admin.translations.filterByLanguage')}
            </label>
            <select
              value={langFilter}
              onChange={(e) => { setLangFilter(e.target.value); setPage(0) }}
              className="bg-white/5 border border-white/20 rounded-md text-white text-sm px-3 py-1.5 focus:outline-none"
            >
              <option value="" className="bg-gray-800 text-white">{t('admin.translations.allLanguages')}</option>
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-gray-800 text-white">
                  {l.flag} {l.nativeName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              {t('admin.translations.filterByStatus')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
              className="bg-white/5 border border-white/20 rounded-md text-white text-sm px-3 py-1.5 focus:outline-none"
            >
              <option value="" className="bg-gray-800 text-white">{t('admin.translations.allStatuses')}</option>
              <option value="pending" className="bg-gray-800 text-white">{t('admin.translations.statusPending')}</option>
              <option value="approved" className="bg-gray-800 text-white">{t('admin.translations.statusApproved')}</option>
              <option value="rejected" className="bg-gray-800 text-white">{t('admin.translations.statusRejected')}</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-400 mb-1">
              {t('common.search')}
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              placeholder={t('admin.translations.searchPlaceholder')}
              className="w-full bg-white/5 border border-white/20 rounded-md text-white text-sm px-3 py-1.5 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {(langFilter || statusFilter || search) && (
            <button
              onClick={() => { setLangFilter(''); setStatusFilter(''); setSearch(''); setPage(0) }}
              className="px-3 py-1.5 text-sm text-gray-300 hover:text-white border border-white/20 rounded-md transition-colors"
            >
              {t('common.clearFilters')}
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white/5 backdrop-blur-sm border-2 border-white/10 rounded-lg overflow-hidden">
          {loading ? (
            <LoadingSpinner message={t('common.loading')} />
          ) : translations.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              {t('admin.translations.noTranslations')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-300">
                <thead className="text-xs uppercase bg-white/5 text-gray-400">
                  <tr>
                    <th className="px-4 py-3">{t('admin.translations.keyColumn')}</th>
                    <th className="px-4 py-3">{t('admin.translations.languageColumn')}</th>
                    <th className="px-4 py-3">{t('admin.translations.valueColumn')}</th>
                    <th className="px-4 py-3">{t('admin.translations.statusColumn')}</th>
                    <th className="px-4 py-3">{t('admin.translations.actionsColumn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {translations.map((tr) => {
                    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === tr.language_code)
                    return (
                      <tr
                        key={tr.id}
                        className="border-t border-white/5 hover:bg-blue-50/5 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-blue-300 whitespace-nowrap">
                          {tr.translation_key}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {lang ? `${lang.flag} ${lang.nativeName}` : tr.language_code}
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate" title={tr.translation_value}>
                          {tr.translation_value}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {statusBadge(tr.status, t)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {tr.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApprove(tr.id)}
                                  disabled={actionLoading !== null}
                                  className="text-xs px-2.5 py-1 rounded bg-green-600/30 text-green-300 hover:bg-green-600/50 disabled:opacity-50 transition-colors"
                                >
                                  {t('admin.translations.approve')}
                                </button>
                                <button
                                  onClick={() => handleReject(tr.id)}
                                  disabled={actionLoading !== null}
                                  className="text-xs px-2.5 py-1 rounded bg-yellow-600/30 text-yellow-300 hover:bg-yellow-600/50 disabled:opacity-50 transition-colors"
                                >
                                  {t('admin.translations.reject')}
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDelete(tr.id)}
                              disabled={actionLoading !== null}
                              className="text-xs px-2.5 py-1 rounded bg-red-600/30 text-red-300 hover:bg-red-600/50 disabled:opacity-50 transition-colors"
                            >
                              {t('common.delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4 text-sm text-gray-400">
            <span>
              {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded border border-white/20 hover:border-white/40 disabled:opacity-40 transition-colors"
              >
                ← Prev
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded border border-white/20 hover:border-white/40 disabled:opacity-40 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Translation Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/20 rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                {t('admin.translations.newTranslation')}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label={t('common.close')}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="px-6 py-5 space-y-4">
              {formError && (
                <Alert variant="error">{formError}</Alert>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {t('admin.translations.keyLabel')} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.translation_key}
                  onChange={(e) => setFormData((d) => ({ ...d, translation_key: e.target.value }))}
                  placeholder={t('admin.translations.keyPlaceholder')}
                  className="w-full bg-white/5 border border-white/20 rounded-md text-white text-sm px-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {t('admin.translations.languageLabel')} <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={formData.language_code}
                  onChange={(e) => setFormData((d) => ({ ...d, language_code: e.target.value }))}
                  className="w-full bg-gray-800 border border-white/20 rounded-md text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="bg-gray-800 text-white">
                      {l.flag} {l.nativeName} ({l.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {t('admin.translations.valueLabel')} <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.translation_value}
                  onChange={(e) => setFormData((d) => ({ ...d, translation_value: e.target.value }))}
                  placeholder={t('admin.translations.valuePlaceholder')}
                  className="w-full bg-white/5 border border-white/20 rounded-md text-white text-sm px-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {t('admin.translations.notesLabel')}
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData((d) => ({ ...d, notes: e.target.value }))}
                  placeholder={t('admin.translations.notesPlaceholder')}
                  className="w-full bg-white/5 border border-white/20 rounded-md text-white text-sm px-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-300 hover:text-white border border-white/20 rounded-lg transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {formLoading ? t('common.loading') : t('admin.translations.submitForReview')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
