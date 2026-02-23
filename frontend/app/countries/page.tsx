'use client'

import { useEffect, useState } from 'react'
import Alert from '../components/Alert'
import Badge from '../components/Badge'
import LoadingSpinner from '../components/LoadingSpinner'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'

interface Country {
  id: string
  code: string
  name: string
  alpha2: string
  alpha3: string
  numeric_code: string
}

export default function CountriesPage() {
  const [countries, setCountries] = useState<Country[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const API_BASE_URL = typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080')
    : 'http://backend:8080'

  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchCountries()
    }
  }, [])

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
        setCountries(data || [])
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

  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.alpha2.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.alpha3.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return <LoadingSpinner message="Loading countries..." />
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <PageHeader
          title="Countries"
          subtitle="Browse ISO 3166 country codes and reference data"
        />

        {/* Info/Error Alert */}
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

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard title="Total Countries" value={countries.length} />
          <StatCard title="Filtered Results" value={filteredCountries.length} />
          <StatCard title="Data Standard" value="ISO 3166" />
        </div>

        {/* Countries Table */}
        <div className="bg-white dark:bg-white/5 rounded-lg shadow overflow-hidden border-2 border-gray-200 dark:border-white/10">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
            <thead className="bg-gray-50 dark:bg-white/5">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Alpha-2
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Alpha-3
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Numeric
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-white/5 divide-y divide-gray-200 dark:divide-white/10">
              {filteredCountries.length > 0 ? (
                filteredCountries.map((country) => (
                  <tr key={country.id} className="hover:bg-gray-50 dark:hover:bg-white/10">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {country.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <Badge variant="blue" mono>{country.alpha2}</Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <Badge variant="green" mono>{country.alpha3}</Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {country.numeric_code}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    No countries found matching your search
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Data source: ISO 3166 Country Codes • Public reference data</p>
        </div>
      </div>
    </div>
  )
}
