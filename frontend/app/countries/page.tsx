'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ThemeToggle from '../components/ThemeToggle'
import CountryFlag from '../components/CountryFlag'
import SearchInputWithOverflowTooltip from '../components/SearchInputWithOverflowTooltip'

interface Country {
  id: string
  code: string
  name: string
  native_name?: string
  alpha3_code?: string
  numeric_code?: string
  numeric?: string
  phone_codes?: string
  continent?: string
  capital?: string
  languages?: string
  region?: string
}

interface LanguageOption {
  code: string
  name: string
}

type CountryColumnKey =
  | 'name'
  | 'flag'
  | 'code'
  | 'alpha3_code'
  | 'continent'
  | 'region'
  | 'capital'
  | 'phone_codes'
  | 'languages'

interface CountryColumnConfig {
  key: CountryColumnKey
  label: string
  defaultVisible: boolean
}

const COUNTRY_COLUMNS: CountryColumnConfig[] = [
  { key: 'name', label: 'Name (Native Name)', defaultVisible: true },
  { key: 'flag', label: 'Flag', defaultVisible: false },
  { key: 'code', label: 'Alpha-2', defaultVisible: true },
  { key: 'alpha3_code', label: 'Alpha-3', defaultVisible: true },
  { key: 'continent', label: 'Continent', defaultVisible: true },
  { key: 'region', label: 'Region', defaultVisible: true },
  { key: 'capital', label: 'Capital', defaultVisible: false },
  { key: 'phone_codes', label: 'International Dialling', defaultVisible: false },
  { key: 'languages', label: 'Languages', defaultVisible: false },
]

const CONTINENT_LABELS: Record<string, string> = {
  AF: 'Africa',
  AN: 'Antarctica',
  AS: 'Asia',
  EU: 'Europe',
  NA: 'North America',
  OC: 'Oceania',
  SA: 'South America',
}

export default function CountriesPage() {
  const [countries, setCountries] = useState<Country[]>([])
  const [languageMap, setLanguageMap] = useState<Record<string, string>>({})
  const [languageMapLoadAttempted, setLanguageMapLoadAttempted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [continentFilter, setContinentFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [expandedWidth, setExpandedWidth] = useState(false)
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Set<CountryColumnKey>>(
    new Set<CountryColumnKey>(COUNTRY_COLUMNS.filter((column) => column.defaultVisible).map((column) => column.key))
  )

  const API_BASE_URL = typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080')
    : 'http://backend:8080'

  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchCountries()
    }
  }, [])

  useEffect(() => {
    if (!regionFilter) {
      return
    }

    const regionStillValid = countries.some((country) => {
      const matchesContinent = !continentFilter || normalize(country.continent) === normalize(continentFilter)
      return matchesContinent && normalize(country.region) === normalize(regionFilter)
    })

    if (!regionStillValid) {
      setRegionFilter('')
    }
  }, [continentFilter, regionFilter, countries])

  const fetchCountries = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/countries`, {
        headers: {
          'Accept': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Countries API response:', data)
        const sortedCountries = Array.isArray(data)
          ? [...data].sort((a, b) => (a?.name || '').localeCompare(b?.name || ''))
          : []
        setCountries(sortedCountries)
        if (!data || data.length === 0) {
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
  }

  const fetchLanguages = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/languages`, {
        headers: {
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        return
      }

      const data: LanguageOption[] = await response.json()
      const byCode = (Array.isArray(data) ? data : []).reduce<Record<string, string>>((acc, item) => {
        if (item?.code && item?.name) {
          acc[item.code.toLowerCase()] = item.name
        }
        return acc
      }, {})
      setLanguageMap(byCode)
    } catch {
      setLanguageMap({})
    }
  }

  const normalize = (value: string | undefined | null) => (value || '').toLowerCase()

  const filteredCountries = countries.filter((country) => {
    const matchesSearch =
      normalize(country.name).includes(normalize(searchTerm)) ||
      normalize(country.native_name).includes(normalize(searchTerm)) ||
      normalize(country.code).includes(normalize(searchTerm)) ||
      normalize(country.alpha3_code).includes(normalize(searchTerm))

    const matchesContinent = !continentFilter || normalize(country.continent) === normalize(continentFilter)
    const matchesRegion = !regionFilter || normalize(country.region) === normalize(regionFilter)

    return matchesSearch && matchesContinent && matchesRegion
  })

  const parseDelimitedList = (value: string): string[] => {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }

  const parseList = (value?: string): string[] => {
    const raw = (value || '').trim()
    if (!raw) {
      return []
    }

    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0)
      }

      if (typeof parsed === 'string') {
        return parseDelimitedList(parsed)
      }

      return []
    } catch {
      return parseDelimitedList(raw)
    }
  }

  const formatInternationalDialling = (value?: string, empty = '—') => {
    const items = parseList(value)
    if (items.length === 0) {
      return empty
    }

    return items
      .map((item) => item.replace(/^\++/, ''))
      .filter((item) => item.length > 0)
      .map((item) => `+${item}`)
      .join(', ')
  }

  const formatContinent = (continentCode?: string) => {
    const code = (continentCode || '').trim().toUpperCase()
    if (!code) {
      return '—'
    }

    const continentName = CONTINENT_LABELS[code]
    return continentName ? `${continentName} (${code})` : code
  }

  const resolveLanguageName = (code: string): string | null => {
    const normalized = code.trim().toLowerCase()
    if (!normalized) {
      return null
    }

    const mappedName = languageMap[normalized]
    if (mappedName) {
      return mappedName
    }

    try {
      const displayNames = new Intl.DisplayNames(['en'], { type: 'language' })
      const resolved = displayNames.of(normalized)
      if (resolved && resolved.toLowerCase() !== normalized) {
        return resolved
      }
    } catch {
      return null
    }

    if (normalized.length === 3) {
      try {
        const displayNames = new Intl.DisplayNames(['en'], { type: 'language' })
        const fallbackTwoLetter = displayNames.of(normalized.slice(0, 2))
        if (fallbackTwoLetter && fallbackTwoLetter.toLowerCase() !== normalized.slice(0, 2)) {
          return fallbackTwoLetter
        }
      } catch {
        return null
      }
    }

    return null
  }

  const formatLanguages = (value?: string, empty = '—') => {
    const codes = parseList(value)
    if (codes.length === 0) {
      return empty
    }

    return codes
      .map((code) => {
        const languageCode = code.trim().toUpperCase()
        const name = resolveLanguageName(code)
        return name ? `${languageCode} (${name})` : languageCode
      })
      .join(', ')
  }

  const ensureLanguagesLoaded = () => {
    if (languageMapLoadAttempted) {
      return
    }

    setLanguageMapLoadAttempted(true)
    fetchLanguages()
  }

  const toggleColumn = (column: CountryColumnKey) => {
    setVisibleColumns((current) => {
      const next = new Set(current)
      if (next.has(column)) {
        next.delete(column)
      } else {
        next.add(column)
        if (column === 'languages') {
          ensureLanguagesLoaded()
        }
      }
      return next
    })
  }

  const tableColSpan = visibleColumns.size
  const hasActiveFilters = Boolean(searchTerm || continentFilter || regionFilter)
  const continentOptions = Array.from(
    new Set(
      countries
        .map((country) => (country.continent || '').trim().toUpperCase())
        .filter((continent) => continent.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b))

  const regionOptions = Array.from(
    new Set(
      countries
        .filter((country) => !continentFilter || normalize(country.continent) === normalize(continentFilter))
        .map((country) => (country.region || '').trim())
        .filter((region) => region.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b))

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 opacity-70">Loading countries...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className={`${expandedWidth ? 'max-w-full' : 'max-w-7xl'} mx-auto transition-all duration-300`}>
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 inline-block">
              ← Back to Home
            </Link>
            <h1 className="text-4xl font-bold mb-2">Countries</h1>
            <p className="opacity-70">Browse ISO 3166 country codes and reference data</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setExpandedWidth(!expandedWidth)}
              className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 transition-colors text-white text-sm font-medium"
              title={expandedWidth ? 'Normal Width' : 'Expanded Width'}
            >
              {expandedWidth ? '⬅️ Normal' : '↔️ Expand'}
            </button>

            <div className="relative">
              <button
                onClick={() => setShowColumnSelector(!showColumnSelector)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors text-white text-sm font-medium"
              >
                ⚙️ Columns ({visibleColumns.size})
              </button>

              {showColumnSelector && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-white/20 rounded-lg shadow-xl z-50">
                  <div className="p-3 border-b border-gray-200 dark:border-white/10">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">Select Columns</h3>
                      <button
                        onClick={() => setShowColumnSelector(false)}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <button
                        onClick={() => {
                          setVisibleColumns(new Set(COUNTRY_COLUMNS.map((column) => column.key)))
                          ensureLanguagesLoaded()
                        }}
                        className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() =>
                          setVisibleColumns(
                            new Set<CountryColumnKey>(
                              COUNTRY_COLUMNS.filter((column) => column.defaultVisible).map((column) => column.key)
                            )
                          )
                        }
                        className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        Reset Default
                      </button>
                    </div>
                  </div>

                  <div className="p-2">
                    {COUNTRY_COLUMNS.map((column) => (
                      <label
                        key={column.key}
                        className="flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={visibleColumns.has(column.key)}
                          onChange={() => toggleColumn(column.key)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{column.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <ThemeToggle />
          </div>
        </div>

        {/* Info/Error Alert */}
        {error && (
          <div className={`mb-6 p-4 rounded-lg border ${
            error.includes('No countries data') 
              ? 'bg-yellow-50 border-yellow-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <p className={error.includes('No countries data') ? 'text-yellow-800' : 'text-red-800'}>
              <span className="font-semibold">
                {error.includes('No countries data') ? '📋 Notice:' : '⚠️ Error:'}
              </span> {error}
            </p>
            {error.includes('No countries data') && (
              <p className="text-sm text-yellow-700 mt-2">
                💡 Tip: Countries data is typically loaded during initial system setup. Contact your administrator if this data should be available.
              </p>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-white/5 rounded-lg shadow p-6 border-2 border-gray-200 dark:border-white/10">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Countries</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{countries.length}</p>
          </div>
          <div className="bg-white dark:bg-white/5 rounded-lg shadow p-6 border-2 border-gray-200 dark:border-white/10">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Filtered Results</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{filteredCountries.length}</p>
          </div>
          <div className="bg-white dark:bg-white/5 rounded-lg shadow p-6 border-2 border-gray-200 dark:border-white/10">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Data Standard</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">ISO 3166</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg p-6">
          <div className={`grid grid-cols-1 ${hasActiveFilters ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-3`}>
            <SearchInputWithOverflowTooltip
              type="text"
              placeholder="Search by name, native name, or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-400"
            />
            <select
              value={continentFilter}
              onChange={(e) => setContinentFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-white/5 text-gray-900 dark:text-white"
            >
              <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="">All Continents</option>
              {continentOptions.map((continentCode) => (
                <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" key={continentCode} value={continentCode}>
                  {formatContinent(continentCode)}
                </option>
              ))}
            </select>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-white/5 text-gray-900 dark:text-white"
            >
              <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="">All Regions</option>
              {regionOptions.map((region) => (
                <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('')
                  setContinentFilter('')
                  setRegionFilter('')
                }}
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Countries Table */}
        <div className="bg-white dark:bg-white/5 rounded-lg shadow overflow-hidden border-2 border-gray-200 dark:border-white/10">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
            <thead className="bg-gray-50 dark:bg-white/5">
              <tr>
                {visibleColumns.has('name') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name (Native Name)
                  </th>
                )}
                {visibleColumns.has('code') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Alpha-2
                  </th>
                )}
                {visibleColumns.has('flag') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Flag
                  </th>
                )}
                {visibleColumns.has('alpha3_code') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Alpha-3
                  </th>
                )}
                {visibleColumns.has('continent') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Continent
                  </th>
                )}
                {visibleColumns.has('region') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Region
                  </th>
                )}
                {visibleColumns.has('capital') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Capital
                  </th>
                )}
                {visibleColumns.has('phone_codes') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    International Dialling
                  </th>
                )}
                {visibleColumns.has('languages') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Languages
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-white/5 divide-y divide-gray-200 dark:divide-white/10">
              {filteredCountries.length > 0 ? (
                filteredCountries.map((country) => (
                  <tr key={country.id} className="hover:bg-gray-50 dark:hover:bg-white/10">
                    {visibleColumns.has('name') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {country.name}
                        {country.native_name && country.native_name !== country.name && (
                          <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">
                            ({country.native_name})
                          </span>
                        )}
                      </td>
                    )}
                    {visibleColumns.has('code') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded font-mono">
                          {country.code || '—'}
                        </span>
                      </td>
                    )}
                    {visibleColumns.has('flag') && (
                      <td className="px-6 py-4 whitespace-nowrap text-2xl text-gray-900 dark:text-white" title={country.code || '—'}>
                        <CountryFlag
                          countryCode={country.code}
                          title={country.code || '—'}
                          className="inline-block h-6 w-6 align-middle"
                        />
                      </td>
                    )}
                    {visibleColumns.has('alpha3_code') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded font-mono">
                          {country.alpha3_code || '—'}
                        </span>
                      </td>
                    )}
                    {visibleColumns.has('continent') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatContinent(country.continent)}
                      </td>
                    )}
                    {visibleColumns.has('region') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {country.region || '—'}
                      </td>
                    )}
                    {visibleColumns.has('capital') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {country.capital || '—'}
                      </td>
                    )}
                    {visibleColumns.has('phone_codes') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                        {formatInternationalDialling(country.phone_codes)}
                      </td>
                    )}
                    {visibleColumns.has('languages') && (
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 font-mono whitespace-normal break-words min-w-[14rem]">
                        {formatLanguages(country.languages)}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={tableColSpan} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    No countries found matching your search
                  </td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Data source: ISO 3166 Country Codes • Public reference data</p>
        </div>
      </div>
    </div>
  )
}
