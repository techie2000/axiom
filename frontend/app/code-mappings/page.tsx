'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Alert from '../components/Alert'
import Badge from '../components/Badge'
import LoadingSpinner from '../components/LoadingSpinner'
import PageHeader from '../components/PageHeader'
import ReferencePageHeaderActions from '../components/ReferencePageHeaderActions'
import SearchInputWithOverflowTooltip from '../components/SearchInputWithOverflowTooltip'
import StatCard from '../components/StatCard'
import { getApiBaseUrl } from '../lib/api-base'
import { useButtonEmojiMode } from '../lib/useButtonEmojiMode'
import { buildCodeMappingsHeaders } from './request'
import { useEnglishTooltips } from '../lib/useEnglishTooltips'
import { useSearchFocusShortcut } from '../lib/useSearchFocusShortcut'
import {
  countActiveCodeMappingFilters,
  DEFAULT_CODE_MAPPING_FILTERS,
  filterCodeMappings,
  getCodeMappingFilterOptions,
  type CodeMapping,
  type CodeMappingColumnFilters,
} from './filtering'

export default function CodeMappingsPage() {
  const { t } = useTranslation('common')
  const { getEnglishTooltip } = useEnglishTooltips()
  const { formatLabel } = useButtonEmojiMode()
  const searchInputRef = useRef<HTMLInputElement>(null)
  useSearchFocusShortcut(searchInputRef)
  const [mappings, setMappings] = useState<CodeMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<'noneConfigured' | 'authRequired' | 'apiError' | 'networkError' | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedWidth, setExpandedWidth] = useState(false)
  const [showInlineDocs, setShowInlineDocs] = useState(false)
  const [filters, setFilters] = useState<CodeMappingColumnFilters>(DEFAULT_CODE_MAPPING_FILTERS)

  const API_BASE_URL = getApiBaseUrl()

  const fetchMappings = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/code-mappings?limit=100`, {
        headers: buildCodeMappingsHeaders(),
      })

      if (response.ok) {
        const data = await response.json()
        setMappings(data || [])
        if (!data || data.length === 0) {
          setError(t('codeMappings.errors.noneConfigured'))
          setErrorKind('noneConfigured')
        } else {
          setError(null)
          setErrorKind(null)
        }
      } else if (response.status === 401) {
        setError(t('codeMappings.errors.authRequired'))
        setErrorKind('authRequired')
      } else {
        setError(t('codeMappings.errors.apiReturned', { status: response.status, statusText: response.statusText }))
        setErrorKind('apiError')
      }
    } catch (err) {
      console.error('Code mappings fetch error:', err)
      setError(t('codeMappings.errors.unableToConnect', { apiBaseUrl: API_BASE_URL }))
      setErrorKind('networkError')
    } finally {
      setLoading(false)
    }
  }, [API_BASE_URL, t])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchMappings()
    }
  }, [fetchMappings])

  const filteredMappings = useMemo(
    () => filterCodeMappings(mappings, searchTerm, filters),
    [mappings, searchTerm, filters]
  )
  const activeFilterCount = useMemo(
    () => countActiveCodeMappingFilters(filters),
    [filters]
  )

  const activeMappings = mappings.filter(m => m.active)
  const uniqueSystems = [...new Set(mappings.map(m => m.from_system))]
  const { fromSystems, toSystems } = useMemo(
    () => getCodeMappingFilterOptions(mappings),
    [mappings]
  )

  const setFilter = useCallback((key: keyof CodeMappingColumnFilters, value: string) => {
    setFilters((previous) => ({ ...previous, [key]: value as CodeMappingColumnFilters[typeof key] }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_CODE_MAPPING_FILTERS)
  }, [])

  if (loading) {
    return <LoadingSpinner message={t('codeMappings.loading')} />
  }

  return (
    <div className="min-h-screen p-8">
      <div className={`${expandedWidth ? 'max-w-full' : 'max-w-7xl'} mx-auto transition-all duration-300`}>
        {/* Header */}
        <PageHeader
          title={t('codeMappings.title')}
          subtitle={t('codeMappings.subtitle')}
          titleTooltip={getEnglishTooltip('codeMappings.title')}
          subtitleTooltip={getEnglishTooltip('codeMappings.subtitle')}
          backHref="/dashboard"
          actions={
            <ReferencePageHeaderActions
              effectiveExpandedWidth={expandedWidth}
              normalTitle={getEnglishTooltip('codeMappings.widthNormalBtn')}
              expandTitle={getEnglishTooltip('codeMappings.widthExpandBtn')}
              normalLabel={t('codeMappings.widthNormalBtn')}
              expandLabel={t('codeMappings.widthExpandBtn')}
              saveWidthLabel=""
              hasUnsavedWidthChanges={false}
              onToggleExpandedWidth={() => setExpandedWidth((previous) => !previous)}
              onSaveExpandedWidth={() => undefined}
              formatLabel={formatLabel}
            >
              <button
                type="button"
                onClick={() => setShowInlineDocs((previous) => !previous)}
                className="theme-header-action rounded-lg theme-btn-neutral theme-focus"
                aria-label={t('codeMappings.docsToggleAria')}
                title={getEnglishTooltip('codeMappings.docsToggle')}
              >
                {formatLabel(t('codeMappings.docsToggle'))}
              </button>
            </ReferencePageHeaderActions>
          }
        />

        {/* Info box explaining the feature */}
        <Alert variant="info" title={t('codeMappings.about.title')} className="mb-6">
          {t('codeMappings.about.bodyPrefix')}{' '}
          <em>{t('codeMappings.fields.fromSystem')}</em>, <em>{t('codeMappings.fields.toSystem')}</em>,{' '}
          <em>{t('codeMappings.fields.fromType')}</em>, <em>{t('codeMappings.fields.toType')}</em>,{' '}
          {t('codeMappings.about.bodySuffix')}
        </Alert>

        {showInlineDocs && (
          <Alert variant="info" title={t('codeMappings.docs.title')} className="mb-6">
            <p className="mb-2">{t('codeMappings.docs.summary')}</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>{t('codeMappings.docs.fields.fromSystem')}</li>
              <li>{t('codeMappings.docs.fields.toSystem')}</li>
              <li>{t('codeMappings.docs.fields.fromCode')}</li>
              <li>{t('codeMappings.docs.fields.toCode')}</li>
              <li>{t('codeMappings.docs.fields.fromType')}</li>
              <li>{t('codeMappings.docs.fields.toType')}</li>
              <li>{t('codeMappings.docs.fields.status')}</li>
            </ul>
            <p className="mt-2">{t('codeMappings.docs.uniqueness')}</p>
          </Alert>
        )}

        {/* Error/Notice Alert */}
        {error && (
          <Alert
            variant={errorKind === 'noneConfigured' ? 'warning' : 'error'}
            title={errorKind === 'noneConfigured' ? t('codeMappings.noticeTitle') : t('codeMappings.errorTitle')}
            className="mb-6"
          >
            {error}
          </Alert>
        )}

        {/* Search */}
        <div className="mb-6">
          <SearchInputWithOverflowTooltip
            ref={searchInputRef}
            type="text"
            placeholder={t('codeMappings.searchPlaceholder')}
            title={getEnglishTooltip('codeMappings.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg theme-input"
          />
        </div>

        <div className="mb-6 theme-panel border-2 backdrop-blur-sm rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 theme-text-muted">{t('codeMappings.columns.fromSystem')}</label>
              <select
                className="w-full px-3 py-2 rounded-lg border theme-input"
                value={filters.fromSystem}
                onChange={(event) => setFilter('fromSystem', event.target.value)}
                aria-label={t('codeMappings.filters.fromSystemAria')}
              >
                <option value="">{t('codeMappings.filters.allFromSystems')}</option>
                {fromSystems.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 theme-text-muted">{t('codeMappings.columns.fromType')}</label>
              <SearchInputWithOverflowTooltip
                type="text"
                value={filters.fromType}
                onChange={(event) => setFilter('fromType', event.target.value)}
                placeholder={t('codeMappings.filters.fromTypePlaceholder')}
                className="w-full px-4 py-2 border rounded-lg theme-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 theme-text-muted">{t('codeMappings.columns.fromCode')}</label>
              <SearchInputWithOverflowTooltip
                type="text"
                value={filters.fromCode}
                onChange={(event) => setFilter('fromCode', event.target.value)}
                placeholder={t('codeMappings.filters.fromCodePlaceholder')}
                className="w-full px-4 py-2 border rounded-lg theme-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 theme-text-muted">{t('codeMappings.columns.toSystem')}</label>
              <select
                className="w-full px-3 py-2 rounded-lg border theme-input"
                value={filters.toSystem}
                onChange={(event) => setFilter('toSystem', event.target.value)}
                aria-label={t('codeMappings.filters.toSystemAria')}
              >
                <option value="">{t('codeMappings.filters.allToSystems')}</option>
                {toSystems.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 theme-text-muted">{t('codeMappings.columns.toType')}</label>
              <SearchInputWithOverflowTooltip
                type="text"
                value={filters.toType}
                onChange={(event) => setFilter('toType', event.target.value)}
                placeholder={t('codeMappings.filters.toTypePlaceholder')}
                className="w-full px-4 py-2 border rounded-lg theme-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 theme-text-muted">{t('codeMappings.columns.toCode')}</label>
              <SearchInputWithOverflowTooltip
                type="text"
                value={filters.toCode}
                onChange={(event) => setFilter('toCode', event.target.value)}
                placeholder={t('codeMappings.filters.toCodePlaceholder')}
                className="w-full px-4 py-2 border rounded-lg theme-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 theme-text-muted">{t('codeMappings.columns.status')}</label>
              <select
                className="w-full px-3 py-2 rounded-lg border theme-input"
                value={filters.status}
                onChange={(event) => setFilter('status', event.target.value as CodeMappingColumnFilters['status'])}
                aria-label={t('codeMappings.filters.statusAria')}
              >
                <option value="">{t('codeMappings.filters.allStatuses')}</option>
                <option value="active">{t('codeMappings.status.active')}</option>
                <option value="inactive">{t('codeMappings.status.inactive')}</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={resetFilters}
                className="theme-header-action rounded-lg theme-btn-neutral theme-focus w-full md:w-auto"
              >
                {formatLabel(t('codeMappings.filters.clearAll'))}
              </button>
            </div>
          </div>
        </div>

        {activeFilterCount > 0 && (
          <div className="mb-4 rounded-lg px-4 py-2 text-sm theme-subtle border border-[rgb(var(--border-rgb))]">
            {t('codeMappings.filters.activeFilters', { count: activeFilterCount })}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard title={t('codeMappings.stats.totalMappings')} titleTooltip={getEnglishTooltip('codeMappings.stats.totalMappings')} value={mappings.length} />
          <StatCard title={t('codeMappings.stats.activeMappings')} titleTooltip={getEnglishTooltip('codeMappings.stats.activeMappings')} value={activeMappings.length} accent="green" />
          <StatCard title={t('codeMappings.stats.sourceSystems')} titleTooltip={getEnglishTooltip('codeMappings.stats.sourceSystems')} value={uniqueSystems.length} />
          <StatCard title={t('codeMappings.stats.filteredResults')} titleTooltip={getEnglishTooltip('codeMappings.stats.filteredResults')} value={filteredMappings.length} />
        </div>

        {/* Mappings Table */}
        <div className="theme-table-shell rounded-lg shadow overflow-hidden border-2">
          <div className="overflow-x-auto theme-scrollbar">
            <table className="min-w-full divide-y [--tw-divide-opacity:1] divide-[rgb(var(--border-rgb)/0.7)]">
              <thead className="theme-table-header">
                <tr>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider theme-table-header-cell ${filters.fromSystem ? 'text-[rgb(var(--primary-rgb))]' : ''}`}>
                      <span title={getEnglishTooltip('codeMappings.columns.fromSystem')}>{t('codeMappings.columns.fromSystem')}</span>
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider theme-table-header-cell ${filters.fromType ? 'text-[rgb(var(--primary-rgb))]' : ''}`}>
                      <span title={getEnglishTooltip('codeMappings.columns.fromType')}>{t('codeMappings.columns.fromType')}</span>
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider theme-table-header-cell ${filters.fromCode ? 'text-[rgb(var(--primary-rgb))]' : ''}`}>
                      <span title={getEnglishTooltip('codeMappings.columns.fromCode')}>{t('codeMappings.columns.fromCode')}</span>
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider theme-table-header-cell ${filters.toSystem ? 'text-[rgb(var(--primary-rgb))]' : ''}`}>
                      <span title={getEnglishTooltip('codeMappings.columns.toSystem')}>{t('codeMappings.columns.toSystem')}</span>
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider theme-table-header-cell ${filters.toType ? 'text-[rgb(var(--primary-rgb))]' : ''}`}>
                      <span title={getEnglishTooltip('codeMappings.columns.toType')}>{t('codeMappings.columns.toType')}</span>
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider theme-table-header-cell ${filters.toCode ? 'text-[rgb(var(--primary-rgb))]' : ''}`}>
                      <span title={getEnglishTooltip('codeMappings.columns.toCode')}>{t('codeMappings.columns.toCode')}</span>
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider theme-table-header-cell ${filters.status ? 'text-[rgb(var(--primary-rgb))]' : ''}`}>
                      <span title={getEnglishTooltip('codeMappings.columns.status')}>{t('codeMappings.columns.status')}</span>
                    </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider theme-table-header-cell">
                    <span title={getEnglishTooltip('codeMappings.columns.description')}>{t('codeMappings.columns.description')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="theme-table-shell divide-y [--tw-divide-opacity:1] divide-[rgb(var(--border-rgb)/0.7)]">
                {filteredMappings.length > 0 ? (
                  filteredMappings.map((mapping) => (
                    <tr key={mapping.id} className="theme-table-row-hover transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-center">
                        <Badge variant="orange" mono>{mapping.from_system}</Badge>
                      </td>
                      <td className={`px-4 text-sm theme-text-muted font-mono text-xs ${expandedWidth ? 'py-4 whitespace-normal break-words' : 'py-3 whitespace-nowrap'}`}>
                        {mapping.from_code_type}
                      </td>
                      <td className={`px-4 text-sm text-center ${expandedWidth ? 'py-4 whitespace-normal break-words' : 'py-3 whitespace-nowrap'}`}>
                        <Badge variant="red" mono>{mapping.from_code}</Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-center">
                        <Badge variant="blue" mono>{mapping.to_system}</Badge>
                      </td>
                      <td className={`px-4 text-sm theme-text-muted font-mono text-xs ${expandedWidth ? 'py-4 whitespace-normal break-words' : 'py-3 whitespace-nowrap'}`}>
                        {mapping.to_code_type}
                      </td>
                      <td className={`px-4 text-sm text-center ${expandedWidth ? 'py-4 whitespace-normal break-words' : 'py-3 whitespace-nowrap'}`}>
                        <Badge variant="green" mono>{mapping.to_code}</Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        <Badge variant={mapping.active ? 'green' : 'gray'}>
                          <span title={mapping.active ? getEnglishTooltip('codeMappings.status.active') : getEnglishTooltip('codeMappings.status.inactive')}>
                            {mapping.active ? t('codeMappings.status.active') : t('codeMappings.status.inactive')}
                          </span>
                        </Badge>
                      </td>
                      <td className={`px-4 text-sm theme-text-muted max-w-xl ${expandedWidth ? 'py-4 whitespace-normal break-words' : 'py-3 truncate'}`}>
                        {mapping.description || t('codeMappings.emptyDescription')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 text-center text-sm theme-text-muted">
                      {searchTerm ? t('codeMappings.emptyWithSearch') : t('codeMappings.emptyWithoutSearch')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center text-sm theme-text-muted">
          <p title={getEnglishTooltip('codeMappings.footer.prefix')}>
            {t('codeMappings.footer.prefix')} <code className="font-mono theme-subtle px-1 rounded">
              POST /api/v1/code-mappings
            </code> {t('codeMappings.footer.suffix')}
          </p>
        </div>
      </div>
    </div>
  )
}
