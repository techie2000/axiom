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
import { buildDocsUrl } from '../lib/docsLinks'
import { useEnglishTooltips } from '../lib/useEnglishTooltips'
import { useButtonEmojiMode } from '../lib/useButtonEmojiMode'
import { useSearchFocusShortcut } from '../lib/useSearchFocusShortcut'

interface Currency {
  id: string
  code: string
  name: string
  symbol: string
  symbol_native: string
  decimal_digits: number
  rounding: number
  name_plural: string
  active: boolean
  is_alert_cls_allowed: boolean
  is_ofac_sanctioned: boolean
}

type ComplianceFilter = 'all' | 'alert_cls' | 'ofac'
type CurrencySortField = 'code' | 'name' | 'symbol' | 'decimal_digits' | 'is_alert_cls_allowed' | 'is_ofac_sanctioned'

export default function CurrenciesPage() {
  const { t } = useTranslation('common')
  const { getEnglishTooltip } = useEnglishTooltips()
  const { formatLabel } = useButtonEmojiMode()
  const filterBarRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  useSearchFocusShortcut(searchInputRef)

  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [complianceFilter, setComplianceFilter] = useState<ComplianceFilter>('all')
  const [sortField, setSortField] = useState<CurrencySortField | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [filterBarHeight, setFilterBarHeight] = useState(0)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Preference-backed expanded width
  const expandedWidthPreference = useDeferredBooleanPreference({
    pageKey: 'currencies',
    preferenceKey: 'expanded_width',
    defaultValue: true,
  })

  const [hasHydrated, setHasHydrated] = useState(false)
  const effectiveExpandedWidth = hasHydrated ? expandedWidthPreference.value : true

  useEffect(() => {
    setHasHydrated(true)
  }, [])

  const API_BASE_URL = getApiBaseUrl()

  useEffect(() => {
    setIsLoggedIn(getAuthToken() !== null)
  }, [])

  const fetchCurrencies = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/currencies`, {
        headers: {
          'Accept': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setCurrencies(data || [])
        if (!data || data.length === 0) {
          setError('No currencies data available yet. The database may need to be populated with reference data.')
        } else {
          setError(null)
        }
      } else {
        setError(`API returned ${response.status}: ${response.statusText}`)
      }
    } catch (err) {
      console.error('Currencies fetch error:', err)
      setError('Unable to connect to backend API. Please ensure the backend service is running at ' + API_BASE_URL)
    } finally {
      setLoading(false)
    }
  }, [API_BASE_URL])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchCurrencies()
    }
  }, [fetchCurrencies])

  const alertClsCount = currencies.filter(c => c.is_alert_cls_allowed).length
  const ofacCount = currencies.filter(c => c.is_ofac_sanctioned).length

  const handleSort = (field: CurrencySortField) => {
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

  const filteredCurrencies = currencies
    .filter(currency => {
      const matchesSearch =
        currency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        currency.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (currency.symbol && currency.symbol.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesCompliance =
        complianceFilter === 'all' ||
        (complianceFilter === 'alert_cls' && currency.is_alert_cls_allowed) ||
        (complianceFilter === 'ofac' && currency.is_ofac_sanctioned)

      return matchesSearch && matchesCompliance
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
        case 'decimal_digits':
          comparison = left.decimal_digits - right.decimal_digits
          break
        case 'is_alert_cls_allowed':
          comparison = Number(left.is_alert_cls_allowed) - Number(right.is_alert_cls_allowed)
          break
        case 'is_ofac_sanctioned':
          comparison = Number(left.is_ofac_sanctioned) - Number(right.is_ofac_sanctioned)
          break
        case 'code':
          comparison = left.code.localeCompare(right.code, undefined, { sensitivity: 'base' })
          break
        case 'symbol':
          comparison = left.symbol.localeCompare(right.symbol, undefined, { sensitivity: 'base' })
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

  const hasActiveFilters = searchTerm || complianceFilter !== 'all'

  const complianceFilterTranslationKey =
    complianceFilter === 'alert_cls'
      ? 'currencies.filters.alertClsAllowed'
      : complianceFilter === 'ofac'
        ? 'currencies.filters.ofacSanctioned'
        : 'currencies.filters.allCurrencies'

  const applyComplianceCardFilter = (filter: ComplianceFilter) => {
    setComplianceFilter((previousFilter) => (previousFilter === filter ? 'all' : filter))
  }

  const clearFilters = () => {
    setSearchTerm('')
    setComplianceFilter('all')
  }

  useEffect(() => {
    if (hasActiveFilters && filterBarRef.current) {
      setFilterBarHeight(filterBarRef.current.offsetHeight)
      return
    }

    setFilterBarHeight(0)
  }, [hasActiveFilters, searchTerm, complianceFilter])

  if (loading) {
    return <LoadingSpinner message={t('currencies.loading')} />
  }

  const backHref = isLoggedIn ? '/dashboard' : '/home'

  return (
    <div className="min-h-screen p-8 pb-14">
      <div className={`${effectiveExpandedWidth ? 'max-w-full' : 'max-w-7xl'} mx-auto transition-all duration-300`}>
        {/* Header */}
        <PageHeader
          title={t('currencies.title')}
          subtitle={t('currencies.subtitle')}
          titleTooltip={getEnglishTooltip('currencies.title')}
          subtitleTooltip={getEnglishTooltip('currencies.subtitle')}
          backHref={backHref}
          docsHref={buildDocsUrl('workflows/currencies/')}
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

        {/* Info/Error Alert */}
        {error && (
          <Alert
            variant={error.includes('No currencies data') ? 'warning' : 'error'}
            title={error.includes('No currencies data') ? t('currencies.noticeTitle') : t('currencies.errorTitle')}
            className="mb-6"
          >
            {error}
            {error.includes('No currencies data') && (
              <p className="text-sm mt-2 opacity-80">
                {t('currencies.noDataTip')}
              </p>
            )}
          </Alert>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard title={t('currencies.stats.totalCurrencies')} titleTooltip={getEnglishTooltip('currencies.stats.totalCurrencies')} value={currencies.length} />
          <StatCard title={t('currencies.stats.filteredResults')} titleTooltip={getEnglishTooltip('currencies.stats.filteredResults')} value={filteredCurrencies.length} />
          <ActionableStatCard
            title={t('currencies.stats.alertClsAllowed')}
            titleTooltip={getEnglishTooltip('currencies.stats.alertClsAllowed')}
            value={alertClsCount}
            accent="green"
            isActive={complianceFilter === 'alert_cls'}
            onClick={() => applyComplianceCardFilter('alert_cls')}
            ariaLabel={t('currencies.aria.filterAlertCls')}
          />
          <ActionableStatCard
            title={t('currencies.stats.ofacSanctioned')}
            titleTooltip={getEnglishTooltip('currencies.stats.ofacSanctioned')}
            value={ofacCount}
            accent="red"
            isActive={complianceFilter === 'ofac'}
            onClick={() => applyComplianceCardFilter('ofac')}
            ariaLabel={t('currencies.aria.filterOfac')}
          />
        </div>

        {/* Search and compliance filter */}
        <div className="mb-6 theme-panel border-2 backdrop-blur-sm rounded-lg p-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <SearchInputWithOverflowTooltip
            ref={searchInputRef}
            type="text"
            placeholder={t('currencies.searchPlaceholder')}
            title={getEnglishTooltip('currencies.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-lg theme-input"
          />
          <ThemedSelect
            value={complianceFilter}
            onChange={(next) => setComplianceFilter(next as ComplianceFilter)}
            ariaLabel={t('currencies.filters.complianceChip', {
              value: complianceFilter === 'alert_cls'
                ? t('currencies.filters.alertClsAllowed')
                : complianceFilter === 'ofac'
                  ? t('currencies.filters.ofacSanctioned')
                  : t('currencies.filters.allCurrencies'),
            })}
            title={getEnglishTooltip(complianceFilterTranslationKey)}
            className="min-w-[13rem]"
            options={[
              {
                value: 'all',
                label: t('currencies.filters.allCurrencies'),
                title: getEnglishTooltip('currencies.filters.allCurrencies'),
              },
              {
                value: 'alert_cls',
                label: t('currencies.filters.alertClsAllowed'),
                title: getEnglishTooltip('currencies.filters.alertClsAllowed'),
              },
              {
                value: 'ofac',
                label: t('currencies.filters.ofacSanctioned'),
                title: getEnglishTooltip('currencies.filters.ofacSanctioned'),
              },
            ]}
          />
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
                {complianceFilter !== 'all' && (
                  <button
                    onClick={() => setComplianceFilter('all')}
                    className="px-2 py-1 rounded text-xs font-medium transition-colors theme-filterchip"
                    title={getEnglishTooltip('currencies.filters.complianceChip', {
                      value: complianceFilter === 'alert_cls' ? t('currencies.filters.alertClsAllowed', { lng: 'en' }) : t('currencies.filters.ofacSanctioned', { lng: 'en' })
                    })}
                  >
                    {t('currencies.filters.complianceChip', {
                      value: complianceFilter === 'alert_cls' ? t('currencies.filters.alertClsAllowed') : t('currencies.filters.ofacSanctioned')
                    })}
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

        {/* Currencies Table */}
        <div className="theme-table-shell rounded-lg shadow border-2">
          <SyncedWideTable
            stickyTopOffset={hasActiveFilters ? filterBarHeight : 0}
            dependencyKey={`${effectiveExpandedWidth}-${filteredCurrencies.length}-${complianceFilter}-${searchTerm}`}
            headerRow={(
              <tr>
                <SortableHeaderCell
                  className="w-20 px-4 py-3 text-xs font-medium uppercase tracking-wider theme-table-header-cell"
                  align="center"
                  label={<span title={getEnglishTooltip('currencies.columns.code')}>{t('currencies.columns.code')}</span>}
                  onSort={() => handleSort('code')}
                  isActiveSort={sortField === 'code'}
                  sortDirection={sortDirection}
                />
                <SortableHeaderCell
                  className="w-80 px-4 py-3 text-xs font-medium uppercase tracking-wider theme-table-header-cell"
                  label={<span title={getEnglishTooltip('currencies.columns.name')}>{t('currencies.columns.name')}</span>}
                  onSort={() => handleSort('name')}
                  isActiveSort={sortField === 'name'}
                  sortDirection={sortDirection}
                />
                <SortableHeaderCell
                  className="w-40 px-4 py-3 text-xs font-medium uppercase tracking-wider theme-table-header-cell"
                  label={<span title={getEnglishTooltip('currencies.columns.symbol')}>{t('currencies.columns.symbol')}</span>}
                  onSort={() => handleSort('symbol')}
                  isActiveSort={sortField === 'symbol'}
                  sortDirection={sortDirection}
                />
                <SortableHeaderCell
                  className="w-24 px-4 py-3 text-xs font-medium uppercase tracking-wider theme-table-header-cell"
                  align="center"
                  label={<span title={getEnglishTooltip('currencies.columns.decimals')}>{t('currencies.columns.decimals')}</span>}
                  onSort={() => handleSort('decimal_digits')}
                  isActiveSort={sortField === 'decimal_digits'}
                  sortDirection={sortDirection}
                />
                <SortableHeaderCell
                  className="w-32 px-4 py-3 text-xs font-medium uppercase tracking-wider theme-table-header-cell"
                  align="center"
                  label={<span title={getEnglishTooltip('currencies.columns.alertCls')}>{t('currencies.columns.alertCls')}</span>}
                  onSort={() => handleSort('is_alert_cls_allowed')}
                  isActiveSort={sortField === 'is_alert_cls_allowed'}
                  sortDirection={sortDirection}
                />
                <SortableHeaderCell
                  className="w-36 px-4 py-3 text-xs font-medium uppercase tracking-wider theme-table-header-cell"
                  align="center"
                  label={<span title={getEnglishTooltip('currencies.columns.ofac')}>{t('currencies.columns.ofac')}</span>}
                  onSort={() => handleSort('is_ofac_sanctioned')}
                  isActiveSort={sortField === 'is_ofac_sanctioned'}
                  sortDirection={sortDirection}
                />
              </tr>
            )}
            bodyRows={(
              <>
                {filteredCurrencies.length > 0 ? (
                  filteredCurrencies.map((currency) => (
                    <tr key={currency.id} className="theme-table-row-hover transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-center">
                        <Badge variant="blue" mono>{currency.code}</Badge>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm theme-text-muted">
                        <span>{currency.name}</span>
                        {currency.name_plural && currency.name_plural !== currency.name && (
                          <span className="ml-1 text-xs theme-text-muted">
                            ({currency.name_plural})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm theme-text-muted">
                        <span className="text-lg">{currency.symbol}</span>
                        {currency.symbol_native && currency.symbol_native !== currency.symbol && (
                          <span className="ml-2 text-xs theme-text-muted">{currency.symbol_native}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm theme-text-muted font-mono text-center">
                        {currency.decimal_digits}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                        {currency.is_alert_cls_allowed ? (
                          <Badge variant="green" shape="pill"><span title={getEnglishTooltip('currencies.status.allowed')}>{t('currencies.status.allowed')}</span></Badge>
                        ) : (
                          <span className="theme-text-muted text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                        {currency.is_ofac_sanctioned ? (
                          <Badge variant="red" shape="pill"><span title={getEnglishTooltip('currencies.status.sanctioned')}>{t('currencies.status.sanctioned')}</span></Badge>
                        ) : (
                          <span className="theme-text-muted text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm theme-text-muted">
                      {t('currencies.emptyWithSearch')}
                    </td>
                  </tr>
                )}
              </>
            )}
          />
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center text-sm theme-text-muted">
          <p title={getEnglishTooltip('currencies.footer')}>{t('currencies.footer')}</p>
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
