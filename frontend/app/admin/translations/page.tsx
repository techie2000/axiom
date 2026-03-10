'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import '../../lib/i18n'
import PageHeader from '../../components/PageHeader'
import Alert from '../../components/Alert'
import Badge from '../../components/Badge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { SUPPORTED_LANGUAGES } from '../../lib/i18n'
import { useDeferredBooleanPreference } from '../../lib/useDeferredBooleanPreference'
import PreferenceSavePrompt from '../../components/PreferenceSavePrompt'
import SortableHeaderCell from '../../components/SortableHeaderCell'

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

type LocaleNode = {
  [key: string]: string | LocaleNode
}

function flattenLocaleKeys(locale: LocaleNode, prefix = ''): string[] {
  return Object.entries(locale).flatMap(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      return [nextKey]
    }
    return flattenLocaleKeys(value, nextKey)
  })
}

function resolveLocaleValue(locale: LocaleNode | null, dottedKey: string): string | null {
  if (!locale || !dottedKey) return null

  let current: string | LocaleNode | undefined = locale
  for (const segment of dottedKey.split('.')) {
    if (!current || typeof current === 'string') {
      return null
    }
    current = current[segment]
  }

  return typeof current === 'string' ? current : null
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

type TranslationSortField = 'translation_key' | 'language_code' | 'english_default' | 'translation_value' | 'notes' | 'status'

const TARGET_TRANSLATION_LANGUAGES = SUPPORTED_LANGUAGES.filter((language) => language.code !== 'en')
const DEFAULT_TARGET_LANGUAGE = TARGET_TRANSLATION_LANGUAGES[0]?.code ?? 'fr'
const SEARCH_FETCH_LIMIT = 5000

const normalizeLanguageCode = (languageCode: string): string =>
  String(languageCode || '').trim().toLowerCase().split('-')[0]

const getPreferredTargetLanguage = (activeLanguage: string): string => {
  const normalized = normalizeLanguageCode(activeLanguage)
  const preferred = TARGET_TRANSLATION_LANGUAGES.find((language) => language.code === normalized)
  return preferred?.code ?? DEFAULT_TARGET_LANGUAGE
}

const createEmptyForm = (defaultLanguage: string): TranslationFormData => ({
  translation_key: '',
  language_code: defaultLanguage,
  translation_value: '',
  notes: '',
})

export default function AdminTranslationsPage() {
  const router = useRouter()
  const { t, i18n } = useTranslation('common')
  const defaultFormLanguage = useMemo(
    () => getPreferredTargetLanguage(i18n.resolvedLanguage || i18n.language || ''),
    [i18n.language, i18n.resolvedLanguage]
  )

  const expandedWidthPreference = useDeferredBooleanPreference({
    pageKey: 'admin-translations',
    preferenceKey: 'expanded_width',
    defaultValue: false,
  })
  const effectiveExpandedWidth = expandedWidthPreference.value

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
  const [sortField, setSortField] = useState<TranslationSortField | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Form / modal state
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<TranslationFormData>(() => createEmptyForm(defaultFormLanguage))
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [englishLocale, setEnglishLocale] = useState<LocaleNode | null>(null)
  const [translationKeyOptions, setTranslationKeyOptions] = useState<string[]>([])

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
      const hasSearchTerm = Boolean(search.trim())
      const params = new URLSearchParams({
        limit: String(hasSearchTerm ? SEARCH_FETCH_LIMIT : pageSize),
        offset: String(hasSearchTerm ? 0 : page * pageSize),
      })
      if (langFilter) params.set('language', langFilter)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`${API_BASE_URL}/api/v1/translations?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error(t('admin.translations.errors.loadFailed'))
      const data = await res.json()
      const records = data.records ?? []
      setTranslations(records)
      setTotal(hasSearchTerm ? records.length : (data.total ?? 0))
    } catch {
      setError(t('admin.translations.errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [router, langFilter, statusFilter, search, page, t])

  useEffect(() => {
    fetchTranslations()
  }, [fetchTranslations])

  useEffect(() => {
    let cancelled = false

    async function loadEnglishLocale() {
      try {
        const res = await fetch('/locales/en/common.json')
        if (!res.ok) return

        const data = (await res.json()) as LocaleNode
        if (!cancelled) {
          setEnglishLocale(data)

          const keys = flattenLocaleKeys(data).sort((left, right) => left.localeCompare(right))
          setTranslationKeyOptions(keys)
          if (keys.length > 0) {
            setFormData((current) => ({
              ...current,
              translation_key: current.translation_key || keys[0],
            }))
          }
        }
      } catch {
        // No-op: table gracefully falls back when locale source is unavailable.
      }
    }

    loadEnglishLocale()

    return () => {
      cancelled = true
    }
  }, [])

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

  const translationKeySet = useMemo(() => new Set(translationKeyOptions), [translationKeyOptions])
  const isStaleTranslationKey = useCallback(
    (translationKey: string) => translationKeyOptions.length > 0 && !translationKeySet.has(translationKey),
    [translationKeyOptions.length, translationKeySet]
  )

  const staleTranslationRows = useMemo(
    () => translations.filter((row) => isStaleTranslationKey(row.translation_key)),
    [translations, isStaleTranslationKey]
  )

  const notifyTranslationsUpdated = () => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('axiom:translations-updated'))
  }

  const handleApprove = async (id: string) => {
    setActionLoading(id + '-approve')
    const token = getToken()
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/translations/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(t('admin.translations.errors.approveFailed'))
      showSuccess(t('admin.translations.approveSuccess'))
      notifyTranslationsUpdated()
      fetchTranslations()
    } catch {
      setError(t('admin.translations.errors.approveFailed'))
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
      if (!res.ok) throw new Error(t('admin.translations.errors.rejectFailed'))
      showSuccess(t('admin.translations.rejectSuccess'))
      fetchTranslations()
    } catch {
      setError(t('admin.translations.errors.rejectFailed'))
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
      if (!res.ok) throw new Error(t('admin.translations.errors.deleteFailed'))
      showSuccess(t('admin.translations.deleteSuccess'))
      fetchTranslations()
    } catch {
      setError(t('admin.translations.errors.deleteFailed'))
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
        throw new Error(d.error || t('admin.translations.errors.submitFailed'))
      }
      setShowForm(false)
      setFormData(createEmptyForm(defaultFormLanguage))
      showSuccess(t('admin.translations.saveSuccess'))
      fetchTranslations()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('admin.translations.errors.submitFailed'))
    } finally {
      setFormLoading(false)
    }
  }

  const handleOpenNewTranslationForm = useCallback(() => {
    setFormData({
      ...createEmptyForm(defaultFormLanguage),
      translation_key: translationKeyOptions[0] ?? '',
    })
    setFormError('')
    setShowForm(true)
  }, [defaultFormLanguage, translationKeyOptions])

  const handleDeleteStaleTranslations = async () => {
    if (staleTranslationRows.length === 0) {
      showSuccess(t('admin.translations.stale.noneFound'))
      return
    }

    const confirmed = window.confirm(
      t('admin.translations.stale.deleteConfirm', { count: staleTranslationRows.length })
    )
    if (!confirmed) return

    const token = getToken()
    if (!token) {
      router.push('/login')
      return
    }

    setActionLoading('cleanup-stale')
    try {
      const results = await Promise.allSettled(
        staleTranslationRows.map((row) =>
          fetch(`${API_BASE_URL}/api/v1/translations/${row.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      )

      const failed = results.filter((result) => result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.ok)).length
      const deleted = staleTranslationRows.length - failed

      if (deleted > 0) {
        notifyTranslationsUpdated()
      }

      if (failed === 0) {
        showSuccess(t('admin.translations.stale.deletedSuccess', { count: deleted }))
      } else {
        setError(t('admin.translations.stale.deletedPartial', { deleted, failed }))
      }

      fetchTranslations()
    } catch {
      setError(t('admin.translations.stale.cleanupFailed'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleSort = (field: TranslationSortField) => {
    if (sortField !== field) {
      setSortField(field)
      setSortDirection('asc')
      return
    }

    if (sortDirection === 'asc') {
      setSortDirection('desc')
      return
    }

    setSortField(null)
    setSortDirection('asc')
  }

  const normalizedSearch = search.trim().toLowerCase()

  const filteredTranslations = normalizedSearch
    ? translations.filter((row) => {
        const englishDefault = resolveLocaleValue(englishLocale, row.translation_key) ?? ''
        const language = SUPPORTED_LANGUAGES.find((entry) => entry.code === row.language_code)
        const languageText = language
          ? `${language.code} ${language.name} ${language.nativeName}`.toLowerCase()
          : row.language_code.toLowerCase()

        const searchableText = [
          row.translation_key,
          row.translation_value,
          row.notes ?? '',
          englishDefault,
          row.status,
          languageText,
        ]
          .join(' ')
          .toLowerCase()

        return searchableText.includes(normalizedSearch)
      })
    : translations

  const sortedTranslations = [...filteredTranslations].sort((left, right) => {
    if (!sortField) {
      return left.translation_key.localeCompare(right.translation_key, undefined, { sensitivity: 'base' })
    }

    const getSortableValue = (row: UITranslation): string => {
      switch (sortField) {
        case 'translation_key':
          return row.translation_key || ''
        case 'language_code':
          return row.language_code || ''
        case 'english_default':
          return resolveLocaleValue(englishLocale, row.translation_key) || ''
        case 'translation_value':
          return row.translation_value || ''
        case 'notes':
          return row.notes || ''
        case 'status':
        default:
          return row.status || ''
      }
    }

    const comparison = getSortableValue(left).localeCompare(getSortableValue(right), undefined, {
      sensitivity: 'base',
      numeric: true,
    })

    if (comparison !== 0) {
      return sortDirection === 'asc' ? comparison : -comparison
    }

    return left.translation_key.localeCompare(right.translation_key, undefined, { sensitivity: 'base' })
  })

  const selectedEnglishDefault = resolveLocaleValue(englishLocale, formData.translation_key)
  const displayedTranslations = normalizedSearch
    ? sortedTranslations.slice(page * pageSize, (page + 1) * pageSize)
    : sortedTranslations
  const visibleTotal = normalizedSearch ? filteredTranslations.length : total

  const totalPages = Math.ceil(visibleTotal / pageSize)

  return (
    <div className="min-h-screen p-8">
      <div className={`${effectiveExpandedWidth ? 'max-w-full' : 'max-w-7xl'} mx-auto transition-all duration-300`}>
        <PageHeader
          title={t('admin.translations.title')}
          subtitle={t('admin.translations.subtitle')}
          actions={
            <>
              <button
                onClick={expandedWidthPreference.toggle}
                className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 transition-colors text-white text-sm font-medium"
                title={
                  effectiveExpandedWidth
                    ? t('admin.translations.width.normalTitle')
                    : t('admin.translations.width.expandedTitle')
                }
              >
                {effectiveExpandedWidth
                  ? t('admin.translations.width.normalButton')
                  : t('admin.translations.width.expandedButton')}
              </button>
              <button
                onClick={() => handleOpenNewTranslationForm()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                + {t('admin.translations.addTranslation')}
              </button>
              {staleTranslationRows.length > 0 && (
                <button
                  onClick={handleDeleteStaleTranslations}
                  disabled={actionLoading !== null}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  title={t('admin.translations.stale.cleanupTitle')}
                >
                  {t('admin.translations.stale.cleanupButton', { count: staleTranslationRows.length })}
                </button>
              )}
            </>
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
        <div className="bg-white dark:bg-white/5 backdrop-blur-sm border-2 border-gray-200 dark:border-white/10 rounded-lg p-4 mb-6 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              {t('admin.translations.filterByLanguage')}
            </label>
            <select
              value={langFilter}
              onChange={(e) => { setLangFilter(e.target.value); setPage(0) }}
              className="bg-white dark:bg-white/5 border border-gray-300 dark:border-white/20 rounded-md text-gray-900 dark:text-white text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">{t('admin.translations.allLanguages')}</option>
              {TARGET_TRANSLATION_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                  {l.flag} {l.nativeName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              {t('admin.translations.filterByStatus')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
              className="bg-white dark:bg-white/5 border border-gray-300 dark:border-white/20 rounded-md text-gray-900 dark:text-white text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">{t('admin.translations.allStatuses')}</option>
              <option value="pending" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">{t('admin.translations.statusPending')}</option>
              <option value="approved" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">{t('admin.translations.statusApproved')}</option>
              <option value="rejected" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">{t('admin.translations.statusRejected')}</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              {t('common.search')}
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              placeholder={t('admin.translations.searchPlaceholder')}
              className="w-full bg-white dark:bg-white/5 border border-gray-300 dark:border-white/20 rounded-md text-gray-900 dark:text-white text-sm px-3 py-1.5 placeholder-gray-500 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {(langFilter || statusFilter || search) && (
            <button
              onClick={() => { setLangFilter(''); setStatusFilter(''); setSearch(''); setPage(0) }}
              className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-white/20 rounded-md transition-colors"
            >
              {t('common.clearFilters')}
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-white/5 backdrop-blur-sm border-2 border-gray-200 dark:border-white/10 rounded-lg overflow-hidden">
          {loading ? (
            <LoadingSpinner message={t('common.loading')} />
          ) : displayedTranslations.length === 0 ? (
            <div className="text-center py-16 text-gray-600 dark:text-gray-400">
              {t('admin.translations.noTranslations')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
                <thead className="text-xs uppercase bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-400">
                  <tr>
                    <SortableHeaderCell
                      className="px-4 py-3"
                      label={t('admin.translations.keyColumn')}
                      onSort={() => handleSort('translation_key')}
                      isActiveSort={sortField === 'translation_key'}
                      sortDirection={sortDirection}
                    />
                    <SortableHeaderCell
                      className="px-4 py-3"
                      label={t('admin.translations.languageColumn')}
                      onSort={() => handleSort('language_code')}
                      isActiveSort={sortField === 'language_code'}
                      sortDirection={sortDirection}
                    />
                    <SortableHeaderCell
                      className="px-4 py-3"
                      label={t('admin.translations.englishDefaultLabel')}
                      onSort={() => handleSort('english_default')}
                      isActiveSort={sortField === 'english_default'}
                      sortDirection={sortDirection}
                    />
                    <SortableHeaderCell
                      className="px-4 py-3"
                      label={t('admin.translations.valueColumn')}
                      onSort={() => handleSort('translation_value')}
                      isActiveSort={sortField === 'translation_value'}
                      sortDirection={sortDirection}
                    />
                    <SortableHeaderCell
                      className="px-4 py-3"
                      label={t('admin.translations.notesLabel')}
                      onSort={() => handleSort('notes')}
                      isActiveSort={sortField === 'notes'}
                      sortDirection={sortDirection}
                    />
                    <SortableHeaderCell
                      className="px-4 py-3"
                      label={t('admin.translations.statusColumn')}
                      onSort={() => handleSort('status')}
                      isActiveSort={sortField === 'status'}
                      sortDirection={sortDirection}
                    />
                    <SortableHeaderCell
                      className="px-4 py-3"
                      label={t('admin.translations.actionsColumn')}
                      sortable={false}
                    />
                  </tr>
                </thead>
                <tbody>
                  {displayedTranslations.map((tr) => {
                    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === tr.language_code)
                    const englishDefault = resolveLocaleValue(englishLocale, tr.translation_key)
                    return (
                      <tr
                        key={tr.id}
                        className="border-t border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {tr.translation_key}
                          {isStaleTranslationKey(tr.translation_key) && (
                            <span className="ml-2 inline-block rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-1.5 py-0.5 text-[10px] align-middle">
                              {t('admin.translations.stale.badge')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {lang ? `${lang.flag} ${lang.nativeName}` : tr.language_code}
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate text-gray-600 dark:text-gray-400" title={englishDefault ?? ''}>
                          {englishDefault ?? '-'}
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate" title={tr.translation_value}>
                          {tr.translation_value}
                        </td>
                        <td className="px-4 py-3 max-w-xs text-gray-600 dark:text-gray-400 break-words" title={tr.notes ?? ''}>
                          {tr.notes?.trim() ? tr.notes : '-'}
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
                                  className="text-xs px-2.5 py-1 rounded bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-600/30 dark:text-green-300 dark:hover:bg-green-600/50 disabled:opacity-50 transition-colors"
                                >
                                  {t('admin.translations.approve')}
                                </button>
                                <button
                                  onClick={() => handleReject(tr.id)}
                                  disabled={actionLoading !== null}
                                  className="text-xs px-2.5 py-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-yellow-600/30 dark:text-yellow-300 dark:hover:bg-yellow-600/50 disabled:opacity-50 transition-colors"
                                >
                                  {t('admin.translations.reject')}
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDelete(tr.id)}
                              disabled={actionLoading !== null}
                              className="text-xs px-2.5 py-1 rounded bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-600/30 dark:text-red-300 dark:hover:bg-red-600/50 disabled:opacity-50 transition-colors"
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
          <div className="flex justify-between items-center mt-4 text-sm text-gray-600 dark:text-gray-400">
            <span>
              {visibleTotal === 0
                ? '0-0'
                : `${page * pageSize + 1}-${Math.min((page + 1) * pageSize, visibleTotal).toLocaleString()}`}{' '}
              {t('admin.translations.pagination.of', { count: visibleTotal.toLocaleString() })}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded border border-gray-300 dark:border-white/20 hover:border-gray-400 dark:hover:border-white/40 disabled:opacity-40 transition-colors"
              >
                {t('admin.translations.pagination.prev')}
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded border border-gray-300 dark:border-white/20 hover:border-gray-400 dark:hover:border-white/40 disabled:opacity-40 transition-colors"
              >
                {t('admin.translations.pagination.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      <PreferenceSavePrompt
        visible={expandedWidthPreference.showPrompt}
        resetKey={expandedWidthPreference.promptResetKey}
        onSave={expandedWidthPreference.save}
        onDismiss={expandedWidthPreference.dismiss}
        label={t('admin.translations.width.savePrompt')}
      />

      {/* New Translation Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/20 rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('admin.translations.newTranslation')}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin.translations.keyLabel')} <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <select
                  required
                  value={formData.translation_key}
                  onChange={(e) => setFormData((d) => ({ ...d, translation_key: e.target.value }))}
                  className="w-full bg-white dark:bg-white/5 border border-gray-300 dark:border-white/20 rounded-md text-gray-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>{t('admin.translations.keyPlaceholder')}</option>
                  {translationKeyOptions.map((key) => (
                    <option key={key} value={key} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                      {key}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin.translations.languageLabel')} <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <select
                  required
                  value={formData.language_code}
                  onChange={(e) => setFormData((d) => ({ ...d, language_code: e.target.value }))}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-white/20 rounded-md text-gray-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {TARGET_TRANSLATION_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                      {l.flag} {l.nativeName} ({l.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin.translations.englishDefaultLabel')}
                </label>
                <textarea
                  readOnly
                  rows={3}
                  value={selectedEnglishDefault ?? ''}
                  placeholder={t('admin.translations.englishDefaultPlaceholder')}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/20 rounded-md text-gray-900 dark:text-gray-200 text-sm px-3 py-2 placeholder-gray-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin.translations.valueLabel')} <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.translation_value}
                  onChange={(e) => setFormData((d) => ({ ...d, translation_value: e.target.value }))}
                  placeholder={t('admin.translations.valuePlaceholder')}
                  className="w-full bg-white dark:bg-white/5 border border-gray-300 dark:border-white/20 rounded-md text-gray-900 dark:text-white text-sm px-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin.translations.notesLabel')}
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData((d) => ({ ...d, notes: e.target.value }))}
                  placeholder={t('admin.translations.notesPlaceholder')}
                  className="w-full bg-white dark:bg-white/5 border border-gray-300 dark:border-white/20 rounded-md text-gray-900 dark:text-white text-sm px-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-white/20 rounded-lg transition-colors"
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
