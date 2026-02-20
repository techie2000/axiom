'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ThemeToggle from '../components/ThemeToggle'

interface CodeMapping {
  id: string
  from_system: string
  to_system: string
  from_code_type: string
  to_code_type: string
  from_code: string
  to_code: string
  description: string
  active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export default function CodeMappingsPage() {
  const [mappings, setMappings] = useState<CodeMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const API_BASE_URL = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080')
    : 'http://backend:8080'

  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchMappings()
    }
  }, [])

  const fetchMappings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/code-mappings?limit=100`, {
        headers: {
          'Accept': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setMappings(data || [])
        if (!data || data.length === 0) {
          setError('No code mappings have been configured yet.')
        } else {
          setError(null)
        }
      } else if (response.status === 401) {
        setError('Authentication required. Please log in to view code mappings.')
      } else {
        setError(`API returned ${response.status}: ${response.statusText}`)
      }
    } catch (err) {
      console.error('Code mappings fetch error:', err)
      setError('Unable to connect to backend API. Please ensure the backend service is running at ' + API_BASE_URL)
    } finally {
      setLoading(false)
    }
  }

  const filteredMappings = mappings.filter(m =>
    m.from_system.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.to_system.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.from_code_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.to_code_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.from_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.to_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.description && m.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const activeMappings = mappings.filter(m => m.active)
  const uniqueSystems = [...new Set(mappings.map(m => m.from_system))]

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 opacity-70">Loading code mappings...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 inline-block">
              ← Back to Home
            </Link>
            <h1 className="text-4xl font-bold mb-2">Code Mappings</h1>
            <p className="opacity-70">
              Cross-system code translation — map external codes (e.g., ALERT) to internal AXIOM identifiers
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Info box explaining the feature */}
        <div className="mb-6 p-4 rounded-lg border bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
          <p className="text-blue-800 dark:text-blue-200 text-sm">
            <span className="font-semibold">💡 About Code Mappings:</span> This table maps codes from external systems
            (e.g., ALERT currency code &quot;SWE&quot;) to standardised AXIOM identifiers (e.g., ISO country code
            &quot;SE&quot;). The combination of <em>from_system</em>, <em>to_system</em>, <em>from_code_type</em>,
            <em> to_code_type</em>, and <em>from_code</em> must be unique.
          </p>
        </div>

        {/* Error/Notice Alert */}
        {error && (
          <div className={`mb-6 p-4 rounded-lg border ${
            error.includes('No code mappings')
              ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
              : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
          }`}>
            <p className={
              error.includes('No code mappings')
                ? 'text-yellow-800 dark:text-yellow-200'
                : 'text-red-800 dark:text-red-200'
            }>
              <span className="font-semibold">
                {error.includes('No code mappings') ? '📋 Notice:' : '⚠️ Error:'}
              </span> {error}
            </p>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by system, code type, or code value..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-white/20 rounded-lg
              focus:ring-2 focus:ring-blue-500 focus:border-transparent
              bg-white dark:bg-white/5 text-gray-900 dark:text-white"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-white/5 rounded-lg shadow p-6 border-2 border-gray-200 dark:border-white/10">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Mappings</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{mappings.length}</p>
          </div>
          <div className="bg-white dark:bg-white/5 rounded-lg shadow p-6 border-2 border-gray-200 dark:border-white/10">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Mappings</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{activeMappings.length}</p>
          </div>
          <div className="bg-white dark:bg-white/5 rounded-lg shadow p-6 border-2 border-gray-200 dark:border-white/10">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Source Systems</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{uniqueSystems.length}</p>
          </div>
          <div className="bg-white dark:bg-white/5 rounded-lg shadow p-6 border-2 border-gray-200 dark:border-white/10">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Filtered Results</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{filteredMappings.length}</p>
          </div>
        </div>

        {/* Mappings Table */}
        <div className="bg-white dark:bg-white/5 rounded-lg shadow overflow-hidden border-2 border-gray-200 dark:border-white/10">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    From System
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    From Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    From Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    To System
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    To Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    To Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-white/5 divide-y divide-gray-200 dark:divide-white/10">
                {filteredMappings.length > 0 ? (
                  filteredMappings.map((mapping) => (
                    <tr key={mapping.id} className="hover:bg-gray-50 dark:hover:bg-white/10">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 rounded font-mono text-xs">
                          {mapping.from_system}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono text-xs">
                        {mapping.from_code_type}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        <span className="px-2 py-1 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 rounded font-mono text-xs font-semibold">
                          {mapping.from_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded font-mono text-xs">
                          {mapping.to_system}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono text-xs">
                        {mapping.to_code_type}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 rounded font-mono text-xs font-semibold">
                          {mapping.to_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {mapping.active ? (
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                        {mapping.description || '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      {searchTerm ? 'No mappings found matching your search' : 'No code mappings configured yet'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Code mappings are managed via the API. Use <code className="font-mono bg-gray-100 dark:bg-white/10 px-1 rounded">
              POST /api/v1/code-mappings
            </code> to create new mappings.
          </p>
        </div>
      </div>
    </div>
  )
}
