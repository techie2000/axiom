'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import i18n, { SUPPORTED_LANGUAGES } from '../../lib/i18n'
import PageHeader from '../../components/PageHeader'
import Alert from '../../components/Alert'
import Badge from '../../components/Badge'
import LoadingSpinner from '../../components/LoadingSpinner'
import SearchInputWithOverflowTooltip from '../../components/SearchInputWithOverflowTooltip'
import { useDeferredBooleanPreference } from '../../lib/useDeferredBooleanPreference'
import PreferenceSavePrompt from '../../components/PreferenceSavePrompt'
import SortableHeaderCell from '../../components/SortableHeaderCell'
import SyncedWideTable from '../../components/SyncedWideTable'
import TablePaginationControls from '../../components/TablePaginationControls'
import { getAuthToken } from '../../lib/auth-token'
import { useEnglishTooltips } from '../../lib/useEnglishTooltips'

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

function resolveLocaleValueWithAliases(
  locale: LocaleNode | null,
  dottedKey: string,
  visited: Set<string> = new Set()
): string | null {
  if (!locale || !dottedKey || visited.has(dottedKey)) return null
  visited.add(dottedKey)

  const value = resolveLocaleValue(locale, dottedKey)
  if (!value) return null

  const nestedTarget = extractNestedTranslationKey(value)
  if (!nestedTarget) {
    return value
  }

  return resolveLocaleValueWithAliases(locale, nestedTarget, visited)
}

function collectAliasTargets(locale: LocaleNode, prefix = ''): Array<{ key: string; target: string }> {
  return Object.entries(locale).flatMap(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key

    if (typeof value === 'string') {
      const target = extractNestedTranslationKey(value)
      return target ? [{ key: nextKey, target }] : []
    }

    return collectAliasTargets(value, nextKey)
  })
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
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

const normalizeLanguageCode = (languageCode: string): string =>
  String(languageCode || '').trim().toLowerCase().split('-')[0]

const NESTED_TRANSLATION_PATTERN = /^\$t\(([^)]+)\)$/
const SHARED_KEY_PREFIXES = ['referenceLayout.']
const STATUS_PRIORITY: Record<UITranslation['status'], number> = {
  approved: 3,
  pending: 2,
  rejected: 1,
}

const extractNestedTranslationKey = (value: string | null): string | null => {
  if (!value) return null
  const match = value.trim().match(NESTED_TRANSLATION_PATTERN)
  return match?.[1]?.trim() || null
}

const isDirectSharedKey = (translationKey: string): boolean =>
  SHARED_KEY_PREFIXES.some((prefix) => translationKey.startsWith(prefix))

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
  const { getEnglishTooltip } = useEnglishTooltips()
  const filterBarRef = useRef<HTMLDivElement>(null)
  const defaultFormLanguage = useMemo(
    () => getPreferredTargetLanguage(i18n.resolvedLanguage || i18n.language || ''),
    [i18n.language, i18n.resolvedLanguage]
  )

  const expandedWidthPreference = useDeferredBooleanPreference({
    pageKey: 'admin-translations',
    preferenceKey: 'expanded_width',
    defaultValue: false,
  })
  const [hasHydrated, setHasHydrated] = useState(false)
  const effectiveExpandedWidth = hasHydrated ? expandedWidthPreference.value : false

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
  const [pageSize, setPageSize] = useState(50)
  const [sortField, setSortField] = useState<TranslationSortField | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [filterBarHeight, setFilterBarHeight] = useState(0)

  // Form / modal state
  const [showForm, setShowForm] = useState(false)
  const [showHelpPanel, setShowHelpPanel] = useState(false)
  const [formData, setFormData] = useState<TranslationFormData>(() => createEmptyForm(defaultFormLanguage))
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [englishLocale, setEnglishLocale] = useState<LocaleNode | null>(null)
  const [translationKeyOptions, setTranslationKeyOptions] = useState<string[]>([])

  useEffect(() => {
    setHasHydrated(true)
  }, [])

  const getToken = () => getAuthToken()

  const fetchTranslations = useCallback(async (showLoadingState = true) => {
    if (showLoadingState) {
      setLoading(true)
    }
    setError('')
    const token = getToken()
    if (!token) {
      router.push('/login')
      return
    }
    try {
      const hasSearchTerm = Boolean(search.trim())
      const normalizedSearch = search.trim()
      const params = new URLSearchParams({
        limit: String(hasSearchTerm ? SEARCH_FETCH_LIMIT : pageSize),
        offset: String(hasSearchTerm ? 0 : page * pageSize),
      })
      if (langFilter) params.set('language', langFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (normalizedSearch) params.set('search', normalizedSearch)

        const res = await fetch(`${API_BASE_URL}/api/v1/admin/translations?${params}`, {
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
      if (showLoadingState) {
        setLoading(false)
      }
    }
  }, [router, langFilter, statusFilter, search, page, pageSize, t])

  useEffect(() => {
    fetchTranslations()
  }, [fetchTranslations])

  useEffect(() => {
    const handleTranslationsUpdated = () => {
      void fetchTranslations(false)
    }

    window.addEventListener('axiom:translations-updated', handleTranslationsUpdated as EventListener)
    return () => {
      window.removeEventListener('axiom:translations-updated', handleTranslationsUpdated as EventListener)
    }
  }, [fetchTranslations])

  useEffect(() => {
    let cancelled = false

    async function loadEnglishLocale() {
      try {
        const res = await fetch('/locales/en/common.json', { cache: 'no-store' })
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

    const handleFocus = () => {
      void loadEnglishLocale()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadEnglishLocale()
      }
    }

    loadEnglishLocale()
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Close only the top-most local overlay on Escape.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return

      // Help panel should close first and consume Escape so global menus remain open.
      if (showHelpPanel) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        setShowHelpPanel(false)
        return
      }

      if (showForm) {
        setShowForm(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showHelpPanel, showForm])

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

  const preferredTranslationByLanguageAndKey = useMemo(() => {
    const map = new Map<string, UITranslation>()

    const getTimestamp = (row: UITranslation): number => {
      const parsed = Date.parse(row.updated_at || row.created_at || '')
      return Number.isFinite(parsed) ? parsed : 0
    }

    for (const row of translations) {
      const normalizedLanguage = normalizeLanguageCode(row.language_code)
      if (!normalizedLanguage) continue

      const lookupKey = `${normalizedLanguage}::${row.translation_key}`
      const existing = map.get(lookupKey)
      if (!existing) {
        map.set(lookupKey, row)
        continue
      }

      const rowPriority = STATUS_PRIORITY[row.status] ?? 0
      const existingPriority = STATUS_PRIORITY[existing.status] ?? 0
      const shouldReplace =
        rowPriority > existingPriority ||
        (rowPriority === existingPriority && getTimestamp(row) > getTimestamp(existing))

      if (shouldReplace) {
        map.set(lookupKey, row)
      }
    }

    return map
  }, [translations])

  const resolveTranslationDisplayValue = useCallback((languageCode: string, key: string): string | null => {
    const normalizedLanguage = normalizeLanguageCode(languageCode)
    if (!normalizedLanguage || !key) return null

    const visited = new Set<string>()
    const resolveFromRecords = (targetKey: string): string | null => {
      if (!targetKey || visited.has(targetKey)) return null
      visited.add(targetKey)

      const record = preferredTranslationByLanguageAndKey.get(`${normalizedLanguage}::${targetKey}`)
      if (record) {
        const nestedTarget = extractNestedTranslationKey(record.translation_value)
        return nestedTarget ? resolveFromRecords(nestedTarget) : record.translation_value
      }

      const resource = i18n.getResourceBundle(normalizedLanguage, 'common') as LocaleNode | undefined
      return resolveLocaleValueWithAliases(resource ?? null, targetKey)
    }

    return resolveFromRecords(key)
  }, [i18n, preferredTranslationByLanguageAndKey])

  const notifyTranslationsUpdated = (key?: string, languageCode?: string) => {
    if (typeof window === 'undefined') return
    const detail = key ? { key, language_code: languageCode } : undefined
    window.dispatchEvent(new CustomEvent('axiom:translations-updated', detail ? { detail } : undefined))
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
      fetchTranslations(false)
    } catch {
      setError(t('admin.translations.errors.approveFailed'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (id: string, key?: string, languageCode?: string) => {
    setActionLoading(id + '-reject')
    const token = getToken()
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/translations/${id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(t('admin.translations.errors.rejectFailed'))
      showSuccess(t('admin.translations.rejectSuccess'))
      notifyTranslationsUpdated(key, languageCode)
      fetchTranslations(false)
    } catch {
      setError(t('admin.translations.errors.rejectFailed'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: string, key?: string, languageCode?: string) => {
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
      notifyTranslationsUpdated(key, languageCode)
      fetchTranslations(false)
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
    const englishDefaultForKey = resolveLocaleValue(englishLocale, formData.translation_key)
    const nestedTargetKey = extractNestedTranslationKey(englishDefaultForKey)

    try {
      const submitTranslationRecord = async (payload: TranslationFormData) => {
        const res = await fetch(`${API_BASE_URL}/api/v1/translations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const d = await res.json()
          throw new Error(d.error || t('admin.translations.errors.submitFailed'))
        }
      }

      const submittedLanguage = formData.language_code.trim().toLowerCase().split('-')[0]
      const activeLanguage = (i18n.resolvedLanguage || i18n.language || '').trim().toLowerCase().split('-')[0]

      if (nestedTargetKey) {
        const updateMasterRecord = window.confirm(
          `This key inherits from "${nestedTargetKey}". Update the master record as well?\n\n` +
          'OK: submit master translation and keep this key as a pointer.\n' +
          'Cancel: submit this key as an ALIAS override (page-specific value).'
        )

        if (updateMasterRecord) {
          await submitTranslationRecord({
            translation_key: nestedTargetKey,
            language_code: formData.language_code,
            translation_value: formData.translation_value,
            notes: formData.notes,
          })

          await submitTranslationRecord({
            translation_key: formData.translation_key,
            language_code: formData.language_code,
            translation_value: `$t(${nestedTargetKey})`,
            notes: formData.notes,
          })

          if (submittedLanguage && submittedLanguage === activeLanguage && formData.translation_key.trim()) {
            i18n.addResource(submittedLanguage, 'common', nestedTargetKey, formData.translation_value)
            i18n.addResource(submittedLanguage, 'common', formData.translation_key.trim(), `$t(${nestedTargetKey})`)
          }
        } else {
          await submitTranslationRecord({
            ...formData,
            translation_value: formData.translation_value,
          })

          if (submittedLanguage && submittedLanguage === activeLanguage && formData.translation_key.trim()) {
            i18n.addResource(submittedLanguage, 'common', formData.translation_key.trim(), formData.translation_value)
          }
        }
      } else {
        await submitTranslationRecord({
          ...formData,
          translation_value: formData.translation_value,
        })

        if (submittedLanguage && submittedLanguage === activeLanguage && formData.translation_key.trim()) {
          i18n.addResource(submittedLanguage, 'common', formData.translation_key.trim(), formData.translation_value)
        }
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

  const aliasReferencesByTarget = useMemo(() => {
    const references = new Map<string, string[]>()
    if (!englishLocale) {
      return references
    }

    for (const relation of collectAliasTargets(englishLocale)) {
      const existing = references.get(relation.target)
      if (existing) {
        existing.push(relation.key)
      } else {
        references.set(relation.target, [relation.key])
      }
    }

    return references
  }, [englishLocale])

  const selectedEnglishDefault = resolveLocaleValue(englishLocale, formData.translation_key)
  const selectedAliasTarget = extractNestedTranslationKey(selectedEnglishDefault)
  const displayedTranslations = normalizedSearch
    ? sortedTranslations.slice(page * pageSize, (page + 1) * pageSize)
    : sortedTranslations
  const visibleTotal = normalizedSearch ? filteredTranslations.length : total

  const totalPages = Math.ceil(visibleTotal / pageSize)
  const currentPage = page + 1
  const isLastPage = totalPages === 0 || page >= totalPages - 1
  const hasActiveFilters = Boolean(langFilter || statusFilter || search.trim())

  useEffect(() => {
    if (!hasActiveFilters) {
      setFilterBarHeight(0)
      return
    }

    const updateHeight = () => {
      setFilterBarHeight(filterBarRef.current?.offsetHeight || 0)
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [hasActiveFilters, langFilter, statusFilter, search])

  return (
    <div className="min-h-screen p-8">
      <div className={`${effectiveExpandedWidth ? 'max-w-full' : 'max-w-7xl'} mx-auto transition-all duration-300`}>
        <PageHeader
          title={t('admin.translations.title')}
          subtitle={t('admin.translations.subtitle')}
          titleTooltip={getEnglishTooltip('admin.translations.title')}
          subtitleTooltip={getEnglishTooltip('admin.translations.subtitle')}
          actions={
            <>
              <button
                onClick={expandedWidthPreference.toggle}
                className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 transition-colors text-white text-sm font-medium"
                title={
                  effectiveExpandedWidth
                      ? getEnglishTooltip('referenceLayout.normalButton')
                      : getEnglishTooltip('referenceLayout.expandButton')
                }
              >
                {effectiveExpandedWidth
                    ? t('referenceLayout.normalButton')
                    : t('referenceLayout.expandButton')}
              </button>
              <button
                onClick={() => handleOpenNewTranslationForm()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                title={getEnglishTooltip('admin.translations.addTranslation')}
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
              title={langFilter || getEnglishTooltip('admin.translations.allLanguages')}
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
              title={statusFilter || getEnglishTooltip('admin.translations.allStatuses')}
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
            <SearchInputWithOverflowTooltip
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              placeholder={t('admin.translations.searchPlaceholder')}
              title={getEnglishTooltip('admin.translations.searchPlaceholder')}
              className="w-full bg-white dark:bg-white/5 border border-gray-300 dark:border-white/20 rounded-md text-gray-900 dark:text-white text-sm px-3 py-1.5 placeholder-gray-500 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {(langFilter || statusFilter || search) && (
            <button
              onClick={() => { setLangFilter(''); setStatusFilter(''); setSearch(''); setPage(0) }}
              className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-white/20 rounded-md transition-colors"
              title={getEnglishTooltip('common.clearFilters')}
            >
              {t('common.clearFilters')}
            </button>
          )}

          <button
            onClick={() => setShowHelpPanel(true)}
            className="ml-auto px-3 py-1.5 text-sm rounded-md border border-cyan-300 text-cyan-800 bg-cyan-50 hover:bg-cyan-100 dark:border-cyan-700/50 dark:text-cyan-200 dark:bg-cyan-900/20 dark:hover:bg-cyan-900/35 transition-colors"
            title={getEnglishTooltip('admin.translations.help.openButton')}
          >
            ? {t('admin.translations.help.openButton')}
          </button>
        </div>

        {/* Top pagination */}
        {visibleTotal > 0 && (
          <TablePaginationControls
            className="mb-4"
            currentPage={currentPage}
            isFirstPage={page === 0}
            isLastPage={isLastPage}
            onPrevious={() => setPage((p) => Math.max(0, p - 1))}
            onNext={() => setPage((p) => p + 1)}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageSizeChange={(nextSize) => {
              setPageSize(nextSize)
              setPage(0)
            }}
            pageLabel={t('leiRecords.pagination.page', { page: currentPage })}
            itemsPerPageLabel={t('leiRecords.pagination.itemsPerPage')}
            previousLabel={t('leiRecords.pagination.previous')}
            nextLabel={t('leiRecords.pagination.next')}
          />
        )}

        {hasActiveFilters && (
          <div
            ref={filterBarRef}
            className="sticky top-0 z-40 bg-blue-50 dark:bg-blue-900 border-b-2 border-blue-200 dark:border-blue-700 px-4 py-2 shadow-md rounded-t-lg"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="font-medium text-blue-900 dark:text-blue-100">{t('leiRecords.filters.activeFilters')}</span>
                {langFilter && (
                  <button
                    onClick={() => setLangFilter('')}
                    className="px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded text-xs font-medium hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors"
                  >
                    {t('admin.translations.filterByLanguage')}: {langFilter.toUpperCase()} <span className="ml-1">✕</span>
                  </button>
                )}
                {statusFilter && (
                  <button
                    onClick={() => setStatusFilter('')}
                    className="px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded text-xs font-medium hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors"
                  >
                    {t('admin.translations.filterByStatus')}: {statusFilter.toUpperCase()} <span className="ml-1">✕</span>
                  </button>
                )}
                {search.trim() && (
                  <button
                    onClick={() => setSearch('')}
                    className="px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded text-xs font-medium hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors"
                  >
                    {t('filters.searchChip', { value: search.trim() })} <span className="ml-1">✕</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => { setLangFilter(''); setStatusFilter(''); setSearch(''); setPage(0) }}
                className="px-3 py-1 text-xs rounded-lg bg-white hover:bg-gray-100 dark:bg-blue-600 dark:hover:bg-blue-700 text-blue-900 dark:text-white border border-blue-300 dark:border-transparent transition-colors font-medium shadow-sm"
              >
                {t('filters.clearAll')}
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="bg-white dark:bg-white/5 backdrop-blur-sm border-2 border-gray-200 dark:border-white/10 rounded-lg">
            <LoadingSpinner message={t('common.loading')} />
          </div>
        ) : displayedTranslations.length === 0 ? (
          <div className="bg-white dark:bg-white/5 backdrop-blur-sm border-2 border-gray-200 dark:border-white/10 rounded-lg">
            <div className="text-center py-16 text-gray-600 dark:text-gray-400">
              {t('admin.translations.noTranslations')}
            </div>
          </div>
        ) : (
          <div className="relative">
            <SyncedWideTable
              stickyTopOffset={hasActiveFilters ? filterBarHeight : 0}
              dependencyKey={`${displayedTranslations.length}-${sortField ?? 'default'}-${sortDirection}-${actionLoading ?? 'idle'}`}
              tableClassName="min-w-full"
              tableStyle={{ tableLayout: 'auto', borderCollapse: 'collapse' }}
              mainHeaderClassName="bg-gray-100 dark:bg-gray-800"
              stickyHeaderClassName="bg-gray-100 dark:bg-gray-800"
              bodyClassName="divide-y divide-gray-200 dark:divide-white/10"
              topScrollbarClassName="mb-1 overflow-x-auto bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 rounded-t-lg"
              stickyContainerClassName="fixed z-30 overflow-x-auto bg-white border-b-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm shadow-lg transition-all duration-300 ease-in-out"
              containerClassName="overflow-x-auto bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm shadow-lg"
              containerStyle={{
                borderTopLeftRadius: hasActiveFilters ? 0 : '0.5rem',
                borderTopRightRadius: hasActiveFilters ? 0 : '0.5rem',
                borderBottomLeftRadius: '0.5rem',
                borderBottomRightRadius: '0.5rem',
                borderTop: hasActiveFilters ? 'none' : undefined,
              }}
              headerRow={
                <tr>
                  <SortableHeaderCell
                    className="sticky top-0 z-20 bg-gray-100 dark:bg-gray-800 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300"
                    label={<span title={getEnglishTooltip('admin.translations.keyColumn')}>{t('admin.translations.keyColumn')}</span>}
                    onSort={() => handleSort('translation_key')}
                    isActiveSort={sortField === 'translation_key'}
                    sortDirection={sortDirection}
                  />
                  <SortableHeaderCell
                    className="sticky top-0 z-20 bg-gray-100 dark:bg-gray-800 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300"
                    label={<span title={getEnglishTooltip('admin.translations.languageColumn')}>{t('admin.translations.languageColumn')}</span>}
                    onSort={() => handleSort('language_code')}
                    isActiveSort={sortField === 'language_code'}
                    sortDirection={sortDirection}
                  />
                  <SortableHeaderCell
                    className="sticky top-0 z-20 bg-gray-100 dark:bg-gray-800 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300"
                    label={<span title={getEnglishTooltip('admin.translations.englishDefaultLabel')}>{t('admin.translations.englishDefaultLabel')}</span>}
                    onSort={() => handleSort('english_default')}
                    isActiveSort={sortField === 'english_default'}
                    sortDirection={sortDirection}
                  />
                  <SortableHeaderCell
                    className="sticky top-0 z-20 bg-gray-100 dark:bg-gray-800 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300"
                    label={<span title={getEnglishTooltip('admin.translations.valueColumn')}>{t('admin.translations.valueColumn')}</span>}
                    onSort={() => handleSort('translation_value')}
                    isActiveSort={sortField === 'translation_value'}
                    sortDirection={sortDirection}
                  />
                  <SortableHeaderCell
                    className="sticky top-0 z-20 bg-gray-100 dark:bg-gray-800 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300"
                    label={<span title={getEnglishTooltip('admin.translations.notesLabel')}>{t('admin.translations.notesLabel')}</span>}
                    onSort={() => handleSort('notes')}
                    isActiveSort={sortField === 'notes'}
                    sortDirection={sortDirection}
                  />
                  <SortableHeaderCell
                    className="sticky top-0 z-20 bg-gray-100 dark:bg-gray-800 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300"
                    label={<span title={getEnglishTooltip('admin.translations.statusColumn')}>{t('admin.translations.statusColumn')}</span>}
                    onSort={() => handleSort('status')}
                    isActiveSort={sortField === 'status'}
                    sortDirection={sortDirection}
                  />
                  <SortableHeaderCell
                    className="sticky top-0 z-20 bg-gray-100 dark:bg-gray-800 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300"
                    label={<span title={getEnglishTooltip('admin.translations.actionsColumn')}>{t('admin.translations.actionsColumn')}</span>}
                    sortable={false}
                  />
                </tr>
              }
              bodyRows={
                <>
                  {displayedTranslations.map((tr) => {
                    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === tr.language_code)
                    const englishDefault = resolveLocaleValue(englishLocale, tr.translation_key)
                    const aliasTarget = extractNestedTranslationKey(englishDefault)
                    const displayEnglishDefault = aliasTarget
                      ? resolveLocaleValueWithAliases(englishLocale, aliasTarget) ?? englishDefault
                      : resolveLocaleValueWithAliases(englishLocale, tr.translation_key) ?? englishDefault
                    const referencedBy = aliasReferencesByTarget.get(tr.translation_key) ?? []
                    const isSharedMaster = !aliasTarget && referencedBy.length > 0
                    const isSharedDirect = !aliasTarget && !isSharedMaster && isDirectSharedKey(tr.translation_key)
                    const pointerValue = aliasTarget ? `$t(${aliasTarget})` : null
                    const isAliasPointerRecord = Boolean(pointerValue && tr.translation_value.trim() === pointerValue)
                    const resolvedAliasTranslation = aliasTarget
                      ? resolveTranslationDisplayValue(tr.language_code, aliasTarget)
                      : null
                    return (
                      <tr
                        key={tr.id}
                        className="border-t border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {tr.translation_key}
                          {aliasTarget && (
                            <span className="ml-2 inline-block rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-1.5 py-0.5 text-[10px] align-middle">
                              ALIAS
                            </span>
                          )}
                          {isSharedMaster && (
                            <span
                              className="ml-2 inline-block rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 text-[10px] align-middle"
                              title={`Used by: ${referencedBy.join(', ')}`}
                            >
                              MASTER
                            </span>
                          )}
                          {isSharedDirect && (
                            <span
                              className="ml-2 inline-block rounded bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300 px-1.5 py-0.5 text-[10px] align-middle"
                              title="Shared key used directly across reference-data pages. Translate once per language unless you intentionally override elsewhere."
                            >
                              SHARED
                            </span>
                          )}
                          {isStaleTranslationKey(tr.translation_key) && (
                            <span className="ml-2 inline-block rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-1.5 py-0.5 text-[10px] align-middle">
                              {t('admin.translations.stale.badge')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {lang ? `${lang.flag} ${lang.nativeName}` : tr.language_code}
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate text-gray-600 dark:text-gray-400" title={displayEnglishDefault ?? ''}>
                          {displayEnglishDefault ?? '-'}
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate" title={tr.translation_value}>
                          {isAliasPointerRecord ? (
                            <span className="text-purple-700 dark:text-purple-300 font-mono text-xs">
                              {'->'} {aliasTarget}
                              {resolvedAliasTranslation ? ` [${resolvedAliasTranslation}]` : ''}
                            </span>
                          ) : (
                            tr.translation_value
                          )}
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
                                  onClick={() => handleReject(tr.id, tr.translation_key, tr.language_code)}
                                  disabled={actionLoading !== null}
                                  className="text-xs px-2.5 py-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-yellow-600/30 dark:text-yellow-300 dark:hover:bg-yellow-600/50 disabled:opacity-50 transition-colors"
                                >
                                  {t('admin.translations.reject')}
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDelete(tr.id, tr.translation_key, tr.language_code)}
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
                </>
              }
            />
          </div>
        )}

        {/* Bottom pagination */}
        {visibleTotal > 0 && (
          <TablePaginationControls
            className="mt-4"
            currentPage={currentPage}
            isFirstPage={page === 0}
            isLastPage={isLastPage}
            onPrevious={() => setPage((p) => Math.max(0, p - 1))}
            onNext={() => setPage((p) => p + 1)}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageSizeChange={(nextSize) => {
              setPageSize(nextSize)
              setPage(0)
            }}
            pageLabel={t('leiRecords.pagination.page', { page: currentPage })}
            itemsPerPageLabel={t('leiRecords.pagination.itemsPerPage')}
            previousLabel={t('leiRecords.pagination.previous')}
            nextLabel={t('leiRecords.pagination.next')}
          />
        )}
      </div>

      <PreferenceSavePrompt
        visible={expandedWidthPreference.showPrompt}
        resetKey={expandedWidthPreference.promptResetKey}
        onSave={expandedWidthPreference.save}
        onDismiss={expandedWidthPreference.dismiss}
        label={t('referenceLayout.savePageWidthDefault')}
      />

      {showHelpPanel && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={t('admin.translations.help.panelTitle')}>
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowHelpPanel(false)}
            aria-label={t('admin.translations.help.closeButton')}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-white/10 shadow-2xl p-6 overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.translations.help.panelTitle')}</h2>
              <button
                type="button"
                onClick={() => setShowHelpPanel(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                aria-label={t('admin.translations.help.closeButton')}
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{t('admin.translations.help.intro')}</p>

            <div className="space-y-4 text-sm">
              <div className="rounded-lg border border-purple-200 dark:border-purple-900/50 bg-purple-50 dark:bg-purple-900/20 p-3">
                <p className="font-semibold text-purple-900 dark:text-purple-200">ALIAS</p>
                <p className="text-purple-800 dark:text-purple-300">{t('admin.translations.help.aliasDescription')}</p>
              </div>

              <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 p-3">
                <p className="font-semibold text-blue-900 dark:text-blue-200">MASTER</p>
                <p className="text-blue-800 dark:text-blue-300">{t('admin.translations.help.masterDescription')}</p>
              </div>

              <div className="rounded-lg border border-cyan-200 dark:border-cyan-900/50 bg-cyan-50 dark:bg-cyan-900/20 p-3">
                <p className="font-semibold text-cyan-900 dark:text-cyan-200">SHARED</p>
                <p className="text-cyan-800 dark:text-cyan-300">{t('admin.translations.help.sharedDescription')}</p>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-3 text-sm text-gray-700 dark:text-gray-300">
              <p className="font-medium mb-1">{t('admin.translations.help.ruleTitle')}</p>
              <p>{t('admin.translations.help.ruleBody')}</p>
            </div>
          </aside>
        </div>
      )}

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
                {selectedAliasTarget && (
                  <p className="mt-1 text-xs text-purple-700 dark:text-purple-300 font-mono">
                    Alias target: {selectedAliasTarget}
                  </p>
                )}
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
