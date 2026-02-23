'use client'

import { useEffect, useState } from 'react'
import Alert from '../components/Alert'
import Badge from '../components/Badge'
import LoadingSpinner from '../components/LoadingSpinner'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'

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
    return <LoadingSpinner message="Loading code mappings..." />
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <PageHeader
          title="Code Mappings"
          subtitle="Cross-system code translation — map external codes (e.g., ALERT) to internal AXIOM identifiers"
        />

        {/* Info box explaining the feature */}
        <Alert variant="info" title="💡 About Code Mappings:" className="mb-6">
          This table maps codes from external systems (e.g., ALERT currency code &quot;SWE&quot;) to standardised
          AXIOM identifiers (e.g., ISO country code &quot;SE&quot;). The combination of{' '}
          <em>from_system</em>, <em>to_system</em>, <em>from_code_type</em>,{' '}
          <em>to_code_type</em>, and <em>from_code</em> must be unique.
        </Alert>

        {/* Error/Notice Alert */}
        {error && (
          <Alert
            variant={error.includes('No code mappings') ? 'warning' : 'error'}
            title={error.includes('No code mappings') ? '📋 Notice:' : '⚠️ Error:'}
            className="mb-6"
          >
            {error}
          </Alert>
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
          <StatCard title="Total Mappings" value={mappings.length} />
          <StatCard title="Active Mappings" value={activeMappings.length} accent="green" />
          <StatCard title="Source Systems" value={uniqueSystems.length} />
          <StatCard title="Filtered Results" value={filteredMappings.length} />
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
                        <Badge variant="orange" mono>{mapping.from_system}</Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono text-xs">
                        {mapping.from_code_type}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        <Badge variant="red" mono>{mapping.from_code}</Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        <Badge variant="blue" mono>{mapping.to_system}</Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono text-xs">
                        {mapping.to_code_type}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        <Badge variant="green" mono>{mapping.to_code}</Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <Badge variant={mapping.active ? 'green' : 'gray'}>
                          {mapping.active ? 'Active' : 'Inactive'}
                        </Badge>
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
