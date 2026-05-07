'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Alert from '../components/Alert'
import ActionableStatCard from '../components/ActionableStatCard'
import Badge from '../components/Badge'
import LoadingSpinner from '../components/LoadingSpinner'
import PageHeader from '../components/PageHeader'
import PreferenceSavePrompt from '../components/PreferenceSavePrompt'
import ReferencePageHeaderActions from '../components/ReferencePageHeaderActions'
import SearchInputWithOverflowTooltip from '../components/SearchInputWithOverflowTooltip'
import SortableHeaderCell from '../components/SortableHeaderCell'
import StatCard from '../components/StatCard'
import SyncedWideTable from '../components/SyncedWideTable'
import ThemedSelect from '../components/ThemedSelect'
import { getApiBaseUrl } from '../lib/api-base'
import { getAuthToken } from '../lib/auth-token'
import { useDeferredBooleanPreference } from '../lib/useDeferredBooleanPreference'
import { useEnglishTooltips } from '../lib/useEnglishTooltips'
import { useButtonEmojiMode } from '../lib/useButtonEmojiMode'
import { useSearchFocusShortcut } from '../lib/useSearchFocusShortcut'

interface Language {
  code: string
  name: string
  native: string
  rtl: boolean
}

type DirectionFilter = 'all' | 'rtl' | 'ltr'
type LanguageSortField = 'code' | 'name' | 'native' | 'rtl'

export default function LanguagesPage() {
  const { t } = useTranslation('common')
  const { getEnglishTooltip } = useEnglishTooltips()
  const { formatLabel } = useButtonEmojiMode()
  const filterBarRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  useSearchFocusShortcut(searchInputRef)

  const [languages, setLanguages] = useState<Language[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all')
  const [sortField, setSortField] = useState<LanguageSortField | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [filterBarHeight, setFilterBarHeight] = useState(0)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Preference-backed expanded width
  const expandedWidthPreference = useDeferredBooleanPreference({
    pageKey: 'languages',
    preferenceKey: 'expanded_width',
    defaultValue: true,
  })
  const referenceDisplayPreference = useDeferredBooleanPreference({
    pageKey: 'languages',
    preferenceKey: 'display_reference_codes',
    defaultValue: false,
  })

  const [hasHydrated, setHasHydrated] = useState(false)
  const effectiveExpandedWidth = hasHydrated ? expandedWidthPreference.value : true
  const showReferenceCodes = referenceDisplayPreference.value

  useEffect(() => {
    setHasHydrated(true)
  }, [])

  const API_BASE_URL = getApiBaseUrl()

  useEffect(() => {
    setIsLoggedIn(getAuthToken() !== null)
  }, [])

  const fetchLanguages = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/languages`, {
        headers: {
          'Accept': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setLanguages(Array.isArray(data) ? data : [])

        if (!data || data.length === 0) {
          setError('No languages data available yet. The database may need to be populated with reference data.')
        } else {
          setError(null)
        }
      } else {
        setError(`API returned ${response.status}: ${response.statusText}`)
      }
    } catch (err) {
      console.error('Languages fetch error:', err)
      setError('Unable to connect to backend API. Please ensure the backend service is running at ' + API_BASE_URL)
    } finally {
      setLoading(false)
    }
  }, [API_BASE_URL])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchLanguages()
    }
  }, [fetchLanguages])

  const handleSort = (field: LanguageSortField) => {
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

  const filteredLanguages = languages
    .filter((language) => {
      const normalizedSearch = searchTerm.toLowerCase()
      const matchesSearch =
        language.code.toLowerCase().includes(normalizedSearch) ||
        language.name.toLowerCase().includes(normalizedSearch) ||
        language.native.toLowerCase().includes(normalizedSearch)

      const matchesDirection =
        directionFilter === 'all' ||
        (directionFilter === 'rtl' && language.rtl) ||
        (directionFilter === 'ltr' && !language.rtl)

      return matchesSearch && matchesDirection
    })
    .sort((left, right) => {
      if (!sortField) {
        const defaultNameCompare = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
        if (defaultNameCompare !== 0) {
          return defaultNameCompare
        }

        return left.code.localeCompare(right.code, undefined, { sensitivity: 'base' })
      }

      let comparison = 0

      switch (sortField) {
        case 'code':
          comparison = left.code.localeCompare(right.code, undefined, { sensitivity: 'base' })
          break
        case 'native':
          comparison = left.native.localeCompare(right.native, undefined, { sensitivity: 'base' })
          break
        case 'rtl':
          comparison = Number(left.rtl) - Number(right.rtl)
          break
        case 'name':
        default:
          comparison = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
          break
      }

      if (comparison === 0) {
        comparison = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
      }

      if (comparison === 0) {
        comparison = left.code.localeCompare(right.code, undefined, { sensitivity: 'base' })
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

  const rtlCount = languages.filter((language) => language.rtl).length
  const ltrCount = languages.length - rtlCount
  const hasActiveFilters = searchTerm || directionFilter !== 'all'
  const directionFilterTranslationKey = directionFilter === 'rtl' ? 'languages.filters.rtl' : directionFilter === 'ltr' ? 'languages.filters.ltr' : 'languages.filters.all'

  const applyDirectionCardFilter = (filter: DirectionFilter) => {
    setDirectionFilter((previousFilter) => (previousFilter === filter ? 'all' : filter))
  }

  const clearFilters = () => {
    setSearchTerm('')
    setDirectionFilter('all')
  }

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
  }, [hasActiveFilters, searchTerm, directionFilter])

  if (loading) {
    return <LoadingSpinner message={t('languages.loading')} />
  }

  const backHref = isLoggedIn ? '/dashboard' : '/home'

  return (
    <div className="min-h-screen p-8 pb-14">
      <div className={`${effectiveExpandedWidth ? 'max-w-full' : 'max-w-7xl'} mx-auto transition-all duration-300`}>
        <PageHeader
          title={t('languages.title')}
          subtitle={t('languages.subtitle')}
          titleTooltip={getEnglishTooltip('languages.title')}
          subtitleTooltip={getEnglishTooltip('languages.subtitle')}
          backHref={backHref}
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
              secondaryToggle={{
                isActive: showReferenceCodes,
                onToggle: referenceDisplayPreference.toggle,
                activeTitle: getEnglishTooltip('referenceLayout.displayCodesButton'),
                inactiveTitle: getEnglishTooltip('referenceLayout.displayNamesButton'),
                activeLabel: t('referenceLayout.displayCodesButton'),
                inactiveLabel: t('referenceLayout.displayNamesButton'),
              }}
            />
          }
        />

        {error && (
          <Alert
            variant={error.includes('No languages data') ? 'warning' : 'error'}
            title={error.includes('No languages data') ? t('languages.noticeTitle') : t('languages.errorTitle')}
            className="mb-6"
          >
            {error}
          </Alert>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard title={t('languages.stats.totalLanguages')} titleTooltip={getEnglishTooltip('languages.stats.totalLanguages')} value={languages.length} />
          <StatCard title={t('languages.stats.filteredResults')} titleTooltip={getEnglishTooltip('languages.stats.filteredResults')} value={filteredLanguages.length} />
          <ActionableStatCard
            title={t('languages.stats.ltrLanguages')}
            titleTooltip={getEnglishTooltip('languages.stats.ltrLanguages')}
            value={ltrCount}
            accent="yellow"
            isActive={directionFilter === 'ltr'}
            onClick={() => applyDirectionCardFilter('ltr')}
            ariaLabel={t('languages.aria.filterLtr')}
          />
          <ActionableStatCard
            title={t('languages.stats.rtlLanguages')}
            titleTooltip={getEnglishTooltip('languages.stats.rtlLanguages')}
            value={rtlCount}
            accent="purple"
            isActive={directionFilter === 'rtl'}
            onClick={() => applyDirectionCardFilter('rtl')}
            ariaLabel={t('languages.aria.filterRtl')}
          />
        </div>

        <div className="relative z-40 mb-6 theme-panel border-2 backdrop-blur-sm rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2 theme-text-muted">{t('languages.filters.search')}</label>
              <SearchInputWithOverflowTooltip
                ref={searchInputRef}
                type="text"
                placeholder={t('languages.searchPlaceholder')}
                title={getEnglishTooltip('languages.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg theme-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 theme-text-muted">{t('languages.filters.direction')}</label>
              <ThemedSelect
                value={directionFilter}
                onChange={(next) => setDirectionFilter(next as DirectionFilter)}
                ariaLabel={t('languages.filters.direction')}
                title={getEnglishTooltip(directionFilterTranslationKey)}
                className="w-full"
                options={[
                  { value: 'all', label: t('languages.filters.all'), title: getEnglishTooltip('languages.filters.all') },
                  { value: 'rtl', label: t('languages.filters.rtl'), title: getEnglishTooltip('languages.filters.rtl') },
                  { value: 'ltr', label: t('languages.filters.ltr'), title: getEnglishTooltip('languages.filters.ltr') },
                ]}
              />
            </div>
          </div>
          {hasActiveFilters && (
            <div className="flex gap-3">
              <button
                onClick={clearFilters}
                className="px-6 py-2 rounded-lg theme-btn-neutral transition-colors font-medium shadow-sm"
                title={getEnglishTooltip('actions.clearFilters')}
              >
                {t('actions.clearFilters')}
              </button>
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <div
            ref={filterBarRef}
            className="sticky top-0 z-40 mb-1 theme-filterbar border-2 border-[rgb(var(--ring-rgb)/0.35)] px-4 py-2 shadow-md rounded-lg"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold theme-link">{t('filters.activeFilters')}</span>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="px-2 py-1 rounded text-xs font-medium transition-colors theme-filterchip"
                    title={getEnglishTooltip('filters.searchChip', { value: searchTerm })}
                  >
                    {t('filters.searchChip', { value: searchTerm })}
                  </button>
                )}
                {directionFilter !== 'all' && (
                  <button
                    onClick={() => setDirectionFilter('all')}
                    className="px-2 py-1 rounded text-xs font-medium transition-colors theme-filterchip"
                    title={getEnglishTooltip('languages.filters.directionChip', { value: directionFilter.toUpperCase() })}
                  >
                    {t('languages.filters.directionChip', { value: directionFilter.toUpperCase() })}
                  </button>
                )}
              </div>
              <button
                onClick={clearFilters}
                className="px-3 py-1 text-xs rounded-lg theme-filterchip-clear transition-colors font-medium shadow-sm"
                title={getEnglishTooltip('filters.clearAll')}
              >
                {t('filters.clearAll')}
              </button>
            </div>
          </div>
        )}

        <div className="theme-table-shell rounded-lg shadow border-2">
          <SyncedWideTable
            stickyTopOffset={hasActiveFilters ? filterBarHeight : 0}
            dependencyKey={`${effectiveExpandedWidth}-${showReferenceCodes}-${filteredLanguages.length}-${directionFilter}-${searchTerm}`}
            headerRow={(
              <tr>
                <SortableHeaderCell
                  className={`${showReferenceCodes ? 'w-24 px-4' : 'w-64 px-6'} py-3 text-xs font-medium uppercase tracking-wider theme-table-header-cell`}
                  align={showReferenceCodes ? 'center' : 'left'}
                  label={showReferenceCodes ? t('languages.columns.code') : t('languages.columns.languageName')}
                  onSort={() => handleSort(showReferenceCodes ? 'code' : 'name')}
                  isActiveSort={sortField === (showReferenceCodes ? 'code' : 'name')}
                  sortDirection={sortDirection}
                />
                <SortableHeaderCell
                  className={`${showReferenceCodes ? 'w-64 px-6' : 'w-24 px-4'} py-3 text-xs font-medium uppercase tracking-wider theme-table-header-cell`}
                  align={showReferenceCodes ? 'left' : 'center'}
                  label={showReferenceCodes ? t('languages.columns.languageName') : t('languages.columns.code')}
                  onSort={() => handleSort(showReferenceCodes ? 'name' : 'code')}
                  isActiveSort={sortField === (showReferenceCodes ? 'name' : 'code')}
                  sortDirection={sortDirection}
                />
                <SortableHeaderCell
                  className="w-64 px-6 py-3 text-xs font-medium uppercase tracking-wider theme-table-header-cell"
                  label={t('languages.columns.nativeName')}
                  onSort={() => handleSort('native')}
                  isActiveSort={sortField === 'native'}
                  sortDirection={sortDirection}
                />
                <SortableHeaderCell
                  className="w-36 px-6 py-3 text-xs font-medium uppercase tracking-wider theme-table-header-cell"
                  align="center"
                  label={t('languages.columns.direction')}
                  onSort={() => handleSort('rtl')}
                  isActiveSort={sortField === 'rtl'}
                  sortDirection={sortDirection}
                />
              </tr>
            )}
            bodyRows={(
              <>
                {filteredLanguages.length > 0 ? (
                  filteredLanguages.map((language) => (
                    <tr key={language.code} className="theme-table-row-hover transition-colors">
                      <td className={`${showReferenceCodes ? 'px-4' : 'px-6'} py-4 whitespace-nowrap text-sm font-medium ${showReferenceCodes ? 'text-center' : ''}`}>
                        {showReferenceCodes ? (
                          <Badge variant="blue" mono>{language.code}</Badge>
                        ) : (
                          language.name || '-'
                        )}
                      </td>
                      <td className={`${showReferenceCodes ? 'px-6' : 'px-4'} py-4 whitespace-nowrap text-sm theme-text-muted ${showReferenceCodes ? '' : 'text-center'}`}>
                        {showReferenceCodes ? (
                          <span>{language.name || '-'}</span>
                        ) : (
                          <Badge variant="blue" mono>{language.code}</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm theme-text-muted">
                        {language.native || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        {language.rtl ? (
                          <Badge variant="purple" shape="pill">{t('languages.filters.rtl')}</Badge>
                        ) : (
                          <Badge variant="yellow" shape="pill">{t('languages.filters.ltr')}</Badge>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm theme-text-muted">
                      {t('languages.emptyWithSearch')}
                    </td>
                  </tr>
                )}
              </>
            )}
          />
        </div>

        <div className="mt-6 text-center text-sm theme-text-muted">
          <p>{t('languages.footer')}</p>
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
      <PreferenceSavePrompt
        visible={referenceDisplayPreference.showPrompt}
        resetKey={referenceDisplayPreference.promptResetKey}
        onSave={referenceDisplayPreference.save}
        onDismiss={referenceDisplayPreference.dismiss}
        label={t('referenceLayout.saveDisplayModeDefault')}
        showUndo={referenceDisplayPreference.showUndo}
        undoResetKey={referenceDisplayPreference.undoResetKey}
        onUndo={referenceDisplayPreference.undo}
        onUndoDismiss={referenceDisplayPreference.undoDismiss}
        undoLabel={t('preferences.savedUndo')}
      />
    </div>
  )
}
