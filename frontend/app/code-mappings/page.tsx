'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Alert from '../components/Alert'
import Badge from '../components/Badge'
import LoadingSpinner from '../components/LoadingSpinner'
import PageHeader from '../components/PageHeader'
import SearchInputWithOverflowTooltip from '../components/SearchInputWithOverflowTooltip'
import StatCard from '../components/StatCard'
import { useEnglishTooltips } from '../lib/useEnglishTooltips'
import { useSearchFocusShortcut } from '../lib/useSearchFocusShortcut'

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
  const { t } = useTranslation('common')
  const { getEnglishTooltip } = useEnglishTooltips()
  const searchInputRef = useRef<HTMLInputElement>(null)
  useSearchFocusShortcut(searchInputRef)
  const [mappings, setMappings] = useState<CodeMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<'noneConfigured' | 'authRequired' | 'apiError' | 'networkError' | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const API_BASE_URL = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080')
    : 'http://backend:8080'

  const fetchMappings = useCallback(async () => {
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
          setError(t('codeMappings.errors.noneConfigured'))
          setErrorKind('noneConfigured')
        } else {
          setError(null)
          setErrorKind(null)
        }
      } else if (response.status === 401) {
        setError(t('codeMappings.errors.authRequired'))
        setErrorKind('authRequired')
      } else {
        setError(t('codeMappings.errors.apiReturned', { status: response.status, statusText: response.statusText }))
        setErrorKind('apiError')
      }
    } catch (err) {
      console.error('Code mappings fetch error:', err)
      setError(t('codeMappings.errors.unableToConnect', { apiBaseUrl: API_BASE_URL }))
      setErrorKind('networkError')
    } finally {
      setLoading(false)
    }
  }, [API_BASE_URL, t])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchMappings()
    }
  }, [fetchMappings])

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
    return <LoadingSpinner message={t('codeMappings.loading')} />
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <PageHeader
          title={t('codeMappings.title')}
          subtitle={t('codeMappings.subtitle')}
          titleTooltip={getEnglishTooltip('codeMappings.title')}
          subtitleTooltip={getEnglishTooltip('codeMappings.subtitle')}
          backHref="/dashboard"
        />

        {/* Info box explaining the feature */}
        <Alert variant="info" title={t('codeMappings.about.title')} className="mb-6">
          This table maps codes from external systems (e.g., ALERT currency code &quot;SWE&quot;) to standardised
          AXIOM identifiers (e.g., ISO country code &quot;SE&quot;). The combination of{' '}
          <em>from_system</em>, <em>to_system</em>, <em>from_code_type</em>,{' '}
          <em>to_code_type</em>, and <em>from_code</em> must be unique.
        </Alert>

        {/* Error/Notice Alert */}
        {error && (
          <Alert
            variant={errorKind === 'noneConfigured' ? 'warning' : 'error'}
            title={errorKind === 'noneConfigured' ? t('codeMappings.noticeTitle') : t('codeMappings.errorTitle')}
            className="mb-6"
          >
            {error}
          </Alert>
        )}

        {/* Search */}
        <div className="mb-6">
          <SearchInputWithOverflowTooltip
            ref={searchInputRef}
            type="text"
            placeholder={t('codeMappings.searchPlaceholder')}
            title={getEnglishTooltip('codeMappings.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg theme-input"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard title={t('codeMappings.stats.totalMappings')} titleTooltip={getEnglishTooltip('codeMappings.stats.totalMappings')} value={mappings.length} />
          <StatCard title={t('codeMappings.stats.activeMappings')} titleTooltip={getEnglishTooltip('codeMappings.stats.activeMappings')} value={activeMappings.length} accent="green" />
          <StatCard title={t('codeMappings.stats.sourceSystems')} titleTooltip={getEnglishTooltip('codeMappings.stats.sourceSystems')} value={uniqueSystems.length} />
          <StatCard title={t('codeMappings.stats.filteredResults')} titleTooltip={getEnglishTooltip('codeMappings.stats.filteredResults')} value={filteredMappings.length} />
        </div>

        {/* Mappings Table */}
        <div className="theme-table-shell rounded-lg shadow overflow-hidden border-2">
          <div className="overflow-x-auto theme-scrollbar">
            <table className="min-w-full divide-y [--tw-divide-opacity:1] divide-[rgb(var(--border-rgb)/0.7)]">
              <thead className="theme-table-header">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider theme-table-header-cell">
                    <span title={getEnglishTooltip('codeMappings.columns.fromSystem')}>{t('codeMappings.columns.fromSystem')}</span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider theme-table-header-cell">
                    <span title={getEnglishTooltip('codeMappings.columns.fromType')}>{t('codeMappings.columns.fromType')}</span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider theme-table-header-cell">
                    <span title={getEnglishTooltip('codeMappings.columns.fromCode')}>{t('codeMappings.columns.fromCode')}</span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider theme-table-header-cell">
                    <span title={getEnglishTooltip('codeMappings.columns.toSystem')}>{t('codeMappings.columns.toSystem')}</span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider theme-table-header-cell">
                    <span title={getEnglishTooltip('codeMappings.columns.toType')}>{t('codeMappings.columns.toType')}</span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider theme-table-header-cell">
                    <span title={getEnglishTooltip('codeMappings.columns.toCode')}>{t('codeMappings.columns.toCode')}</span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider theme-table-header-cell">
                    <span title={getEnglishTooltip('codeMappings.columns.status')}>{t('codeMappings.columns.status')}</span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider theme-table-header-cell">
                    <span title={getEnglishTooltip('codeMappings.columns.description')}>{t('codeMappings.columns.description')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="theme-table-shell divide-y [--tw-divide-opacity:1] divide-[rgb(var(--border-rgb)/0.7)]">
                {filteredMappings.length > 0 ? (
                  filteredMappings.map((mapping) => (
                    <tr key={mapping.id} className="theme-table-row-hover transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-center">
                        <Badge variant="orange" mono>{mapping.from_system}</Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm theme-text-muted font-mono text-xs">
                        {mapping.from_code_type}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        <Badge variant="red" mono>{mapping.from_code}</Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-center">
                        <Badge variant="blue" mono>{mapping.to_system}</Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm theme-text-muted font-mono text-xs">
                        {mapping.to_code_type}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        <Badge variant="green" mono>{mapping.to_code}</Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        <Badge variant={mapping.active ? 'green' : 'gray'}>
                          <span title={mapping.active ? getEnglishTooltip('codeMappings.status.active') : getEnglishTooltip('codeMappings.status.inactive')}>
                            {mapping.active ? t('codeMappings.status.active') : t('codeMappings.status.inactive')}
                          </span>
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm theme-text-muted max-w-xs truncate">
                        {mapping.description || t('codeMappings.emptyDescription')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 text-center text-sm theme-text-muted">
                      {searchTerm ? t('codeMappings.emptyWithSearch') : t('codeMappings.emptyWithoutSearch')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center text-sm theme-text-muted">
          <p title={getEnglishTooltip('codeMappings.footer.prefix')}>
            {t('codeMappings.footer.prefix')} <code className="font-mono theme-subtle px-1 rounded">
              POST /api/v1/code-mappings
            </code> {t('codeMappings.footer.suffix')}
          </p>
        </div>
      </div>
    </div>
  )
}
