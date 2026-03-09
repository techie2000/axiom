'use client'

import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import Alert from '../components/Alert'
import Badge from '../components/Badge'
import CountryFlag from '../components/CountryFlag'
import LoadingSpinner from '../components/LoadingSpinner'
import PageHeader from '../components/PageHeader'
import PreferenceSavePrompt from '../components/PreferenceSavePrompt'
import ReferenceDetailList from '../components/ReferenceDetailList'
import SortableHeaderCell from '../components/SortableHeaderCell'
import StatCard from '../components/StatCard'
import SyncedWideTable from '../components/SyncedWideTable'
import { useDeferredBooleanPreference } from '../lib/useDeferredBooleanPreference'
import { useUserPreference } from '../lib/useUserPreference'
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
  label: string
  defaultVisible: boolean
  width?: string
}

const AVAILABLE_COLUMNS: ColumnConfig[] = [
  { key: 'flag', label: 'Flag', defaultVisible: true, width: 'w-20' },
  { key: 'name', label: 'Name', defaultVisible: true, width: 'min-w-56' },
  { key: 'native_name', label: 'Native Name', defaultVisible: false, width: 'min-w-56' },
  { key: 'alpha2', label: 'Alpha-2 (Primary)', defaultVisible: true, width: 'w-32' },
  { key: 'alpha3', label: 'Alpha-3 (Secondary)', defaultVisible: true, width: 'w-36' },
  { key: 'numeric_code', label: 'Numeric', defaultVisible: false, width: 'w-28' },
  { key: 'capital', label: 'Capital', defaultVisible: false, width: 'w-40' },
  { key: 'continent', label: 'Continent', defaultVisible: true, width: 'w-36' },
  { key: 'region', label: 'Region', defaultVisible: true, width: 'w-44' },
  { key: 'languages', label: 'Languages', defaultVisible: false, width: 'min-w-36' },
  { key: 'currency_codes', label: 'Currency Codes', defaultVisible: false, width: 'min-w-36' },
  { key: 'phone_codes', label: 'Phone Codes', defaultVisible: false, width: 'min-w-40' },
  { key: 'active', label: 'Active', defaultVisible: false, width: 'w-24' },
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
  const filterBarRef = useRef<HTMLDivElement>(null)

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

  const effectiveExpandedWidth = expandedWidthPreference.value
  const effectiveVisibleColumns = localColumns ?? visibleColumns
  const showReferenceCodes = referenceDisplayPreference.value

  const handleSetVisibleColumns = useCallback((next: Set<CountryColumnKey>) => {
    setLocalColumns(next)
    pendingColumns.current = next
    setShowColumnsPrompt(true)
    setColumnsSaveVersion(v => v + 1)
  }, [])

  const handleSaveColumns = useCallback(() => {
    if (pendingColumns.current) {
      setStoredColumns(Array.from(pendingColumns.current).join(','))
      setLocalColumns(null)
      pendingColumns.current = null
    }
    setShowColumnsPrompt(false)
  }, [setStoredColumns])

  const handleDismissColumns = useCallback(() => { setShowColumnsPrompt(false) }, [])

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
      return showReferenceCodes ? 'Continent Code' : 'Continent Name'
    }
    if (column.key === 'languages') {
      return showReferenceCodes ? 'Language Codes' : 'Language Names'
    }
    if (column.key === 'currency_codes') {
      return showReferenceCodes ? 'Currency Codes' : 'Currency Names'
    }
    return column.label
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
    return <LoadingSpinner message="Loading countries..." />
  }

  const backHref = isLoggedIn ? '/dashboard' : '/home'
  const backLabel = isLoggedIn ? '← Back to Dashboard' : '← Back to Home'

  return (
    <div className="min-h-screen p-8">
      <div className={`${effectiveExpandedWidth ? 'max-w-full' : 'max-w-7xl'} mx-auto transition-all duration-300`}>
        <PageHeader
          title="Countries"
          subtitle="Browse ISO 3166 country codes and reference data"
          backHref={backHref}
          backLabel={backLabel}
          actions={
            <>
              <button
                onClick={expandedWidthPreference.toggle}
                className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 transition-colors text-white text-sm font-medium"
                title={effectiveExpandedWidth ? 'Normal Width' : 'Expanded Width'}
              >
                {effectiveExpandedWidth ? '⬅️ Normal' : '↔️ Expand'}
              </button>
              <button
                onClick={referenceDisplayPreference.toggle}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors text-white text-sm font-medium"
                title={showReferenceCodes ? 'Display mode: codes' : 'Display mode: names'}
              >
                {showReferenceCodes ? '🏷️ Display: Codes' : '🏷️ Display: Names'}
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors text-white text-sm font-medium"
                >
                  ⚙️ Columns ({effectiveVisibleColumns.size})
                </button>

                {showColumnSelector && (
                  <div className="absolute right-0 mt-2 w-72 max-h-96 overflow-y-auto bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-white/20 rounded-lg shadow-xl z-50 p-3">
                    <div className="flex gap-2 text-xs mb-3">
                      <button
                        onClick={() => handleSetVisibleColumns(new Set(AVAILABLE_COLUMNS.map((column) => column.key)))}
                        className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => handleSetVisibleColumns(new Set(AVAILABLE_COLUMNS.filter((column) => column.defaultVisible).map((column) => column.key)))}
                        className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        Reset
                      </button>
                    </div>
                    <div className="space-y-1">
                      {AVAILABLE_COLUMNS.map((column) => (
                        <label
                          key={column.key}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors rounded cursor-pointer text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={effectiveVisibleColumns.has(column.key)}
                            onChange={() => toggleColumn(column.key)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-gray-900 dark:text-white">{getColumnLabel(column)}</span>
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
            title={error.includes('No countries data') ? '📋 Notice:' : '⚠️ Error:'}
            className="mb-6"
          >
            {error}
            {error.includes('No countries data') && (
              <p className="text-sm mt-2 opacity-80">
                💡 Tip: Countries data is typically loaded during initial system setup. Contact your administrator if this data should be available.
              </p>
            )}
          </Alert>
        )}

        {dataQualityWarning && (
          <Alert variant="warning" title="⚠️ Data Quality:" className="mb-6">
            {dataQualityWarning}
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard title="Total Countries" value={countries.length} />
          <StatCard title="Filtered Results" value={filteredCountries.length} />
          <StatCard title="Data Standard" value="ISO 3166" />
        </div>

        <div className="mb-6 bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Search</label>
              <input
                type="text"
                placeholder="Search by name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-white/5 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Continent</label>
              <select
                value={continentFilter}
                onChange={(e) => setContinentFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="" className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white">{showReferenceCodes ? 'All Continent Codes' : 'All Continents'}</option>
                {continentOptions.map((continent) => (
                  <option key={continent} value={continent} className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white">
                    {getContinentDisplay(continent)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Region</label>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="" className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white">All Regions</option>
                {regionOptions.map((region) => (
                  <option key={region} value={region} className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white">
                    {region}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Status</label>
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value as 'all' | 'active' | 'inactive')}
                className="w-full px-4 py-2 border border-gray-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="all" className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white">All</option>
                <option value="active" className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white">Active</option>
                <option value="inactive" className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white">Inactive</option>
              </select>
            </div>
          </div>
          {hasActiveFilters && (
            <div className="flex gap-3">
              <button
                onClick={clearFilters}
                className="px-6 py-2 rounded-lg bg-white hover:bg-gray-100 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-transparent transition-colors font-medium shadow-sm"
              >
                ✕ Clear Filters
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
                <span className="text-xs font-semibold text-blue-900 dark:text-blue-100">Active Filters:</span>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded text-xs font-medium hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors"
                  >
                    Search: {searchTerm} ✕
                  </button>
                )}
                {continentFilter && (
                  <button
                    onClick={() => setContinentFilter('')}
                    className="px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded text-xs font-medium hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors"
                  >
                    Continent: {getContinentDisplay(continentFilter)} ✕
                  </button>
                )}
                {regionFilter && (
                  <button
                    onClick={() => setRegionFilter('')}
                    className="px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded text-xs font-medium hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors"
                  >
                    Region: {regionFilter} ✕
                  </button>
                )}
                {activeFilter !== 'all' && (
                  <button
                    onClick={() => setActiveFilter('all')}
                    className="px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded text-xs font-medium hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors"
                  >
                    Status: {activeFilter} ✕
                  </button>
                )}
              </div>
              <button
                onClick={clearFilters}
                className="px-3 py-1 text-xs rounded-lg bg-white hover:bg-gray-100 dark:bg-blue-600 dark:hover:bg-blue-700 text-blue-900 dark:text-white border border-blue-300 dark:border-transparent transition-colors font-medium shadow-sm"
              >
                ✕ Clear All
              </button>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-white/5 rounded-lg shadow border-2 border-gray-200 dark:border-white/10">
          <SyncedWideTable
            stickyTopOffset={hasActiveFilters ? filterBarHeight : 0}
            dependencyKey={`${effectiveExpandedWidth}-${showReferenceCodes}-${visibleColumnsInOrder.map((column) => column.key).join('|')}-${filteredCountries.length}`}
            headerRow={(
              <tr>
                {visibleColumnsInOrder.map((column) => (
                  <SortableHeaderCell
                    key={column.key}
                    className={`${column.width || 'min-w-32'} px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800`}
                    align={CENTER_ALIGNED_COLUMNS.has(column.key) ? 'center' : 'left'}
                    sortable={column.key !== 'flag'}
                    label={getColumnLabel(column)}
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
                    <tr key={country.id} className="hover:bg-blue-50 dark:hover:bg-white/10 transition-colors">
                      {visibleColumnsInOrder.map((column) => {
                        switch (column.key) {
                          case 'flag':
                            return (
                              <td key={column.key} className="px-6 py-4 whitespace-nowrap" title={country.name}>
                                <CountryFlag
                                  countryCode={country.alpha2 || country.code}
                                  title={country.name}
                                  className="h-4 w-6 rounded-sm border border-gray-200 dark:border-gray-700"
                                />
                              </td>
                            )
                          case 'name':
                            return (
                              <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                {country.name}
                              </td>
                            )
                          case 'alpha2':
                            return (
                              <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center">
                                <Badge variant="blue" mono>{country.alpha2 || '-'}</Badge>
                              </td>
                            )
                          case 'alpha3':
                            return (
                              <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center">
                                <Badge variant="green" mono>{country.alpha3 || '-'}</Badge>
                              </td>
                            )
                          case 'numeric_code':
                            return (
                              <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                                {country.numeric_code || '-'}
                              </td>
                            )
                          case 'native_name':
                            return (
                              <td key={column.key} className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                {country.native_name || '-'}
                              </td>
                            )
                          case 'capital':
                            return (
                              <td key={column.key} className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                {country.capital || '-'}
                              </td>
                            )
                          case 'continent':
                            return (
                              <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                {getContinentDisplay(country.continent)}
                              </td>
                            )
                          case 'region':
                            return (
                              <td key={column.key} className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                {country.region || '-'}
                              </td>
                            )
                          case 'phone_codes':
                            return (
                              <td key={column.key} className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                {formatPhoneCodeListValue(country.phone_codes)}
                              </td>
                            )
                          case 'currency_codes':
                            return (
                              <td key={column.key} className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
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
                              <td key={column.key} className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
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
                                {country.active ? <Badge variant="green" shape="pill">Active</Badge> : <Badge variant="gray" shape="pill">Inactive</Badge>}
                              </td>
                            )
                          default:
                            return (
                              <td key={column.key} className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">-
                              </td>
                            )
                        }
                      })}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={visibleColumnsInOrder.length || 1} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      No countries found matching your search
                    </td>
                  </tr>
                )}
              </>
            )}
          />
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Data source: ISO 3166 Country Codes • Public reference data</p>
        </div>
      </div>

      <PreferenceSavePrompt
        visible={expandedWidthPreference.showPrompt}
        resetKey={expandedWidthPreference.promptResetKey}
        onSave={expandedWidthPreference.save}
        onDismiss={expandedWidthPreference.dismiss}
        label="Save page width as your default?"
      />
      <PreferenceSavePrompt
        visible={showColumnsPrompt}
        resetKey={columnsSaveVersion}
        onSave={handleSaveColumns}
        onDismiss={handleDismissColumns}
        label="Save column selection as your default?"
      />
      <PreferenceSavePrompt
        visible={referenceDisplayPreference.showPrompt}
        resetKey={referenceDisplayPreference.promptResetKey}
        onSave={referenceDisplayPreference.save}
        onDismiss={referenceDisplayPreference.dismiss}
        label="Save display mode as your default?"
      />
    </div>
  )
}
