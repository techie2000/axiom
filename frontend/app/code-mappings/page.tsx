'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Alert from '../components/Alert'
import Badge from '../components/Badge'
import LoadingSpinner from '../components/LoadingSpinner'
import PageHeader from '../components/PageHeader'
import PreferenceSavePrompt from '../components/PreferenceSavePrompt'
import ReferencePageHeaderActions from '../components/ReferencePageHeaderActions'
import SearchInputWithOverflowTooltip from '../components/SearchInputWithOverflowTooltip'
import StatCard from '../components/StatCard'
import SyncedWideTable from '../components/SyncedWideTable'
import { getApiBaseUrl } from '../lib/api-base'
import { useButtonEmojiMode } from '../lib/useButtonEmojiMode'
import { useDeferredBooleanPreference } from '../lib/useDeferredBooleanPreference'
import { buildDocsUrl } from '../lib/docsLinks'
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
  const filterBarRef = useRef<HTMLDivElement>(null)
  useSearchFocusShortcut(searchInputRef)
  const [mappings, setMappings] = useState<CodeMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<'noneConfigured' | 'authRequired' | 'apiError' | 'networkError' | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<CodeMappingColumnFilters>(DEFAULT_CODE_MAPPING_FILTERS)
  const expandedWidthPreference = useDeferredBooleanPreference({
    pageKey: 'code-mappings',
    preferenceKey: 'expanded_width',
    defaultValue: false,
  })
  const [hasHydrated, setHasHydrated] = useState(false)
  const [filterBarHeight, setFilterBarHeight] = useState(0)
  useEffect(() => {
    setHasHydrated(true)
  }, [])

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

  useEffect(() => {
    if (hasActiveFiltersOrSearch && filterBarRef.current) {
      setFilterBarHeight(filterBarRef.current.offsetHeight)
      return
    }

    setFilterBarHeight(0)
  }, [hasActiveFiltersOrSearch, searchTerm, filters])

  const filteredMappings = useMemo(
    () => filterCodeMappings(mappings, searchTerm, filters),
    [mappings, searchTerm, filters]
  )
  const activeFilterCount = useMemo(
    () => countActiveCodeMappingFilters(filters),
    [filters]
  )

  const activeMappings = mappings.filter(m => m.active)
  const { fromSystems, toSystems } = useMemo(
    () => getCodeMappingFilterOptions(mappings),
    [mappings]
  )
  const selectOptionClassName = 'bg-[rgb(var(--surface-rgb))] text-[rgb(var(--foreground-rgb))]'
  const hasActiveFiltersOrSearch = searchTerm.trim().length > 0 || activeFilterCount > 0
  const effectiveExpandedWidth = hasHydrated ? expandedWidthPreference.value : false

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
    <div className="min-h-screen p-8 pb-14">
      <div className={`${effectiveExpandedWidth ? 'max-w-full' : 'max-w-7xl'} mx-auto transition-all duration-300`}>
        {/* Header */}
        <PageHeader
          title={t('codeMappings.title')}
          subtitle={t('codeMappings.subtitle')}
          titleTooltip={getEnglishTooltip('codeMappings.title')}
          subtitleTooltip={getEnglishTooltip('codeMappings.subtitle')}
          backHref="/dashboard"
          docsHref={buildDocsUrl('workflows/code-mappings/')}
          actions={
            <ReferencePageHeaderActions
              effectiveExpandedWidth={effectiveExpandedWidth}
              normalTitle={getEnglishTooltip('referenceLayout.normalButton')}
              expandTitle={getEnglishTooltip('referenceLayout.expandButton')}
              normalLabel={t('referenceLayout.normalButton')}
              expandLabel={t('referenceLayout.expandButton')}
              saveWidthTitle={getEnglishTooltip('referenceLayout.savePageWidthDefault')}
              saveWidthLabel={`💾 ${t('referenceLayout.savePageWidthDefault')}`}
              hasUnsavedWidthChanges={expandedWidthPreference.hasUnsavedChanges}
              onToggleExpandedWidth={expandedWidthPreference.toggle}
              onSaveExpandedWidth={expandedWidthPreference.saveCurrentValue}
              formatLabel={formatLabel}
            />
          }
        />

        {/* Info box explaining the feature */}
        <Alert variant="info" title={t('codeMappings.about.title')} className="mb-6">
          {t('codeMappings.about.bodyPrefix')}{' '}
          <em>{t('codeMappings.fields.fromSystem')}</em>, <em>{t('codeMappings.fields.toSystem')}</em>,{' '}
          <em>{t('codeMappings.fields.fromType')}</em>, <em>{t('codeMappings.fields.toType')}</em>,{' '}
          {t('codeMappings.about.bodySuffix')}
        </Alert>

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

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard title={t('codeMappings.stats.totalMappings')} titleTooltip={getEnglishTooltip('codeMappings.stats.totalMappings')} value={mappings.length} />
          <StatCard title={t('codeMappings.stats.activeMappings')} titleTooltip={getEnglishTooltip('codeMappings.stats.activeMappings')} value={activeMappings.length} />
          <StatCard title={t('codeMappings.stats.filteredResults')} titleTooltip={getEnglishTooltip('codeMappings.stats.filteredResults')} value={filteredMappings.length} />
        </div>

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

        <div className="relative z-40 mb-6 theme-panel border-2 backdrop-blur-sm rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 theme-text-muted">{t('codeMappings.columns.fromSystem')}</label>
              <select
                className="w-full px-3 py-2 rounded-lg border theme-input"
                value={filters.fromSystem}
                onChange={(event) => setFilter('fromSystem', event.target.value)}
                aria-label={t('codeMappings.filters.fromSystemAria')}
              >
                <option value="" className={selectOptionClassName}>{t('codeMappings.filters.allFromSystems')}</option>
                {fromSystems.map((value) => (
                  <option key={value} value={value} className={selectOptionClassName}>{value}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 theme-text-muted">{t('codeMappings.columns.toSystem')}</label>
              <select
                className="w-full px-3 py-2 rounded-lg border theme-input"
                value={filters.toSystem}
                onChange={(event) => setFilter('toSystem', event.target.value)}
                aria-label={t('codeMappings.filters.toSystemAria')}
              >
                <option value="" className={selectOptionClassName}>{t('codeMappings.filters.allToSystems')}</option>
                {toSystems.map((value) => (
                  <option key={value} value={value} className={selectOptionClassName}>{value}</option>
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
              <label className="block text-sm font-medium mb-2 theme-text-muted">{t('codeMappings.columns.toCode')}</label>
              <SearchInputWithOverflowTooltip
                type="text"
                value={filters.toCode}
                onChange={(event) => setFilter('toCode', event.target.value)}
                placeholder={t('codeMappings.filters.toCodePlaceholder')}
                className="w-full px-4 py-2 border rounded-lg theme-input"
              />
            </div>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4 items-end">
              <div>
              <label className="block text-sm font-medium mb-2 theme-text-muted">{t('codeMappings.columns.status')}</label>
              <select
                className="w-full px-3 py-2 rounded-lg border theme-input"
                value={filters.status}
                onChange={(event) => setFilter('status', event.target.value as CodeMappingColumnFilters['status'])}
                aria-label={t('codeMappings.filters.statusAria')}
              >
                <option value="" className={selectOptionClassName}>{t('codeMappings.filters.allStatuses')}</option>
                <option value="active" className={selectOptionClassName}>{t('codeMappings.status.active')}</option>
                <option value="inactive" className={selectOptionClassName}>{t('codeMappings.status.inactive')}</option>
              </select>
            </div>
              {hasActiveFiltersOrSearch && (
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      resetFilters()
                      setSearchTerm('')
                    }}
                    className="theme-header-action rounded-lg theme-btn-neutral theme-focus w-full md:w-auto"
                  >
                    {formatLabel(t('codeMappings.filters.clearAll'))}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {hasActiveFiltersOrSearch && (
          <div
            ref={filterBarRef}
            className="sticky top-0 z-40 mb-1 theme-filterbar border-2 border-[rgb(var(--ring-rgb)/0.35)] px-4 py-2 shadow-md rounded-lg"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold theme-link">{t('filters.activeFilters')}</span>
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="px-2 py-1 rounded text-xs font-medium transition-colors theme-filterchip"
                    title={getEnglishTooltip('filters.searchChip', { value: searchTerm })}
                  >
                    {t('filters.searchChip', { value: searchTerm })}
                  </button>
                )}
                {filters.fromSystem && (
                  <button
                    type="button"
                    onClick={() => setFilter('fromSystem', '')}
                    className="px-2 py-1 rounded text-xs font-medium transition-colors theme-filterchip"
                    title={getEnglishTooltip('codeMappings.filters.fromSystemChip', { value: filters.fromSystem })}
                  >
                    {t('codeMappings.filters.fromSystemChip', { value: filters.fromSystem })}
                  </button>
                )}
                {filters.fromType && (
                  <button
                    type="button"
                    onClick={() => setFilter('fromType', '')}
                    className="px-2 py-1 rounded text-xs font-medium transition-colors theme-filterchip"
                    title={getEnglishTooltip('codeMappings.filters.fromTypeChip', { value: filters.fromType })}
                  >
                    {t('codeMappings.filters.fromTypeChip', { value: filters.fromType })}
                  </button>
                )}
                {filters.fromCode && (
                  <button
                    type="button"
                    onClick={() => setFilter('fromCode', '')}
                    className="px-2 py-1 rounded text-xs font-medium transition-colors theme-filterchip"
                    title={getEnglishTooltip('codeMappings.filters.fromCodeChip', { value: filters.fromCode })}
                  >
                    {t('codeMappings.filters.fromCodeChip', { value: filters.fromCode })}
                  </button>
                )}
                {filters.toSystem && (
                  <button
                    type="button"
                    onClick={() => setFilter('toSystem', '')}
                    className="px-2 py-1 rounded text-xs font-medium transition-colors theme-filterchip"
                    title={getEnglishTooltip('codeMappings.filters.toSystemChip', { value: filters.toSystem })}
                  >
                    {t('codeMappings.filters.toSystemChip', { value: filters.toSystem })}
                  </button>
                )}
                {filters.toType && (
                  <button
                    type="button"
                    onClick={() => setFilter('toType', '')}
                    className="px-2 py-1 rounded text-xs font-medium transition-colors theme-filterchip"
                    title={getEnglishTooltip('codeMappings.filters.toTypeChip', { value: filters.toType })}
                  >
                    {t('codeMappings.filters.toTypeChip', { value: filters.toType })}
                  </button>
                )}
                {filters.toCode && (
                  <button
                    type="button"
                    onClick={() => setFilter('toCode', '')}
                    className="px-2 py-1 rounded text-xs font-medium transition-colors theme-filterchip"
                    title={getEnglishTooltip('codeMappings.filters.toCodeChip', { value: filters.toCode })}
                  >
                    {t('codeMappings.filters.toCodeChip', { value: filters.toCode })}
                  </button>
                )}
                {filters.status && (
                  <button
                    type="button"
                    onClick={() => setFilter('status', '')}
                    className="px-2 py-1 rounded text-xs font-medium transition-colors theme-filterchip"
                    title={getEnglishTooltip('codeMappings.filters.statusChip', { value: filters.status === 'active' ? t('codeMappings.status.active', { lng: 'en' }) : t('codeMappings.status.inactive', { lng: 'en' }) })}
                  >
                    {t('codeMappings.filters.statusChip', { value: filters.status === 'active' ? t('codeMappings.status.active') : t('codeMappings.status.inactive') })}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => { resetFilters(); setSearchTerm('') }}
                className="px-3 py-1 text-xs rounded-lg transition-colors font-medium shadow-sm theme-filterchip-clear"
                title={getEnglishTooltip('filters.clearAll')}
              >
                {t('filters.clearAll')}
              </button>
            </div>
          </div>
        )}

        {/* Mappings Table */}
        <div className="theme-table-shell rounded-lg shadow border-2">
          <SyncedWideTable
            stickyTopOffset={hasActiveFiltersOrSearch ? filterBarHeight : 0}
            dependencyKey={`${effectiveExpandedWidth}-${filteredMappings.length}`}
            headerRow={(
              <tr>
                <th className={`px-4 py-3 text-center text-xs font-medium uppercase tracking-wider theme-table-header-cell ${filters.fromSystem ? 'text-[rgb(var(--primary-rgb))]' : ''}`}>
                  <span title={getEnglishTooltip('codeMappings.columns.fromSystem')}>{t('codeMappings.columns.fromSystem')}</span>
                </th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider theme-table-header-cell ${filters.fromType ? 'text-[rgb(var(--primary-rgb))]' : ''}`}>
                  <span title={getEnglishTooltip('codeMappings.columns.fromType')}>{t('codeMappings.columns.fromType')}</span>
                </th>
                <th className={`px-4 py-3 text-center text-xs font-medium uppercase tracking-wider theme-table-header-cell ${filters.fromCode ? 'text-[rgb(var(--primary-rgb))]' : ''}`}>
                  <span title={getEnglishTooltip('codeMappings.columns.fromCode')}>{t('codeMappings.columns.fromCode')}</span>
                </th>
                <th className={`px-4 py-3 text-center text-xs font-medium uppercase tracking-wider theme-table-header-cell ${filters.toSystem ? 'text-[rgb(var(--primary-rgb))]' : ''}`}>
                  <span title={getEnglishTooltip('codeMappings.columns.toSystem')}>{t('codeMappings.columns.toSystem')}</span>
                </th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider theme-table-header-cell ${filters.toType ? 'text-[rgb(var(--primary-rgb))]' : ''}`}>
                  <span title={getEnglishTooltip('codeMappings.columns.toType')}>{t('codeMappings.columns.toType')}</span>
                </th>
                <th className={`px-4 py-3 text-center text-xs font-medium uppercase tracking-wider theme-table-header-cell ${filters.toCode ? 'text-[rgb(var(--primary-rgb))]' : ''}`}>
                  <span title={getEnglishTooltip('codeMappings.columns.toCode')}>{t('codeMappings.columns.toCode')}</span>
                </th>
                <th className={`px-4 py-3 text-center text-xs font-medium uppercase tracking-wider theme-table-header-cell ${filters.status ? 'text-[rgb(var(--primary-rgb))]' : ''}`}>
                  <span title={getEnglishTooltip('codeMappings.columns.status')}>{t('codeMappings.columns.status')}</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider theme-table-header-cell">
                  <span title={getEnglishTooltip('codeMappings.columns.description')}>{t('codeMappings.columns.description')}</span>
                </th>
              </tr>
            )}
            bodyRows={(
              <>
                {filteredMappings.length > 0 ? (
                  filteredMappings.map((mapping) => (
                    <tr key={mapping.id} className="theme-table-row-hover transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-center">
                        <Badge variant="orange" mono>{mapping.from_system}</Badge>
                      </td>
                      <td className={`px-4 text-sm theme-text-muted font-mono text-xs ${effectiveExpandedWidth ? 'py-4 whitespace-normal break-words' : 'py-3 whitespace-nowrap'}`}>
                        {mapping.from_code_type}
                      </td>
                      <td className={`px-4 text-sm text-center ${effectiveExpandedWidth ? 'py-4 whitespace-normal break-words' : 'py-3 whitespace-nowrap'}`}>
                        <Badge variant="red" mono>{mapping.from_code}</Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-center">
                        <Badge variant="blue" mono>{mapping.to_system}</Badge>
                      </td>
                      <td className={`px-4 text-sm theme-text-muted font-mono text-xs ${effectiveExpandedWidth ? 'py-4 whitespace-normal break-words' : 'py-3 whitespace-nowrap'}`}>
                        {mapping.to_code_type}
                      </td>
                      <td className={`px-4 text-sm text-center ${effectiveExpandedWidth ? 'py-4 whitespace-normal break-words' : 'py-3 whitespace-nowrap'}`}>
                        <Badge variant="green" mono>{mapping.to_code}</Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        <Badge variant={mapping.active ? 'green' : 'gray'}>
                          <span title={mapping.active ? getEnglishTooltip('codeMappings.status.active') : getEnglishTooltip('codeMappings.status.inactive')}>
                            {mapping.active ? t('codeMappings.status.active') : t('codeMappings.status.inactive')}
                          </span>
                        </Badge>
                      </td>
                      <td className={`px-4 text-sm theme-text-muted max-w-xl ${effectiveExpandedWidth ? 'py-4 whitespace-normal break-words' : 'py-3 truncate'}`}>
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
              </>
            )}
          />
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

      <PreferenceSavePrompt
        visible={expandedWidthPreference.showPrompt}
        resetKey={expandedWidthPreference.promptResetKey}
        onSave={expandedWidthPreference.save}
        onDismiss={expandedWidthPreference.dismiss}
        label={t('referenceLayout.savePageWidthDefault')}
        showUndo={expandedWidthPreference.showUndo}
        undoResetKey={expandedWidthPreference.undoResetKey}
        onUndo={expandedWidthPreference.undo}
        onUndoDismiss={expandedWidthPreference.undoDismiss}
        undoLabel={t('preferences.savedUndo')}
      />
    </div>
  )
}
