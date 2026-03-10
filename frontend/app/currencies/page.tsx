'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Alert from '../components/Alert'
import ActionableStatCard from '../components/ActionableStatCard'
import Badge from '../components/Badge'
import LoadingSpinner from '../components/LoadingSpinner'
import PageHeader from '../components/PageHeader'
import PreferenceSavePrompt from '../components/PreferenceSavePrompt'
import SortableHeaderCell from '../components/SortableHeaderCell'
import StatCard from '../components/StatCard'
import SyncedWideTable from '../components/SyncedWideTable'
import { useDeferredBooleanPreference } from '../lib/useDeferredBooleanPreference'

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
  const filterBarRef = useRef<HTMLDivElement>(null)

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

  const effectiveExpandedWidth = expandedWidthPreference.value

  const API_BASE_URL = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080')
    : 'http://backend:8080'

  useEffect(() => {
    const rawToken = localStorage.getItem('axiom_token')
    const normalizedToken = rawToken?.replace(/^Bearer\s+/i, '').trim() ?? ''
    setIsLoggedIn(normalizedToken !== '' && normalizedToken !== 'undefined' && normalizedToken !== 'null')
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
    <div className="min-h-screen p-8">
      <div className={`${effectiveExpandedWidth ? 'max-w-full' : 'max-w-7xl'} mx-auto transition-all duration-300`}>
        {/* Header */}
        <PageHeader
          title={t('currencies.title')}
          subtitle={t('currencies.subtitle')}
          backHref={backHref}
          actions={
            <>
              <button
                onClick={expandedWidthPreference.toggle}
                className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 transition-colors text-white text-sm font-medium"
                title={effectiveExpandedWidth ? t('referenceLayout.normalWidth') : t('referenceLayout.expandedWidth')}
              >
                {effectiveExpandedWidth ? t('referenceLayout.normalButton') : t('referenceLayout.expandButton')}
              </button>
              {expandedWidthPreference.hasUnsavedChanges && (
                <button
                  onClick={expandedWidthPreference.saveCurrentValue}
                  className="px-3 py-2 rounded-lg bg-green-700 hover:bg-green-600 transition-colors text-white text-xs font-medium"
                  title={t('referenceLayout.savePageWidthDefault')}
                >
                  {t('admin.translations.width.savePrompt')}
                </button>
              )}
            </>
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
          <StatCard title={t('currencies.stats.totalCurrencies')} value={currencies.length} />
          <StatCard title={t('currencies.stats.filteredResults')} value={filteredCurrencies.length} />
          <ActionableStatCard
            title={t('currencies.stats.alertClsAllowed')}
            value={alertClsCount}
            accent="green"
            isActive={complianceFilter === 'alert_cls'}
            onClick={() => applyComplianceCardFilter('alert_cls')}
            ariaLabel={t('currencies.aria.filterAlertCls')}
          />
          <ActionableStatCard
            title={t('currencies.stats.ofacSanctioned')}
            value={ofacCount}
            accent="red"
            isActive={complianceFilter === 'ofac'}
            onClick={() => applyComplianceCardFilter('ofac')}
            ariaLabel={t('currencies.aria.filterOfac')}
          />
        </div>

        {/* Search and compliance filter */}
        <div className="mb-6 bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg p-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            placeholder={t('currencies.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-white/5 text-gray-900 dark:text-white"
          />
          <select
            value={complianceFilter}
            onChange={(e) => setComplianceFilter(e.target.value as ComplianceFilter)}
            className="px-4 py-2 border border-gray-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="all">{t('currencies.filters.allCurrencies')}</option>
            <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="alert_cls">{t('currencies.filters.alertClsAllowed')}</option>
            <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="ofac">{t('currencies.filters.ofacSanctioned')}</option>
          </select>
          </div>
          {hasActiveFilters && (
            <div className="flex gap-3">
              <button
                onClick={clearFilters}
                className="px-6 py-2 rounded-lg bg-white hover:bg-gray-100 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-transparent transition-colors font-medium shadow-sm"
              >
                {t('actions.clearFilters')}
              </button>
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <div
            ref={filterBarRef}
            className="sticky top-0 z-40 mb-1 bg-blue-50 dark:bg-blue-900 border-2 border-blue-200 dark:border-blue-700 px-4 py-2 shadow-md rounded-lg"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-blue-900 dark:text-blue-100">{t('filters.activeFilters')}</span>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded text-xs font-medium hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors"
                  >
                    {t('filters.searchChip', { value: searchTerm })}
                  </button>
                )}
                {complianceFilter !== 'all' && (
                  <button
                    onClick={() => setComplianceFilter('all')}
                    className="px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded text-xs font-medium hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors"
                  >
                    {t('currencies.filters.complianceChip', {
                      value: complianceFilter === 'alert_cls' ? t('currencies.filters.alertClsAllowed') : t('currencies.filters.ofacSanctioned')
                    })}
                  </button>
                )}
              </div>
              <button
                onClick={clearFilters}
                className="px-3 py-1 text-xs rounded-lg bg-white hover:bg-gray-100 dark:bg-blue-600 dark:hover:bg-blue-700 text-blue-900 dark:text-white border border-blue-300 dark:border-transparent transition-colors font-medium shadow-sm"
              >
                {t('filters.clearAll')}
              </button>
            </div>
          </div>
        )}

        {/* Currencies Table */}
        <div className="bg-white dark:bg-white/5 rounded-lg shadow border-2 border-gray-200 dark:border-white/10">
          <SyncedWideTable
            stickyTopOffset={hasActiveFilters ? filterBarHeight : 0}
            dependencyKey={`${effectiveExpandedWidth}-${filteredCurrencies.length}-${complianceFilter}-${searchTerm}`}
            headerRow={(
              <tr>
                <SortableHeaderCell
                  className="w-20 px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  align="center"
                  label={t('currencies.columns.code')}
                  onSort={() => handleSort('code')}
                  isActiveSort={sortField === 'code'}
                  sortDirection={sortDirection}
                />
                <SortableHeaderCell
                  className="w-80 px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  label={t('currencies.columns.name')}
                  onSort={() => handleSort('name')}
                  isActiveSort={sortField === 'name'}
                  sortDirection={sortDirection}
                />
                <SortableHeaderCell
                  className="w-40 px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  label={t('currencies.columns.symbol')}
                  onSort={() => handleSort('symbol')}
                  isActiveSort={sortField === 'symbol'}
                  sortDirection={sortDirection}
                />
                <SortableHeaderCell
                  className="w-24 px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  align="center"
                  label={t('currencies.columns.decimals')}
                  onSort={() => handleSort('decimal_digits')}
                  isActiveSort={sortField === 'decimal_digits'}
                  sortDirection={sortDirection}
                />
                <SortableHeaderCell
                  className="w-32 px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  align="center"
                  label={t('currencies.columns.alertCls')}
                  onSort={() => handleSort('is_alert_cls_allowed')}
                  isActiveSort={sortField === 'is_alert_cls_allowed'}
                  sortDirection={sortDirection}
                />
                <SortableHeaderCell
                  className="w-36 px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  align="center"
                  label={t('currencies.columns.ofac')}
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
                    <tr key={currency.id} className="hover:bg-blue-50 dark:hover:bg-white/10 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white text-center">
                        <Badge variant="blue" mono>{currency.code}</Badge>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <span className="text-gray-900 dark:text-white">{currency.name}</span>
                        {currency.name_plural && currency.name_plural !== currency.name && (
                          <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">
                            ({currency.name_plural})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <span className="text-lg">{currency.symbol}</span>
                        {currency.symbol_native && currency.symbol_native !== currency.symbol && (
                          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{currency.symbol_native}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono text-center">
                        {currency.decimal_digits}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                        {currency.is_alert_cls_allowed ? (
                          <Badge variant="green" shape="pill">{t('currencies.status.allowed')}</Badge>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                        {currency.is_ofac_sanctioned ? (
                          <Badge variant="red" shape="pill">{t('currencies.status.sanctioned')}</Badge>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      {t('currencies.emptyWithSearch')}
                    </td>
                  </tr>
                )}
              </>
            )}
          />
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>{t('currencies.footer')}</p>
        </div>
      </div>

      <PreferenceSavePrompt
        visible={expandedWidthPreference.showPrompt}
        resetKey={expandedWidthPreference.promptResetKey}
        onSave={expandedWidthPreference.save}
        onDismiss={expandedWidthPreference.dismiss}
        label={t('referenceLayout.savePageWidthDefault')}
      />
    </div>
  )
}
