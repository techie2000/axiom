'use client'

import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Alert from '../components/Alert'
import Badge from '../components/Badge'
import CountryFlag from '../components/CountryFlag'
import LoadingSpinner from '../components/LoadingSpinner'
import PageHeader from '../components/PageHeader'
import PreferenceSavePrompt from '../components/PreferenceSavePrompt'
import ReferenceDetailList from '../components/ReferenceDetailList'
import SearchInputWithOverflowTooltip from '../components/SearchInputWithOverflowTooltip'
import SortableHeaderCell from '../components/SortableHeaderCell'
import StatCard from '../components/StatCard'
import SyncedWideTable from '../components/SyncedWideTable'
import ThemedSelect from '../components/ThemedSelect'
import { useDeferredBooleanPreference } from '../lib/useDeferredBooleanPreference'
import { useEnglishTooltips } from '../lib/useEnglishTooltips'
import { useButtonEmojiMode } from '../lib/useButtonEmojiMode'
import { useUserPreference } from '../lib/useUserPreference'
import { buildDocsUrl } from '../lib/docsLinks'
import { useSearchFocusShortcut } from '../lib/useSearchFocusShortcut'
import { Country, normalizeCountriesPayload, summarizeCountriesDataQuality } from './normalization'

type CountryColumnKey =
  | 'flag'
  | 'name'
  | 'alpha2'
  | 'alpha3'
  | 'numeric_code'
  | 'native_name'
  | 'capital'
  | 'continent'
  | 'region'
  | 'phone_codes'
  | 'currency_codes'
  | 'languages'
  | 'active'

interface ColumnConfig {
  key: CountryColumnKey
  labelKey: string
  defaultVisible: boolean
  width?: string
}

const AVAILABLE_COLUMNS: ColumnConfig[] = [
  { key: 'flag', labelKey: 'countries.columns.flag', defaultVisible: true, width: 'w-20' },
  { key: 'name', labelKey: 'countries.columns.name', defaultVisible: true, width: 'min-w-56' },
  { key: 'native_name', labelKey: 'countries.columns.nativeName', defaultVisible: false, width: 'min-w-56' },
  { key: 'alpha2', labelKey: 'countries.columns.alpha2Primary', defaultVisible: true, width: 'w-32' },
  { key: 'alpha3', labelKey: 'countries.columns.alpha3Secondary', defaultVisible: true, width: 'w-36' },
  { key: 'numeric_code', labelKey: 'countries.columns.numeric', defaultVisible: false, width: 'w-28' },
  { key: 'capital', labelKey: 'countries.columns.capital', defaultVisible: false, width: 'w-40' },
  { key: 'continent', labelKey: 'countries.columns.continent', defaultVisible: true, width: 'w-36' },
  { key: 'region', labelKey: 'countries.columns.region', defaultVisible: true, width: 'w-44' },
  { key: 'languages', labelKey: 'countries.columns.languages', defaultVisible: false, width: 'min-w-36' },
  { key: 'currency_codes', labelKey: 'countries.columns.currencyCodes', defaultVisible: false, width: 'min-w-36' },
  { key: 'phone_codes', labelKey: 'countries.columns.phoneCodes', defaultVisible: false, width: 'min-w-40' },
  { key: 'active', labelKey: 'countries.columns.active', defaultVisible: false, width: 'w-24' },
]

const DEFAULT_VISIBLE_KEYS = AVAILABLE_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key).join(',')

const CONTINENT_NAMES: Record<string, string> = {
  AF: 'Africa',
  AN: 'Antarctica',
  AS: 'Asia',
  EU: 'Europe',
  NA: 'North America',
  OC: 'Oceania',
  SA: 'South America',
}

interface LanguageOption {
  code: string
  name: string
  [key: string]: unknown
}

interface CurrencyOption {
  code: string
  name: string
  [key: string]: unknown
}

const CENTER_ALIGNED_COLUMNS = new Set<CountryColumnKey>(['alpha2', 'alpha3', 'active'])

export default function CountriesPage() {
  const { t } = useTranslation('common')
  const { getEnglishTooltip } = useEnglishTooltips()
  const { formatLabel } = useButtonEmojiMode()
  const filterBarRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  useSearchFocusShortcut(searchInputRef)

  const [countries, setCountries] = useState<Country[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dataQualityWarning, setDataQualityWarning] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [continentFilter, setContinentFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [sortField, setSortField] = useState<CountryColumnKey | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [languagesByCode, setLanguagesByCode] = useState<Map<string, LanguageOption>>(new Map())
  const [currenciesByCode, setCurrenciesByCode] = useState<Map<string, CurrencyOption>>(new Map())
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [filterBarHeight, setFilterBarHeight] = useState(0)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Preference-backed states
  const expandedWidthPreference = useDeferredBooleanPreference({
    pageKey: 'countries',
    preferenceKey: 'expanded_width',
    defaultValue: true,
  })
  const [storedColumns, setStoredColumns] = useUserPreference('countries', 'visible_columns', DEFAULT_VISIBLE_KEYS)
  const referenceDisplayPreference = useDeferredBooleanPreference({
    pageKey: 'countries',
    preferenceKey: 'display_reference_codes',
    defaultValue: false,
  })

  const visibleColumns = useMemo<Set<CountryColumnKey>>(() => {
    if (!storedColumns) return new Set(AVAILABLE_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key))
    return new Set(storedColumns.split(',').filter(Boolean) as CountryColumnKey[])
  }, [storedColumns])

  // Pending preference state (applies immediately, saves on user confirmation)
  const [localColumns, setLocalColumns] = useState<Set<CountryColumnKey> | null>(null)
  const [showColumnsPrompt, setShowColumnsPrompt] = useState(false)
  // Incrementing this counter resets the 8-second auto-dismiss timer so users
  // always get 8 s from their *last* column change rather than their first.
  const [columnsSaveVersion, setColumnsSaveVersion] = useState(0)
  const pendingColumns = useRef<Set<CountryColumnKey> | null>(null)
  const previousColumns = useRef<string | null>(null)
  const [showColumnsUndoToast, setShowColumnsUndoToast] = useState(false)
  const [columnsUndoVersion, setColumnsUndoVersion] = useState(0)

  const [hasHydrated, setHasHydrated] = useState(false)
  const effectiveExpandedWidth = hasHydrated ? expandedWidthPreference.value : true
  const effectiveVisibleColumns = localColumns ?? visibleColumns
  const showReferenceCodes = referenceDisplayPreference.value

  useEffect(() => {
    setHasHydrated(true)
  }, [])

  const handleSetVisibleColumns = useCallback((next: Set<CountryColumnKey>) => {
    setLocalColumns(next)
    pendingColumns.current = next
    setShowColumnsPrompt(true)
    setColumnsSaveVersion(v => v + 1)
  }, [])

  const handleSaveColumns = useCallback(() => {
    if (pendingColumns.current) {
      previousColumns.current = storedColumns
      setStoredColumns(Array.from(pendingColumns.current).join(','))
      setLocalColumns(null)
      pendingColumns.current = null
    }
    setShowColumnsPrompt(false)
    setShowColumnsUndoToast(true)
    setColumnsUndoVersion(v => v + 1)
  }, [setStoredColumns, storedColumns])

  const handleDismissColumns = useCallback(() => { setShowColumnsPrompt(false) }, [])

  const handleUndoColumns = useCallback(() => {
    if (previousColumns.current !== null) {
      setStoredColumns(previousColumns.current)
      setLocalColumns(null)
      previousColumns.current = null
    }
    setShowColumnsUndoToast(false)
  }, [setStoredColumns])

  const handleUndoDismissColumns = useCallback(() => { setShowColumnsUndoToast(false) }, [])

  // Saves the current effective column selection immediately as the stored default,
  // without requiring a new toast cycle. Column preferences cannot reuse the
  // hook's saveCurrentValue because they are Set-based (serialised as a
  // comma-separated string), not a simple boolean managed by the hook.
  const handleSaveColumnsNow = useCallback(() => {
    setStoredColumns(Array.from(effectiveVisibleColumns).join(','))
    setLocalColumns(null)
    pendingColumns.current = null
    setShowColumnsPrompt(false)
  }, [effectiveVisibleColumns, setStoredColumns])

  const API_BASE_URL = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080')
    : 'http://backend:8080'

  useEffect(() => {
    const rawToken = localStorage.getItem('axiom_token')
    const normalizedToken = rawToken?.replace(/^Bearer\s+/i, '').trim() ?? ''
    setIsLoggedIn(normalizedToken !== '' && normalizedToken !== 'undefined' && normalizedToken !== 'null')
  }, [])

  useEffect(() => {
    if (!regionFilter) {
      return
    }

    const availableRegions = new Set(
      countries
        .filter((country) => !continentFilter || country.continent === continentFilter)
        .map((country) => country.region)
        .filter(Boolean)
    )

    if (!availableRegions.has(regionFilter)) {
      setRegionFilter('')
    }
  }, [continentFilter, countries, regionFilter])

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      if (showColumnSelector) {
        setShowColumnSelector(false)
      }
    }

    window.addEventListener('keydown', handleEscapeKey)
    return () => {
      window.removeEventListener('keydown', handleEscapeKey)
    }
  }, [showColumnSelector])

  const fetchLanguages = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/languages?limit=500&offset=0`, {
        headers: {
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        return
      }

      const data = await response.json()
      const map = new Map<string, LanguageOption>()
      ;(Array.isArray(data) ? data : []).forEach((language: LanguageOption) => {
        const code = String(language?.code || '').trim().toLowerCase()
        if (code) {
          map.set(code, language)
        }
      })
      setLanguagesByCode(map)
    } catch {
      // Non-blocking: languages can still render as codes
    }
  }, [API_BASE_URL])

  const fetchCurrencies = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/currencies`, {
        headers: {
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        return
      }

      const data = await response.json()
      const map = new Map<string, CurrencyOption>()
      ;(Array.isArray(data) ? data : []).forEach((currency: CurrencyOption) => {
        const code = String(currency?.code || '').trim().toUpperCase()
        if (code) {
          map.set(code, currency)
        }
      })
      setCurrenciesByCode(map)
    } catch {
      // Non-blocking: currencies can still render as codes
    }
  }, [API_BASE_URL])

  const fetchCountries = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/countries`, {
        headers: {
          'Accept': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        const normalizedCountries = normalizeCountriesPayload(data)
        const summary = summarizeCountriesDataQuality(data)

        setCountries(normalizedCountries)

        const warningParts: string[] = []
        if (summary.missingPrimaryAlpha2Rows > 0) {
          warningParts.push(`Primary code (alpha2/code) missing in ${summary.missingPrimaryAlpha2Rows} row(s)`)
        }
        if (summary.missingSecondaryAlpha3Rows > 0) {
          warningParts.push(`Secondary code (alpha3) missing in ${summary.missingSecondaryAlpha3Rows} row(s)`)
        }
        setDataQualityWarning(warningParts.length > 0 ? warningParts.join(' • ') : null)

        if (!normalizedCountries || normalizedCountries.length === 0) {
          setError('No countries data available yet. The database may need to be populated with reference data.')
        } else {
          setError(null)
        }
      } else {
        setError(`API returned ${response.status}: ${response.statusText}`)
      }
    } catch (err) {
      console.error('Countries fetch error:', err)
      setError('Unable to connect to backend API. Please ensure the backend service is running at ' + API_BASE_URL)
    } finally {
      setLoading(false)
    }
  }, [API_BASE_URL])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchCountries()
      fetchLanguages()
      fetchCurrencies()
    }
  }, [fetchCountries, fetchLanguages, fetchCurrencies])

  const handleSort = (field: CountryColumnKey) => {
    if (field === 'flag') {
      return
    }

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

  const filteredCountries = countries
    .filter(country =>
      country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      country.alpha2.toLowerCase().includes(searchTerm.toLowerCase()) ||
      country.alpha3.toLowerCase().includes(searchTerm.toLowerCase()) ||
      country.code.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter((country) => !continentFilter || country.continent === continentFilter)
    .filter((country) => !regionFilter || country.region === regionFilter)
    .filter((country) => {
      if (activeFilter === 'all') return true
      if (activeFilter === 'active') return country.active
      return !country.active
    })
    .sort((left, right) => {
      if (!sortField) {
        const defaultNameCompare = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
        if (defaultNameCompare !== 0) {
          return defaultNameCompare
        }

        return left.alpha2.localeCompare(right.alpha2, undefined, { sensitivity: 'base' })
      }

      const normalizeCodeList = (values: string[]) => values.map((value) => String(value || '').trim().toUpperCase()).filter(Boolean)

      const getComparableValue = (country: Country): string | number => {
        switch (sortField) {
          case 'name':
            return country.name || ''
          case 'alpha2':
            return country.alpha2 || ''
          case 'alpha3':
            return country.alpha3 || ''
          case 'numeric_code':
            return country.numeric_code || ''
          case 'native_name':
            return country.native_name || ''
          case 'capital':
            return country.capital || ''
          case 'continent': {
            const normalizedCode = String(country.continent || '').trim().toUpperCase()
            if (showReferenceCodes) {
              return normalizedCode
            }
            return CONTINENT_NAMES[normalizedCode] || normalizedCode
          }
          case 'region':
            return country.region || ''
          case 'phone_codes':
            return country.phone_codes.map((value) => String(value || '').trim()).filter(Boolean).map((value) => (value.startsWith('+') ? value : `+${value}`)).join(', ')
          case 'currency_codes': {
            const normalizedValues = normalizeCodeList(country.currency_codes)
            if (showReferenceCodes) {
              return normalizedValues.join(', ')
            }
            return normalizedValues.map((code) => getCurrencyName(code)).join(', ')
          }
          case 'languages': {
            const normalizedValues = country.languages.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)
            if (showReferenceCodes) {
              return normalizedValues.join(', ')
            }
            return normalizedValues.map((code) => getLanguageName(code)).join(', ')
          }
          case 'active':
            return Number(country.active)
          case 'flag':
          default:
            return country.name || ''
        }
      }

      const leftValue = getComparableValue(left)
      const rightValue = getComparableValue(right)

      let comparison = 0
      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        comparison = leftValue - rightValue
      } else {
        comparison = String(leftValue).localeCompare(String(rightValue), undefined, { sensitivity: 'base', numeric: true })
      }

      if (comparison === 0) {
        comparison = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
      }

      if (comparison === 0) {
        comparison = left.alpha2.localeCompare(right.alpha2, undefined, { sensitivity: 'base' })
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

  const visibleColumnsInOrder = AVAILABLE_COLUMNS.filter((column) => effectiveVisibleColumns.has(column.key))

  const toggleColumn = (columnKey: CountryColumnKey) => {
    const next = new Set(effectiveVisibleColumns)
    if (next.has(columnKey)) {
      next.delete(columnKey)
    } else {
      next.add(columnKey)
    }
    handleSetVisibleColumns(next)
  }

  const getLanguageName = (code: string): string => {
    const normalizedCode = String(code || '').trim().toLowerCase()
    if (!normalizedCode) {
      return code
    }

    const details = languagesByCode.get(normalizedCode)
    const name = String(details?.name || '').trim()
    return name || code
  }

  const getCurrencyName = (code: string): string => {
    const normalizedCode = String(code || '').trim().toUpperCase()
    if (!normalizedCode) {
      return code
    }

    const details = currenciesByCode.get(normalizedCode)
    const name = String(details?.name || '').trim()
    return name || code
  }

  const formatPhoneCodeListValue = (values: string[]): string => {
    if (!values || values.length === 0) return '-'

    const normalizedValues = values
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .map((value) => (value.startsWith('+') ? value : `+${value}`))

    if (normalizedValues.length === 0) return '-'
    return normalizedValues.join(', ')
  }

  const getContinentDisplay = (continentCode: string): string => {
    const normalizedCode = String(continentCode || '').trim().toUpperCase()
    if (!normalizedCode) return '-'
    if (showReferenceCodes) return normalizedCode
    return CONTINENT_NAMES[normalizedCode] || normalizedCode
  }

  const getColumnLabel = (column: ColumnConfig): string => {
    if (column.key === 'continent') {
      return showReferenceCodes ? t('countries.columns.continentCode') : t('countries.columns.continentName')
    }
    if (column.key === 'languages') {
      return showReferenceCodes ? t('countries.columns.languageCodes') : t('countries.columns.languageNames')
    }
    if (column.key === 'currency_codes') {
      return showReferenceCodes ? t('countries.columns.currencyCodes') : t('countries.columns.currencyNames')
    }
    return t(column.labelKey)
  }

  const getColumnLabelTranslationKey = (column: ColumnConfig): string => {
    if (column.key === 'continent') {
      return showReferenceCodes ? 'countries.columns.continentCode' : 'countries.columns.continentName'
    }
    if (column.key === 'languages') {
      return showReferenceCodes ? 'countries.columns.languageCodes' : 'countries.columns.languageNames'
    }
    if (column.key === 'currency_codes') {
      return showReferenceCodes ? 'countries.columns.currencyCodes' : 'countries.columns.currencyNames'
    }
    return column.labelKey
  }

  const continentOptions = Array.from(new Set(countries.map((country) => country.continent).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  const regionOptions = Array.from(
    new Set(
      countries
        .filter((country) => !continentFilter || country.continent === continentFilter)
        .map((country) => country.region)
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b))
  const hasActiveFilters = searchTerm || continentFilter || regionFilter || activeFilter !== 'all'
  const activeFilterTranslationKey = activeFilter === 'active' ? 'countries.filters.active' : activeFilter === 'inactive' ? 'countries.filters.inactive' : 'countries.filters.all'

  const clearFilters = () => {
    setSearchTerm('')
    setContinentFilter('')
    setRegionFilter('')
    setActiveFilter('all')
  }

  useEffect(() => {
    if (hasActiveFilters && filterBarRef.current) {
      setFilterBarHeight(filterBarRef.current.offsetHeight)
      return
    }

    setFilterBarHeight(0)
  }, [hasActiveFilters, searchTerm, continentFilter, regionFilter, activeFilter])

  if (loading) {
    return <LoadingSpinner message={t('countries.loading')} />
  }

  const backHref = isLoggedIn ? '/dashboard' : '/home'

  return (
    <div className="min-h-screen p-8 pb-14">
      <div className={`${effectiveExpandedWidth ? 'max-w-full' : 'max-w-7xl'} mx-auto transition-all duration-300`}>
        <PageHeader
          title={t('countries.title')}
          subtitle={t('countries.subtitle')}
          titleTooltip={getEnglishTooltip('countries.title')}
          subtitleTooltip={getEnglishTooltip('countries.subtitle')}
          backHref={backHref}
          docsHref={buildDocsUrl('workflows/countries/')}
          actions={
            <>
              <button
                onClick={expandedWidthPreference.toggle}
                className="theme-header-action rounded-lg theme-btn-neutral theme-focus"
                title={effectiveExpandedWidth ? getEnglishTooltip('referenceLayout.normalButton') : getEnglishTooltip('referenceLayout.expandButton')}
                aria-label={effectiveExpandedWidth ? t('referenceLayout.normalButton') : t('referenceLayout.expandButton')}
              >
                {effectiveExpandedWidth ? formatLabel(t('referenceLayout.normalButton')) : formatLabel(t('referenceLayout.expandButton'))}
              </button>
              {expandedWidthPreference.hasUnsavedChanges && (
                <button
                  onClick={expandedWidthPreference.saveCurrentValue}
                  className="theme-header-action rounded-lg theme-btn-primary theme-focus"
                  title={getEnglishTooltip('referenceLayout.savePageWidthDefault')}
                >
                  {formatLabel('💾 Save width')}
                </button>
              )}
              <button
                onClick={referenceDisplayPreference.toggle}
                className="theme-header-action rounded-lg theme-btn-neutral theme-focus"
                title={showReferenceCodes ? getEnglishTooltip('referenceLayout.displayCodesButton') : getEnglishTooltip('referenceLayout.displayNamesButton')}
                aria-label={showReferenceCodes ? t('referenceLayout.displayCodesButton') : t('referenceLayout.displayNamesButton')}
              >
                {formatLabel(showReferenceCodes ? t('referenceLayout.displayCodesButton') : t('referenceLayout.displayNamesButton'))}
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="theme-header-action rounded-lg theme-btn-neutral theme-focus"
                >
                  {formatLabel(t('countries.actions.columns', { count: effectiveVisibleColumns.size }))}
                </button>

                {showColumnSelector && (
                  <div className="absolute right-0 mt-2 w-72 max-h-96 overflow-y-auto theme-dropdown theme-scrollbar border-2 rounded-lg shadow-xl z-50 p-3">
                    <div className="mb-3 flex items-start justify-between gap-2 text-xs">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleSetVisibleColumns(new Set(AVAILABLE_COLUMNS.map((column) => column.key)))}
                          className="px-2 py-1 rounded theme-filterchip"
                        >
                          {t('countries.actions.selectAll')}
                        </button>
                        <button
                          onClick={() => handleSetVisibleColumns(new Set(AVAILABLE_COLUMNS.filter((column) => column.defaultVisible).map((column) => column.key)))}
                          className="px-2 py-1 rounded theme-filterchip"
                        >
                          {t('countries.actions.reset')}
                        </button>
                      </div>
                      {localColumns !== null && (
                        <button
                          onClick={handleSaveColumnsNow}
                          className="shrink-0 whitespace-nowrap px-2 py-1 rounded theme-btn-primary theme-focus"
                          title={getEnglishTooltip('countries.actions.saveAsDefault')}
                        >
                          <span aria-hidden="true">💾 </span>
                          {t('countries.actions.saveAsDefault')}
                        </button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {AVAILABLE_COLUMNS.map((column) => (
                        <label
                          key={column.key}
                          className="flex items-center gap-2 px-2 py-1.5 theme-table-row-hover transition-colors rounded cursor-pointer text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={effectiveVisibleColumns.has(column.key)}
                            onChange={() => toggleColumn(column.key)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span title={getEnglishTooltip(getColumnLabelTranslationKey(column))}>{getColumnLabel(column)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          }
        />

        {error && (
          <Alert
            variant={error.includes('No countries data') ? 'warning' : 'error'}
            title={error.includes('No countries data') ? t('countries.noticeTitle') : t('countries.errorTitle')}
            className="mb-6"
          >
            {error}
            {error.includes('No countries data') && (
              <p className="text-sm mt-2 opacity-80">
                {t('countries.noDataTip')}
              </p>
            )}
          </Alert>
        )}

        {dataQualityWarning && (
          <Alert variant="warning" title={t('countries.dataQualityTitle')} className="mb-6">
            {dataQualityWarning}
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard title={t('countries.stats.totalCountries')} titleTooltip={getEnglishTooltip('countries.stats.totalCountries')} value={countries.length} />
          <StatCard title={t('countries.stats.filteredResults')} titleTooltip={getEnglishTooltip('countries.stats.filteredResults')} value={filteredCountries.length} />
          <StatCard title={t('countries.stats.dataStandard')} titleTooltip={getEnglishTooltip('countries.stats.dataStandard')} value={t('countries.stats.iso3166')} />
        </div>

        <div className="mb-6 theme-panel border-2 backdrop-blur-sm rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2 theme-text-muted">{t('countries.filters.search')}</label>
              <SearchInputWithOverflowTooltip
                ref={searchInputRef}
                type="text"
                placeholder={t('countries.searchPlaceholder')}
                title={getEnglishTooltip('countries.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg theme-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 theme-text-muted">{t('countries.filters.continent')}</label>
              <ThemedSelect
                value={continentFilter}
                onChange={setContinentFilter}
                ariaLabel={t('countries.filters.continent')}
                title={continentFilter || (showReferenceCodes ? getEnglishTooltip('countries.filters.allContinentCodes') : getEnglishTooltip('countries.filters.allContinents'))}
                className="w-full"
                options={[
                  {
                    value: '',
                    label: showReferenceCodes ? t('countries.filters.allContinentCodes') : t('countries.filters.allContinents'),
                    title: showReferenceCodes ? getEnglishTooltip('countries.filters.allContinentCodes') : getEnglishTooltip('countries.filters.allContinents'),
                  },
                  ...continentOptions.map((continent) => ({
                    value: continent,
                    label: getContinentDisplay(continent),
                  })),
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 theme-text-muted">{t('countries.filters.region')}</label>
              <ThemedSelect
                value={regionFilter}
                onChange={setRegionFilter}
                ariaLabel={t('countries.filters.region')}
                title={regionFilter || getEnglishTooltip('countries.filters.allRegions')}
                className="w-full"
                options={[
                  {
                    value: '',
                    label: t('countries.filters.allRegions'),
                    title: getEnglishTooltip('countries.filters.allRegions'),
                  },
                  ...regionOptions.map((region) => ({
                    value: region,
                    label: region,
                  })),
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 theme-text-muted">{t('countries.filters.status')}</label>
              <ThemedSelect
                value={activeFilter}
                onChange={(next) => setActiveFilter(next as 'all' | 'active' | 'inactive')}
                ariaLabel={t('countries.filters.status')}
                title={getEnglishTooltip(activeFilterTranslationKey)}
                className="w-full"
                options={[
                  { value: 'all', label: t('countries.filters.all'), title: getEnglishTooltip('countries.filters.all') },
                  { value: 'active', label: t('countries.filters.active'), title: getEnglishTooltip('countries.filters.active') },
                  { value: 'inactive', label: t('countries.filters.inactive'), title: getEnglishTooltip('countries.filters.inactive') },
                ]}
              />
            </div>
          </div>
          {hasActiveFilters && (
            <div className="flex gap-3">
              <button
                onClick={clearFilters}
                className="px-6 py-2 rounded-lg theme-btn-neutral font-medium shadow-sm"
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
                {continentFilter && (
                  <button
                    onClick={() => setContinentFilter('')}
                    className="px-2 py-1 rounded text-xs font-medium transition-colors theme-filterchip"
                  >
                    {t('countries.filters.continentChip', { value: getContinentDisplay(continentFilter) })}
                  </button>
                )}
                {regionFilter && (
                  <button
                    onClick={() => setRegionFilter('')}
                    className="px-2 py-1 rounded text-xs font-medium transition-colors theme-filterchip"
                    title={getEnglishTooltip('countries.filters.regionChip', { value: regionFilter })}
                  >
                    {t('countries.filters.regionChip', { value: regionFilter })}
                  </button>
                )}
                {activeFilter !== 'all' && (
                  <button
                    onClick={() => setActiveFilter('all')}
                    className="px-2 py-1 rounded text-xs font-medium transition-colors theme-filterchip"
                    title={getEnglishTooltip('countries.filters.statusChip', { value: t(`countries.filters.${activeFilter}`, { lng: 'en' }) })}
                  >
                    {t('countries.filters.statusChip', { value: t(`countries.filters.${activeFilter}`) })}
                  </button>
                )}
              </div>
              <button
                onClick={clearFilters}
                className="px-3 py-1 text-xs rounded-lg transition-colors font-medium shadow-sm theme-filterchip-clear"
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
            dependencyKey={`${effectiveExpandedWidth}-${showReferenceCodes}-${visibleColumnsInOrder.map((column) => column.key).join('|')}-${filteredCountries.length}`}
            headerRow={(
              <tr>
                {visibleColumnsInOrder.map((column) => (
                  <SortableHeaderCell
                    key={column.key}
                    className={`${column.width || 'min-w-32'} px-6 py-3 text-xs font-medium uppercase tracking-wider theme-table-header-cell`}
                    align={CENTER_ALIGNED_COLUMNS.has(column.key) ? 'center' : 'left'}
                    sortable={column.key !== 'flag'}
                    label={<span title={getEnglishTooltip(getColumnLabelTranslationKey(column))}>{getColumnLabel(column)}</span>}
                    onSort={column.key === 'flag' ? undefined : () => handleSort(column.key)}
                    isActiveSort={sortField === column.key}
                    sortDirection={sortDirection}
                  />
                ))}
              </tr>
            )}
            bodyRows={(
              <>
                {filteredCountries.length > 0 ? (
                  filteredCountries.map((country) => (
                    <tr key={country.id} className="theme-table-row-hover transition-colors">
                      {visibleColumnsInOrder.map((column) => {
                        switch (column.key) {
                          case 'flag':
                            return (
                              <td key={column.key} className="px-6 py-4 whitespace-nowrap align-top" title={country.name}>
                                <CountryFlag
                                  countryCode={country.alpha2 || country.code}
                                  title={country.name}
                                  className="h-4 w-6 rounded-sm border border-[rgb(var(--border-rgb))]"
                                />
                              </td>
                            )
                          case 'name':
                            return (
                              <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm font-medium align-top">
                                {country.name}
                              </td>
                            )
                          case 'alpha2':
                            return (
                              <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm theme-text-muted text-center align-top">
                                <Badge variant="blue" mono>{country.alpha2 || '-'}</Badge>
                              </td>
                            )
                          case 'alpha3':
                            return (
                              <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm theme-text-muted text-center align-top">
                                <Badge variant="green" mono>{country.alpha3 || '-'}</Badge>
                              </td>
                            )
                          case 'numeric_code':
                            return (
                              <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm theme-text-muted font-mono align-top">
                                {country.numeric_code || '-'}
                              </td>
                            )
                          case 'native_name':
                            return (
                              <td key={column.key} className="px-6 py-4 text-sm theme-text-muted align-top">
                                {country.native_name || '-'}
                              </td>
                            )
                          case 'capital':
                            return (
                              <td key={column.key} className="px-6 py-4 text-sm theme-text-muted align-top">
                                {country.capital || '-'}
                              </td>
                            )
                          case 'continent':
                            return (
                              <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm theme-text-muted align-top">
                                {getContinentDisplay(country.continent)}
                              </td>
                            )
                          case 'region':
                            return (
                              <td key={column.key} className="px-6 py-4 text-sm theme-text-muted align-top">
                                {country.region || '-'}
                              </td>
                            )
                          case 'phone_codes':
                            return (
                              <td key={column.key} className="px-6 py-4 text-sm theme-text-muted align-top">
                                {formatPhoneCodeListValue(country.phone_codes)}
                              </td>
                            )
                          case 'currency_codes':
                            return (
                              <td key={column.key} className="px-6 py-4 text-sm theme-text-muted whitespace-normal break-words align-top">
                                <ReferenceDetailList
                                  values={country.currency_codes}
                                  normalizeValue={(value) => String(value || '').trim().toUpperCase()}
                                  getDisplayValue={(normalizedValue) => (showReferenceCodes ? normalizedValue : getCurrencyName(normalizedValue))}
                                  getDetails={(normalizedValue) => currenciesByCode.get(normalizedValue)}
                                  preferredOrder={[
                                    'code',
                                    'name',
                                    'symbol',
                                    'symbol_native',
                                    'decimal_digits',
                                    'rounding',
                                    'name_plural',
                                    'active',
                                    'is_alert_cls_allowed',
                                    'is_ofac_sanctioned',
                                  ]}
                                />
                              </td>
                            )
                          case 'languages':
                            return (
                              <td key={column.key} className="px-6 py-4 text-sm theme-text-muted whitespace-normal break-words align-top">
                                <ReferenceDetailList
                                  values={country.languages}
                                  normalizeValue={(value) => String(value || '').trim().toLowerCase()}
                                  getDisplayValue={(normalizedValue) => (showReferenceCodes ? normalizedValue : getLanguageName(normalizedValue))}
                                  getDetails={(normalizedValue) => languagesByCode.get(normalizedValue)}
                                  preferredOrder={['code', 'name', 'native', 'rtl']}
                                />
                              </td>
                            )
                          case 'active':
                            return (
                              <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                {country.active ? <Badge variant="green" shape="pill">{t('countries.filters.active')}</Badge> : <Badge variant="gray" shape="pill">{t('countries.filters.inactive')}</Badge>}
                              </td>
                            )
                          default:
                            return (
                              <td key={column.key} className="px-6 py-4 text-sm theme-text-muted align-top">-
                              </td>
                            )
                        }
                      })}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={visibleColumnsInOrder.length || 1} className="px-6 py-4 text-center text-sm theme-text-muted">
                      {t('countries.emptyWithSearch')}
                    </td>
                  </tr>
                )}
              </>
            )}
          />
        </div>

        <div className="mt-6 text-center text-sm theme-text-muted">
          <p>{t('countries.footer')}</p>
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
        visible={showColumnsPrompt}
        resetKey={columnsSaveVersion}
        onSave={handleSaveColumns}
        onDismiss={handleDismissColumns}
        label={t('countries.prompts.saveColumnsDefault')}
        showUndo={showColumnsUndoToast}
        undoResetKey={columnsUndoVersion}
        onUndo={handleUndoColumns}
        onUndoDismiss={handleUndoDismissColumns}
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
