'use client'

import { useEffect, useState } from 'react'
import Alert from '../components/Alert'
import Badge from '../components/Badge'
import LoadingSpinner from '../components/LoadingSpinner'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'

interface Language {
  code: string
  name: string
  native: string
  rtl: boolean
}

type DirectionFilter = 'all' | 'rtl' | 'ltr'

export default function LanguagesPage() {
  const [languages, setLanguages] = useState<Language[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all')
  const [showReferenceCodes, setShowReferenceCodes] = useState(false)

  const API_BASE_URL = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080')
    : 'http://backend:8080'

  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchLanguages()
    }
  }, [])

  const fetchLanguages = async () => {
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
      const primary = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
      if (primary !== 0) {
        return primary
      }
      return left.code.localeCompare(right.code, undefined, { sensitivity: 'base' })
    })

  const rtlCount = languages.filter((language) => language.rtl).length
  const ltrCount = languages.length - rtlCount
  const hasActiveFilters = searchTerm || directionFilter !== 'all'

  const clearFilters = () => {
    setSearchTerm('')
    setDirectionFilter('all')
  }

  if (loading) {
    return <LoadingSpinner message="Loading languages..." />
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Languages"
          subtitle="Browse language reference data and writing direction"
          actions={
            <button
              onClick={() => setShowReferenceCodes(!showReferenceCodes)}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors text-white text-sm font-medium"
              title={showReferenceCodes ? 'Display mode: codes' : 'Display mode: names'}
            >
              {showReferenceCodes ? '🏷️ Display: Codes' : '🏷️ Display: Names'}
            </button>
          }
        />

        {error && (
          <Alert
            variant={error.includes('No languages data') ? 'warning' : 'error'}
            title={error.includes('No languages data') ? '📋 Notice:' : '⚠️ Error:'}
            className="mb-6"
          >
            {error}
          </Alert>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard title="Total Languages" value={languages.length} />
          <StatCard title="Filtered Results" value={filteredLanguages.length} />
          <StatCard title="RTL Languages" value={rtlCount} />
          <StatCard title="LTR Languages" value={ltrCount} />
        </div>

        <div className="mb-6 bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Search</label>
              <input
                type="text"
                placeholder="Search by code, name, or native name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-white/5 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Direction</label>
              <select
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value as DirectionFilter)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="all" className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white">All</option>
                <option value="rtl" className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white">RTL</option>
                <option value="ltr" className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white">LTR</option>
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

        <div className="bg-white dark:bg-white/5 rounded-lg shadow overflow-hidden border-2 border-gray-200 dark:border-white/10">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {showReferenceCodes ? 'Code' : 'Language Name'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {showReferenceCodes ? 'Language Name' : 'Code'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Native Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Direction
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-white/5 divide-y divide-gray-200 dark:divide-white/10">
                {filteredLanguages.length > 0 ? (
                  filteredLanguages.map((language) => (
                    <tr key={language.code} className="hover:bg-gray-50 dark:hover:bg-white/10">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {showReferenceCodes ? (
                          <Badge variant="blue" mono>{language.code}</Badge>
                        ) : (
                          language.name || '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {showReferenceCodes ? (
                          <span className="text-gray-900 dark:text-white">{language.name || '-'}</span>
                        ) : (
                          <Badge variant="blue" mono>{language.code}</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {language.native || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {language.rtl ? (
                          <Badge variant="purple" shape="pill">RTL</Badge>
                        ) : (
                          <Badge variant="gray" shape="pill">LTR</Badge>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      No languages found matching your search
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Data source: Language reference data • ISO language codes</p>
        </div>
      </div>
    </div>
  )
}
