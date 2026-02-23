'use client'

import { useEffect, useRef, useState } from 'react'
import Alert from '../components/Alert'
import Badge from '../components/Badge'
import LoadingSpinner from '../components/LoadingSpinner'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import SyncedWideTable from '../components/SyncedWideTable'

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

export default function CurrenciesPage() {
  const filterBarRef = useRef<HTMLDivElement>(null)

  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [complianceFilter, setComplianceFilter] = useState<ComplianceFilter>('all')
  const [showReferenceCodes, setShowReferenceCodes] = useState(false)
  const [expandedWidth, setExpandedWidth] = useState(true)
  const [filterBarHeight, setFilterBarHeight] = useState(0)

  const API_BASE_URL = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080')
    : 'http://backend:8080'

  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchCurrencies()
    }
  }, [])

  const fetchCurrencies = async () => {
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
  }

  const alertClsCount = currencies.filter(c => c.is_alert_cls_allowed).length
  const ofacCount = currencies.filter(c => c.is_ofac_sanctioned).length

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
      const nameCompare = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
      if (nameCompare !== 0) {
        return nameCompare
      }

      return left.code.localeCompare(right.code, undefined, { sensitivity: 'base' })
    })

  const hasActiveFilters = searchTerm || complianceFilter !== 'all'

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
    return <LoadingSpinner message="Loading currencies..." />
  }

  return (
    <div className="min-h-screen p-8">
      <div className={`${expandedWidth ? 'max-w-full' : 'max-w-7xl'} mx-auto transition-all duration-300`}>
        {/* Header */}
        <PageHeader
          title="Currencies"
          subtitle="Browse ISO 4217 currency codes and compliance reference data"
          actions={
            <>
              <button
                onClick={() => setExpandedWidth(!expandedWidth)}
                className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 transition-colors text-white text-sm font-medium"
                title={expandedWidth ? 'Normal Width' : 'Expanded Width'}
              >
                {expandedWidth ? '⬅️ Normal' : '↔️ Expand'}
              </button>
              <button
                onClick={() => setShowReferenceCodes(!showReferenceCodes)}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors text-white text-sm font-medium"
                title={showReferenceCodes ? 'Display mode: codes' : 'Display mode: names'}
              >
                {showReferenceCodes ? '🏷️ Display: Codes' : '🏷️ Display: Names'}
              </button>
            </>
          }
        />

        {/* Info/Error Alert */}
        {error && (
          <Alert
            variant={error.includes('No currencies data') ? 'warning' : 'error'}
            title={error.includes('No currencies data') ? '📋 Notice:' : '⚠️ Error:'}
            className="mb-6"
          >
            {error}
            {error.includes('No currencies data') && (
              <p className="text-sm mt-2 opacity-80">
                💡 Tip: Currencies data is typically loaded during initial system setup. Contact your administrator if this data should be available.
              </p>
            )}
          </Alert>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard title="Total Currencies" value={currencies.length} />
          <StatCard title="Filtered Results" value={filteredCurrencies.length} />
          <StatCard title="ALERT CLS Allowed" value={alertClsCount} accent="green" />
          <StatCard title="OFAC Sanctioned" value={ofacCount} accent="red" />
        </div>

        {/* Search and compliance filter */}
        <div className="mb-6 bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg p-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            placeholder="Search by name, code, or symbol..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-white/5 text-gray-900 dark:text-white"
          />
          <select
            value={complianceFilter}
            onChange={(e) => setComplianceFilter(e.target.value as ComplianceFilter)}
            className="px-4 py-2 border border-gray-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="all">All Currencies</option>
            <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="alert_cls">ALERT CLS Allowed</option>
            <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="ofac">OFAC Sanctioned</option>
          </select>
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
                {complianceFilter !== 'all' && (
                  <button
                    onClick={() => setComplianceFilter('all')}
                    className="px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded text-xs font-medium hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors"
                  >
                    Compliance: {complianceFilter === 'alert_cls' ? 'ALERT CLS Allowed' : 'OFAC Sanctioned'} ✕
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

        {/* Currencies Table */}
        <div className="bg-white dark:bg-white/5 rounded-lg shadow border-2 border-gray-200 dark:border-white/10">
          <SyncedWideTable
            stickyTopOffset={hasActiveFilters ? filterBarHeight : 0}
            dependencyKey={`${expandedWidth}-${showReferenceCodes}-${filteredCurrencies.length}-${complianceFilter}-${searchTerm}`}
            headerRow={(
              <tr>
                <th className="w-64 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {showReferenceCodes ? 'Code' : 'Name'}
                </th>
                <th className="w-24 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {showReferenceCodes ? 'Name' : 'Code'}
                </th>
                <th className="w-44 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Symbol
                </th>
                <th className="w-28 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Decimals
                </th>
                <th className="w-36 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  ALERT CLS
                </th>
                <th className="w-40 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  OFAC
                </th>
              </tr>
            )}
            bodyRows={(
              <>
                {filteredCurrencies.length > 0 ? (
                  filteredCurrencies.map((currency) => (
                    <tr key={currency.id} className="hover:bg-blue-50 dark:hover:bg-white/10 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {showReferenceCodes ? (
                          <Badge variant="blue" mono>{currency.code}</Badge>
                        ) : (
                          <>
                            {currency.name}
                            {currency.name_plural && currency.name_plural !== currency.name && (
                              <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">
                                ({currency.name_plural})
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {showReferenceCodes ? (
                          <>
                            <span className="text-gray-900 dark:text-white">{currency.name}</span>
                            {currency.name_plural && currency.name_plural !== currency.name && (
                              <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">
                                ({currency.name_plural})
                              </span>
                            )}
                          </>
                        ) : (
                          <Badge variant="blue" mono>{currency.code}</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <span className="text-lg">{currency.symbol}</span>
                        {currency.symbol_native && currency.symbol_native !== currency.symbol && (
                          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{currency.symbol_native}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono text-center">
                        {currency.decimal_digits}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {currency.is_alert_cls_allowed ? (
                          <Badge variant="green" shape="pill">✓ Allowed</Badge>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {currency.is_ofac_sanctioned ? (
                          <Badge variant="red" shape="pill">⚠ Sanctioned</Badge>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      No currencies found matching your search
                    </td>
                  </tr>
                )}
              </>
            )}
          />
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Data source: ISO 4217 Currency Codes • ALERT CLS permitted currencies • OFAC sanctions list</p>
        </div>
      </div>
    </div>
  )
}
