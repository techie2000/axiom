'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import ThemeToggle from '../components/ThemeToggle'

interface LEIRecord {
  id: string
  lei: string
  legal_name: string
  transliterated_legal_name: string
  other_names: string
  entity_status: string
  entity_category: string
  entity_sub_category: string
  entity_legal_form: string
  
  // Legal Address
  legal_address_line_1: string
  legal_address_line_2: string
  legal_address_line_3: string
  legal_address_line_4: string
  legal_address_city: string
  legal_address_region: string
  legal_address_country: string
  legal_address_postal_code: string
  
  // HQ Address
  hq_address_line_1: string
  hq_address_line_2: string
  hq_address_line_3: string
  hq_address_line_4: string
  hq_address_city: string
  hq_address_region: string
  hq_address_country: string
  hq_address_postal_code: string
  
  // Registration
  registration_authority: string
  registration_authority_id: string
  registration_number: string
  
  // Associated Entities
  managing_lou: string
  successor_lei: string
  
  // Dates
  registration_date: string
  initial_registration_date: string
  last_update_date: string
  next_renewal_date: string
  
  // Validation
  validation_sources: string
  validation_authority: string
}

interface Country {
  code: string
  name: string
  active: boolean
}

interface ColumnConfig {
  key: keyof LEIRecord
  label: string
  group: string
  defaultVisible: boolean
  width?: string
}

const AVAILABLE_COLUMNS: ColumnConfig[] = [
  // Core fields
  { key: 'lei', label: 'LEI', group: 'Core', defaultVisible: true, width: 'w-44' },
  { key: 'legal_name', label: 'Legal Name', group: 'Core', defaultVisible: true, width: 'min-w-64' },
  { key: 'entity_status', label: 'Status', group: 'Core', defaultVisible: true, width: 'w-32' },
  { key: 'entity_category', label: 'Category', group: 'Core', defaultVisible: true, width: 'w-40' },
  { key: 'legal_address_country', label: 'Country', group: 'Core', defaultVisible: true, width: 'w-24' },
  { key: 'last_update_date', label: 'Last Updated', group: 'Core', defaultVisible: true, width: 'w-32' },
  
  // Additional Entity Info
  { key: 'transliterated_legal_name', label: 'Transliterated Name', group: 'Entity', defaultVisible: false, width: 'min-w-64' },
  { key: 'entity_sub_category', label: 'Sub Category', group: 'Entity', defaultVisible: false, width: 'w-40' },
  { key: 'entity_legal_form', label: 'Legal Form', group: 'Entity', defaultVisible: false, width: 'w-40' },
  
  // Legal Address
  { key: 'legal_address_city', label: 'City', group: 'Legal Address', defaultVisible: false, width: 'w-40' },
  { key: 'legal_address_region', label: 'Region', group: 'Legal Address', defaultVisible: false, width: 'w-32' },
  { key: 'legal_address_postal_code', label: 'Postal Code', group: 'Legal Address', defaultVisible: false, width: 'w-28' },
  { key: 'legal_address_line_1', label: 'Address Line 1', group: 'Legal Address', defaultVisible: false, width: 'min-w-48' },
  
  // HQ Address
  { key: 'hq_address_city', label: 'HQ City', group: 'HQ Address', defaultVisible: false, width: 'w-40' },
  { key: 'hq_address_country', label: 'HQ Country', group: 'HQ Address', defaultVisible: false, width: 'w-24' },
  { key: 'hq_address_region', label: 'HQ Region', group: 'HQ Address', defaultVisible: false, width: 'w-32' },
  
  // Registration
  { key: 'registration_authority', label: 'Registration Authority', group: 'Registration', defaultVisible: false, width: 'w-48' },
  { key: 'registration_number', label: 'Registration Number', group: 'Registration', defaultVisible: false, width: 'w-40' },
  { key: 'initial_registration_date', label: 'Initial Registration', group: 'Registration', defaultVisible: false, width: 'w-36' },
  { key: 'next_renewal_date', label: 'Next Renewal', group: 'Registration', defaultVisible: false, width: 'w-32' },
  
  // Associated Entities
  { key: 'managing_lou', label: 'Managing LOU', group: 'Associated', defaultVisible: false, width: 'w-40' },
  { key: 'successor_lei', label: 'Successor LEI', group: 'Associated', defaultVisible: false, width: 'w-44' },
  
  // Validation
  { key: 'validation_authority', label: 'Validation Authority', group: 'Validation', defaultVisible: false, width: 'w-40' },
]

export default function LEIRecordsPage() {
  const [records, setRecords] = useState<LEIRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [countrySearch, setCountrySearch] = useState('')
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [countryOptions, setCountryOptions] = useState<Country[]>([])
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [hasMorePages, setHasMorePages] = useState(false)
  const [sortField, setSortField] = useState<keyof LEIRecord | ''>('')  // Empty: let backend decide (Hybrid Approach)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [filterBarHeight, setFilterBarHeight] = useState(0)
  const countryDropdownRef = useRef<HTMLDivElement>(null)
  const filterBarRef = useRef<HTMLDivElement>(null)
  
  // New features
  const [visibleColumns, setVisibleColumns] = useState<Set<keyof LEIRecord>>(
    new Set(AVAILABLE_COLUMNS.filter(col => col.defaultVisible).map(col => col.key))
  )
  const [expandedWidth, setExpandedWidth] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<LEIRecord | null>(null)
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [managingLouName, setManagingLouName] = useState<string | null>(null)
  const [dateDisplayMode, setDateDisplayMode] = useState<'relative' | 'absolute'>('relative')

  const API_BASE_URL = typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080')
    : 'http://backend:8080'

  const statusOptions = ['ACTIVE', 'INACTIVE', 'LAPSED', 'MERGED', 'RETIRED', 'NULL']
  const categoryOptions = ['GENERAL', 'FUND', 'BRANCH', 'SOLE_PROPRIETOR', 'INTERNATIONAL_BRANCH']

  // Fetch countries list on mount
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/lei-countries`)
        if (response.ok) {
          const data: Country[] = await response.json()
          // Sort by country name
          const sortedCountries = (data || []).sort((a, b) => a.name.localeCompare(b.name))
          setCountryOptions(sortedCountries)
        }
      } catch (err) {
        console.error('Failed to fetch countries:', err)
      }
    }
    fetchCountries()
  }, [])

  // Fetch total records count from API
  useEffect(() => {
    const fetchTotalRecords = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/lei/status/DAILY_FULL`, { cache: 'no-store' })
        if (response.ok) {
          const data = await response.json()
          setTotalRecords(data.current_source_file?.total_records || 0)
        }
      } catch (err) {
        console.error('Failed to fetch total records:', err)
      }
    }
    fetchTotalRecords()
    // Refresh every 30 seconds to get live updates during sync
    const interval = setInterval(fetchTotalRecords, 30000)
    return () => clearInterval(interval)
  }, [API_BASE_URL])

  // Debug logging for records array
  useEffect(() => {
    if (debouncedSearch?.toLowerCase().includes('bgc')) {
      console.log('=== DEBUG: Records State ===')
      console.log('Total records:', records.length)
      console.log('Records array:', records.map(r => ({ 
        id: r?.id, 
        lei: r?.lei, 
        name: r?.legal_name 
      })))
      console.log('After filter (r && r.id):', records.filter(r => r && r.id).map(r => ({ 
        id: r.id, 
        lei: r.lei, 
        name: r.legal_name 
      })))
      console.log('===========================')
    }
  }, [records, debouncedSearch])

  // Close country dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setShowCountryDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close popups with Escape key
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Close in priority order: modal -> column selector -> country dropdown
        if (selectedRecord) {
          setSelectedRecord(null)
        } else if (showColumnSelector) {
          setShowColumnSelector(false)
        } else if (showCountryDropdown) {
          setShowCountryDropdown(false)
        }
      }
    }
    document.addEventListener('keydown', handleEscapeKey)
    return () => document.removeEventListener('keydown', handleEscapeKey)
  }, [selectedRecord, showColumnSelector, showCountryDropdown])

  // Debounce search input (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setCurrentPage(1) // Reset to page 1 when search changes
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch records when filters, page, or visible columns change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchRecords()
    }
  }, [currentPage, debouncedSearch, statusFilter, categoryFilter, countryFilter, itemsPerPage, sortField, sortDirection, visibleColumns])

  const fetchRecords = async () => {
    try {
      setLoading(true)
      const offset = (currentPage - 1) * itemsPerPage
      
      // Request one extra record to detect if there are more pages
      const params = new URLSearchParams({
        limit: (itemsPerPage + 1).toString(),
        offset: offset.toString(),
      })
      
      if (debouncedSearch) params.append('search', debouncedSearch)
      if (statusFilter) params.append('status', statusFilter)
      if (categoryFilter) params.append('category', categoryFilter)
      if (countryFilter) params.append('country', countryFilter)
      if (sortField) params.append('sortBy', sortField)
      if (sortDirection) params.append('sortOrder', sortDirection)
      
      // Send visible columns for dynamic SELECT optimization
      // Backend will fetch only the columns requested
      const columnsToFetch = Array.from(visibleColumns).join(',')
      if (columnsToFetch) params.append('columns', columnsToFetch)

      const response = await fetch(
        `${API_BASE_URL}/api/v1/lei?${params.toString()}`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        // If we got more than requested, there are more pages - only show the requested amount
        const hasMorePages = data && data.length > itemsPerPage
        const displayData = hasMorePages ? data.slice(0, itemsPerPage) : (data || [])
        
        setRecords(displayData)
        setHasMorePages(hasMorePages)
        
        if (!displayData || displayData.length === 0) {
          setError('No LEI data matches the selected filters.')
        } else {
          setError(null)
        }
      } else {
        setError(`API returned ${response.status}: ${response.statusText}`)
      }
    } catch (err) {
      console.error('LEI Records fetch error:', err)
      setError('Unable to connect to backend API.')
    } finally {
      setLoading(false)
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('')
    setCategoryFilter('')
    setCountryFilter('')
    setCountrySearch('')
    setCurrentPage(1)
  }

  const handleSort = (field: keyof LEIRecord) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

  const toggleColumn = (columnKey: keyof LEIRecord) => {
    const newColumns = new Set(visibleColumns)
    if (newColumns.has(columnKey)) {
      newColumns.delete(columnKey)
    } else {
      newColumns.add(columnKey)
    }
    setVisibleColumns(newColumns)
  }

  // Calculate relative time from a date
  const getRelativeTime = (dateString: string): { days: number, relative: string } => {
    if (!dateString || dateString === '0001-01-01T00:00:00Z') {
      return { days: 0, relative: '-' }
    }
    
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
    const absDays = Math.abs(diffDays)
    
    let relative: string
    if (absDays === 0) {
      relative = 'today'
    } else if (absDays === 1) {
      relative = diffDays < 0 ? '1 day ago' : 'in 1 day'
    } else if (absDays < 7) {
      relative = diffDays < 0 ? `${absDays} days ago` : `in ${absDays} days`
    } else if (absDays < 30) {
      const weeks = Math.round(absDays / 7)
      relative = diffDays < 0 
        ? `${weeks} week${weeks > 1 ? 's' : ''} ago` 
        : `in ${weeks} week${weeks > 1 ? 's' : ''}`
    } else if (absDays < 365) {
      const months = Math.round(absDays / 30)
      relative = diffDays < 0 
        ? `${months} month${months > 1 ? 's' : ''} ago` 
        : `in ${months} month${months > 1 ? 's' : ''}`
    } else {
      const years = Math.round(absDays / 365)
      relative = diffDays < 0 
        ? `${years} year${years > 1 ? 's' : ''} ago` 
        : `in ${years} year${years > 1 ? 's' : ''}`
    }
    
    return { days: diffDays, relative }
  }

  // Build OpenStreetMap URL from address components
  const buildMapUrl = (address: {
    line1?: string
    line2?: string
    line3?: string
    line4?: string
    city?: string
    region?: string
    country?: string
    postalCode?: string
  }) => {
    const parts = [
      address.line1,
      address.line2,
      address.line3,
      address.line4,
      address.city,
      address.postalCode
    ].filter(Boolean)
    
    const query = parts.join(', ')
    return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`
  }

  // Handler to fetch complete record for detail view
  const handleRecordClick = async (partialRecord: LEIRecord) => {
    try {
      // Fetch complete record from API (not limited by columns parameter)
      const response = await fetch(`${API_BASE_URL}/api/v1/lei/${partialRecord.lei}`)
      if (response.ok) {
        const fullRecord = await response.json()
        setSelectedRecord(fullRecord)
      } else {
        // Fallback to partial record if fetch fails
        console.warn('Failed to fetch complete record, using partial data')
        setSelectedRecord(partialRecord)
      }
    } catch (err) {
      console.error('Error fetching complete record:', err)
      // Fallback to partial record if fetch fails
      setSelectedRecord(partialRecord)
    }
  }

  // Fetch managing LOU name when modal opens
  useEffect(() => {
    const fetchManagingLouName = async () => {
      if (!selectedRecord?.managing_lou) {
        setManagingLouName(null)
        return
      }
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/lei/${selectedRecord.managing_lou}`)
        if (response.ok) {
          const data = await response.json()
          setManagingLouName(data.legal_name || null)
        } else {
          setManagingLouName(null)
        }
      } catch (err) {
        console.error('Failed to fetch managing LOU name:', err)
        setManagingLouName(null)
      }
    }
    
    fetchManagingLouName()
  }, [selectedRecord, API_BASE_URL])

  const formatCellValue = (value: any, key: keyof LEIRecord): string => {
    if (!value || value === 'null' || value === '0001-01-01T00:00:00Z') return '-'
    
    // Date fields
    if (key.includes('date') && typeof value === 'string') {
      try {
        const date = new Date(value)
        return date.toISOString().split('T')[0]
      } catch {
        return value
      }
    }
    
    return String(value)
  }

  const getColumnsByGroup = () => {
    const groups: Record<string, ColumnConfig[]> = {}
    AVAILABLE_COLUMNS.forEach(col => {
      if (!groups[col.group]) groups[col.group] = []
      groups[col.group].push(col)
    })
    return groups
  }

  const totalPages = Math.ceil(totalRecords / itemsPerPage)
  const hasActiveFilters = debouncedSearch || statusFilter || categoryFilter || countryFilter

  // Measure filter bar height dynamically
  useEffect(() => {
    if (filterBarRef.current && hasActiveFilters) {
      const height = filterBarRef.current.offsetHeight
      setFilterBarHeight(height)
    } else {
      setFilterBarHeight(0)
    }
  }, [hasActiveFilters, debouncedSearch, statusFilter, categoryFilter, countryFilter])
  const isLastPage = !hasMorePages

  if (loading && records.length === 0) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 opacity-70">Loading LEI records...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className={`${expandedWidth ? 'max-w-full' : 'max-w-7xl'} mx-auto transition-all duration-300`}>
        <div className="mb-8 flex justify-between items-start">
          <div>
            <Link href="/" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mb-4 inline-block">
              ← Back to Home
            </Link>
            <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">LEI Records</h1>
            <p className="text-gray-600 dark:text-gray-400">GLEIF Legal Entity Identifiers (ISO 17442)</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Expanded Width Toggle */}
            <button
              onClick={() => setExpandedWidth(!expandedWidth)}
              className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 transition-colors text-white text-sm font-medium flex items-center gap-2"
              title={expandedWidth ? 'Normal Width' : 'Expanded Width'}
            >
              {expandedWidth ? '⬅️ Normal' : '↔️ Expand'}
            </button>
            
            {/* Column Selector */}
            <div className="relative">
              <button
                onClick={() => setShowColumnSelector(!showColumnSelector)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors text-white text-sm font-medium flex items-center gap-2"
              >
                ⚙️ Columns ({visibleColumns.size})
              </button>
              
              {showColumnSelector && (
                <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-white/20 rounded-lg shadow-xl z-50">
                  <div className="sticky top-0 bg-white dark:bg-gray-800 border-b-2 border-gray-200 dark:border-white/10 p-3">
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
                        onClick={() => setVisibleColumns(new Set(AVAILABLE_COLUMNS.map(c => c.key)))}
                        className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => setVisibleColumns(new Set(AVAILABLE_COLUMNS.filter(c => c.defaultVisible).map(c => c.key)))}
                        className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        Reset to Default
                      </button>
                    </div>
                  </div>
                  
                  {Object.entries(getColumnsByGroup()).map(([group, columns]) => (
                    <div key={group} className="border-b border-gray-200 dark:border-white/10 last:border-b-0">
                      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 font-semibold text-sm text-gray-700 dark:text-gray-300">
                        {group}
                      </div>
                      <div className="p-2">
                        {columns.map((column) => (
                          <label
                            key={String(column.key)}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={visibleColumns.has(column.key)}
                              onChange={() => toggleColumn(column.key)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-gray-900 dark:text-white">{column.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <ThemeToggle />
          </div>
        </div>

        {error && (
          <div className={`mb-6 p-4 rounded-lg border ${
            error.includes('No LEI data matches') 
              ? 'bg-yellow-50 border-yellow-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <p className={error.includes('No LEI data matches') ? 'text-yellow-800' : 'text-red-800'}>
              <span className="font-semibold">
                {error.includes('No LEI data matches') ? '📋 Notice:' : '⚠️ Error:'}
              </span> {error}
            </p>
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Records</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalRecords.toLocaleString()}</p>
          </div>
          <div className="bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Current Page</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {currentPage} {hasActiveFilters ? '(filtered)' : `of ${totalPages.toLocaleString()}`}
            </p>
          </div>
          <div className="bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Showing</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalRecords)}
            </p>
          </div>
        </div>

        {/* Info message about sorting behavior (Hybrid Approach) */}
        {!hasActiveFilters && (
          <div className="mb-6 bg-blue-50 border-2 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/30 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                  Showing recently updated records
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Results are sorted by most recent updates for fast browsing. Use search or filters to sort by name.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Search</label>
              <input
                type="text"
                placeholder="LEI code or legal name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border-2 border-gray-300 bg-gray-50 text-gray-900 placeholder-gray-500 dark:border-white/20 dark:bg-white/5 dark:text-white dark:placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border-2 border-gray-300 bg-gray-50 text-gray-900 dark:border-white/20 dark:bg-white/5 dark:text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="" className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white">All Statuses</option>
                {statusOptions.map(status => (
                  <option key={status} value={status} className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white">
                    {status === 'NULL' ? 'Not Set' : status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border-2 border-gray-300 bg-gray-50 text-gray-900 dark:border-white/20 dark:bg-white/5 dark:text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="" className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white">All Categories</option>
                {categoryOptions.map(category => (
                  <option key={category} value={category} className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white">{category}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Country</label>
              <div className="relative" ref={countryDropdownRef}>
                <input
                  type="text"
                  placeholder="Search countries..."
                  value={countrySearch}
                  onChange={(e) => {
                    setCountrySearch(e.target.value)
                    setShowCountryDropdown(true)
                  }}
                  onFocus={() => setShowCountryDropdown(true)}
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-300 bg-gray-50 text-gray-900 placeholder-gray-500 dark:border-white/20 dark:bg-white/5 dark:text-white dark:placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                />
                
                {showCountryDropdown && (
                  <div className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-white/20 rounded-lg shadow-lg">
                    <button
                      onClick={() => {
                        setCountryFilter('')
                        setCountrySearch('')
                        setShowCountryDropdown(false)
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700"
                    >
                      All Countries
                    </button>
                    {countryOptions
                      .filter(country => 
                        countrySearch === '' ||
                        country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                        country.code.toLowerCase().includes(countrySearch.toLowerCase())
                      )
                      .map(country => (
                        <button
                          key={country.code}
                          onClick={() => {
                            setCountryFilter(country.code)
                            setCountrySearch(`${country.code} - ${country.name}`)
                            setShowCountryDropdown(false)
                          }}
                          className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm ${
                            countryFilter === country.code
                              ? 'bg-blue-50 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-medium'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          <span className="font-mono font-semibold">{country.code}</span> - {country.name}
                        </button>
                      ))}
                    {countryOptions.filter(country => 
                      countrySearch === '' ||
                      country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                      country.code.toLowerCase().includes(countrySearch.toLowerCase())
                    ).length === 0 && (
                      <div className="px-4 py-2 text-gray-500 dark:text-gray-400 text-sm">
                        No countries found
                      </div>
                    )}
                  </div>
                )}
                
                {countryFilter && (
                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    Filtered by: {countryOptions.find(c => c.code === countryFilter)?.name || countryFilter}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-6 py-2 rounded-lg bg-white hover:bg-gray-100 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-transparent transition-colors font-medium shadow-sm"
              >
                ✕ Clear Filters
              </button>
            )}
          </div>
        </div>

        {records.length > 0 && (
          <div className="mb-4 flex justify-between items-center">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white"
            >
              ← Previous
            </button>
            <span className="text-gray-700 dark:text-gray-300">
                Page {currentPage} {hasActiveFilters ? `(showing ${records.length} of ${records.length})` : `of ${totalPages.toLocaleString()}`}
            </span>
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={isLastPage}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white"
            >
              Next →
            </button>
          </div>
        )}

        {/* Sticky filter summary bar - shows when scrolling */}
        {hasActiveFilters && (
          <div ref={filterBarRef} className="sticky top-0 z-40 bg-blue-50 dark:bg-blue-900 border-b-2 border-blue-200 dark:border-blue-700 px-6 py-3 shadow-md rounded-t-lg">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap text-sm">
                <span className="font-medium text-blue-900 dark:text-blue-100">🔍 Active Filters:</span>
                {debouncedSearch && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded text-xs font-medium hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    Search: "{debouncedSearch}" <span className="ml-1">✕</span>
                  </button>
                )}
                {statusFilter && (
                  <button
                    onClick={() => setStatusFilter('')}
                    className="px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded text-xs font-medium hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    Status: {statusFilter === 'NULL' ? 'Not Set' : statusFilter} <span className="ml-1">✕</span>
                  </button>
                )}
                {categoryFilter && (
                  <button
                    onClick={() => setCategoryFilter('')}
                    className="px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded text-xs font-medium hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    Category: {categoryFilter} <span className="ml-1">✕</span>
                  </button>
                )}
                {countryFilter && (
                  <button
                    onClick={() => setCountryFilter('')}
                    className="px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded text-xs font-medium hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    Country: {countryOptions.find(c => c.code === countryFilter)?.name || countryFilter} <span className="ml-1">✕</span>
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

        {records.length > 0 ? (
          <div className="relative">
            {/* Loading overlay - Fixed to viewport for visibility when scrolled */}
            {loading && (
              <div className="fixed inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 bg-white dark:bg-gray-800 px-8 py-6 rounded-lg shadow-2xl border-2 border-blue-500 dark:border-blue-400">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-400"></div>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Loading results...</p>
                </div>
              </div>
            )}
            
            <div 
              className={`bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm shadow-lg transition-opacity duration-200 ${loading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`} 
              style={{ borderTopLeftRadius: hasActiveFilters ? 0 : undefined, borderTopRightRadius: hasActiveFilters ? 0 : undefined, borderBottomLeftRadius: '0.5rem', borderBottomRightRadius: '0.5rem' }}
            >
                <table className="w-full" style={{ tableLayout: 'auto', borderCollapse: 'collapse' }}>
                  <thead className="bg-gray-100 dark:bg-gray-800" style={{ position: 'sticky', top: hasActiveFilters ? `${filterBarHeight}px` : '0px', zIndex: 100 }}>
                    <tr>
                      {AVAILABLE_COLUMNS.filter(col => visibleColumns.has(col.key)).map((column) => (
                        <th 
                          key={String(column.key)}
                          onClick={() => handleSort(column.key)}
                          className={`${column.width || 'min-w-40'} px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors`}
                        >
                          <div className="flex items-center gap-1">
                            {column.label}
                            {sortField === column.key && (
                              <span className="text-blue-600 dark:text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {records.filter(r => r && r.id).map((record, index) => {
                    // Debug logging
                    if (debouncedSearch?.toLowerCase().includes('bgc')) {
                      console.log(`Rendering row ${index}:`, {
                        id: record.id,
                        lei: record.lei,
                        name: record.legal_name,
                        key: record.id
                      })
                    }
                    
                    return (
                    <tr 
                      key={record.id}
                      data-lei={record.lei}
                      data-row-index={index}
                      onClick={() => handleRecordClick(record)}
                      className="hover:bg-blue-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      style={{ height: 'auto', minHeight: '48px' }}
                    >
                      {AVAILABLE_COLUMNS.filter(col => visibleColumns.has(col.key)).map((column) => {
                        const value = record[column.key]
                        const isStatus = column.key === 'entity_status'
                        
                        return (
                          <td 
                            key={String(column.key)} 
                            className={`px-4 py-3 text-sm ${column.key === 'lei' ? 'font-mono' : ''} text-gray-900 dark:text-gray-100 ${column.key.includes('date') || column.key === 'lei' ? 'whitespace-nowrap' : ''}`}
                          >
                            {isStatus ? (
                              <span className={`px-2 py-1 text-xs rounded ${
                                value === 'ACTIVE' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                  : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                              }`}>
                                {value || '-'}
                              </span>
                            ) : (
                              formatCellValue(value, column.key)
                            )}
                          </td>
                        )
                      })}
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
            <div className="text-center py-12 bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg">
              <p className="text-xl text-gray-600 dark:text-gray-400">No records found with current filters</p>
            </div>
          )}

        {records.length > 0 && (
          <div className="mt-4 flex justify-between items-center flex-wrap gap-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white"
            >
              ← Previous
            </button>
            <div className="flex items-center gap-4">
              <span className="text-gray-700 dark:text-gray-300">
                Page {currentPage} {hasActiveFilters && `(showing ${records.length})`}
              </span>
              <div className="flex items-center gap-2">
                <label htmlFor="items-per-page" className="text-sm text-gray-700 dark:text-gray-300">Items per page:</label>
                <select
                  id="items-per-page"
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="px-3 py-1 rounded-lg bg-white border-2 border-gray-200 dark:bg-gray-800 dark:border-white/10 text-gray-900 dark:text-white text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="250">250</option>
                  <option value="500">500</option>
                </select>
              </div>
            </div>
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={isLastPage}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white"
            >
              Next →
            </button>
          </div>
        )}

        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Data source: GLEIF Golden Copy Files • Updated via scheduled sync jobs</p>
          <p className="mt-2">
            Total database contains {totalRecords.toLocaleString()} LEI records • 
            <Link href="/lei" className="ml-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline">
              View sync status
            </Link>
          </p>
        </div>
      </div>

      {/* Detailed View Modal */}
      {selectedRecord && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedRecord(null)}
        >
          <div 
            className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border-2 border-gray-300 dark:border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b-2 border-gray-200 dark:border-white/10 p-6 z-10">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">LEI Record Details</h2>
                  <p className="text-lg font-mono text-blue-600 dark:text-blue-400">{selectedRecord.lei}</p>
                </div>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-gray-900 dark:text-white font-medium"
                >
                  ✕ Close
                </button>
              </div>
              {/* Date Display Mode Toggle */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Date display:</span>
                <button
                  onClick={() => setDateDisplayMode(dateDisplayMode === 'relative' ? 'absolute' : 'relative')}
                  className="px-3 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-900 dark:text-blue-100 transition-colors font-medium"
                >
                  {dateDisplayMode === 'relative' ? '📅 Relative' : '🔢 Days only'}
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="bg-white dark:bg-gray-900 pb-6">
              {/* Core Information */}
              <section className="bg-white dark:bg-gray-900 p-6 pb-0">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 pb-2 border-b border-gray-200 dark:border-white/10">
                  Core Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-gray-900">
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Legal Name</label>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{selectedRecord.legal_name}</p>
                  </div>
                  {selectedRecord.transliterated_legal_name && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Transliterated Name</label>
                      <p className="text-sm text-gray-900 dark:text-white mt-1">{selectedRecord.transliterated_legal_name}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</label>
                    <p className="mt-1">
                      <span className={`px-2 py-1 text-xs rounded ${
                        selectedRecord.entity_status === 'ACTIVE' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}>
                        {selectedRecord.entity_status}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</label>
                    <p className="text-sm text-gray-900 dark:text-white mt-1">{selectedRecord.entity_category || '-'}</p>
                  </div>
                  {selectedRecord.entity_sub_category && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sub Category</label>
                      <p className="text-sm text-gray-900 dark:text-white mt-1">{selectedRecord.entity_sub_category}</p>
                    </div>
                  )}
                  {selectedRecord.entity_legal_form && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Legal Form</label>
                      <p className="text-sm text-gray-900 dark:text-white mt-1">{selectedRecord.entity_legal_form}</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Addresses - Side by Side with Aligned Fields */}
              <section className="bg-white dark:bg-gray-900 p-6 pb-0">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 pb-2 border-b border-gray-200 dark:border-white/10">
                  Addresses
                </h3>
                
                {/* Column Headers */}
                <div className="grid grid-cols-2 gap-6 mb-4 bg-white dark:bg-gray-900">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Legal Address
                    </h4>
                    {selectedRecord.legal_address_city && (
                      <button
                        onClick={() => window.open(buildMapUrl({
                          line1: selectedRecord.legal_address_line_1,
                          line2: selectedRecord.legal_address_line_2,
                          line3: selectedRecord.legal_address_line_3,
                          line4: selectedRecord.legal_address_line_4,
                          city: selectedRecord.legal_address_city,
                          region: selectedRecord.legal_address_region,
                          country: selectedRecord.legal_address_country,
                          postalCode: selectedRecord.legal_address_postal_code
                        }), '_blank')}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs font-medium flex items-center gap-1 transition-colors"
                        title="View on OpenStreetMap"
                      >
                        🗺️ View on Map
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Headquarters Address
                    </h4>
                    {selectedRecord.hq_address_city && (
                      <button
                        onClick={() => window.open(buildMapUrl({
                          line1: selectedRecord.hq_address_line_1,
                          line2: selectedRecord.hq_address_line_2,
                          line3: selectedRecord.hq_address_line_3,
                          line4: selectedRecord.hq_address_line_4,
                          city: selectedRecord.hq_address_city,
                          region: selectedRecord.hq_address_region,
                          country: selectedRecord.hq_address_country,
                          postalCode: selectedRecord.hq_address_postal_code
                        }), '_blank')}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs font-medium flex items-center gap-1 transition-colors"
                        title="View on OpenStreetMap"
                      >
                        🗺️ View on Map
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4 bg-white dark:bg-gray-900">
                  {/* Address Row */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Address</label>
                      <p className="text-sm text-gray-900 dark:text-white mt-1">
                        {selectedRecord.legal_address_line_1 || '-'}
                        {selectedRecord.legal_address_line_2 && <><br/>{selectedRecord.legal_address_line_2}</>}
                        {selectedRecord.legal_address_line_3 && <><br/>{selectedRecord.legal_address_line_3}</>}
                        {selectedRecord.legal_address_line_4 && <><br/>{selectedRecord.legal_address_line_4}</>}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Address</label>
                      <p className="text-sm text-gray-900 dark:text-white mt-1">
                        {selectedRecord.hq_address_line_1 ? (
                          <>
                            {selectedRecord.hq_address_line_1}
                            {selectedRecord.hq_address_line_2 && <><br/>{selectedRecord.hq_address_line_2}</>}
                            {selectedRecord.hq_address_line_3 && <><br/>{selectedRecord.hq_address_line_3}</>}
                            {selectedRecord.hq_address_line_4 && <><br/>{selectedRecord.hq_address_line_4}</>}
                          </>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400 italic">Same as Legal</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* City Row */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">City</label>
                      <p className="text-sm text-gray-900 dark:text-white mt-1">{selectedRecord.legal_address_city || '-'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">City</label>
                      <p className="text-sm text-gray-900 dark:text-white mt-1">
                        {selectedRecord.hq_address_city || (selectedRecord.hq_address_line_1 ? '-' : <span className="text-gray-500 dark:text-gray-400 italic">Same as Legal</span>)}
                      </p>
                    </div>
                  </div>

                  {/* Region Row */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Region</label>
                      <p className="text-sm text-gray-900 dark:text-white mt-1">{selectedRecord.legal_address_region || '-'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Region</label>
                      <p className="text-sm text-gray-900 dark:text-white mt-1">
                        {selectedRecord.hq_address_region || (selectedRecord.hq_address_line_1 ? '-' : <span className="text-gray-500 dark:text-gray-400 italic">Same as Legal</span>)}
                      </p>
                    </div>
                  </div>

                  {/* Country Row */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Country</label>
                      <p className="text-sm text-gray-900 dark:text-white mt-1">{selectedRecord.legal_address_country || '-'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Country</label>
                      <p className="text-sm text-gray-900 dark:text-white mt-1">
                        {selectedRecord.hq_address_country || (selectedRecord.hq_address_line_1 ? '-' : <span className="text-gray-500 dark:text-gray-400 italic">Same as Legal</span>)}
                      </p>
                    </div>
                  </div>

                  {/* Postal Code Row */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Postal Code</label>
                      <p className="text-sm text-gray-900 dark:text-white mt-1">{selectedRecord.legal_address_postal_code || '-'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Postal Code</label>
                      <p className="text-sm text-gray-900 dark:text-white mt-1">
                        {selectedRecord.hq_address_postal_code || (selectedRecord.hq_address_line_1 ? '-' : <span className="text-gray-500 dark:text-gray-400 italic">Same as Legal</span>)}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Registration Information */}
              <section className="bg-white dark:bg-gray-900 p-6 pb-0">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 pb-2 border-b border-gray-200 dark:border-white/10">
                  Registration Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-gray-900">
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Registration Authority</label>
                    <p className="text-sm text-gray-900 dark:text-white mt-1">{selectedRecord.registration_authority || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Registration Number</label>
                    <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">{selectedRecord.registration_number || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Initial Registration</label>
                    <p className="text-sm text-gray-900 dark:text-white mt-1">
                      {formatCellValue(selectedRecord.initial_registration_date, 'initial_registration_date')}
                      {selectedRecord.initial_registration_date && selectedRecord.initial_registration_date !== '0001-01-01T00:00:00Z' && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          ({dateDisplayMode === 'relative' 
                            ? getRelativeTime(selectedRecord.initial_registration_date).relative
                            : `${Math.abs(getRelativeTime(selectedRecord.initial_registration_date).days)} days ago`})
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Last Updated</label>
                    <p className="text-sm text-gray-900 dark:text-white mt-1">
                      {formatCellValue(selectedRecord.last_update_date, 'last_update_date')}
                      {selectedRecord.last_update_date && selectedRecord.last_update_date !== '0001-01-01T00:00:00Z' && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          ({dateDisplayMode === 'relative' 
                            ? getRelativeTime(selectedRecord.last_update_date).relative
                            : `${Math.abs(getRelativeTime(selectedRecord.last_update_date).days)} days ago`})
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Next Renewal</label>
                    <p className="text-sm text-gray-900 dark:text-white mt-1">
                      {formatCellValue(selectedRecord.next_renewal_date, 'next_renewal_date')}
                      {selectedRecord.next_renewal_date && selectedRecord.next_renewal_date !== '0001-01-01T00:00:00Z' && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          ({dateDisplayMode === 'relative' 
                            ? getRelativeTime(selectedRecord.next_renewal_date).relative
                            : `in ${getRelativeTime(selectedRecord.next_renewal_date).days} days`})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </section>

              {/* Associated Entities */}
              {(selectedRecord.managing_lou || selectedRecord.successor_lei) && (
                <section className="bg-white dark:bg-gray-900 p-6 pb-0">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 pb-2 border-b border-gray-200 dark:border-white/10">
                    Associated Entities
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-gray-900">
                    {selectedRecord.managing_lou && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Managing LOU</label>
                        <p className="text-sm text-gray-900 dark:text-white mt-1 font-mono">{selectedRecord.managing_lou}</p>
                        {managingLouName && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{managingLouName}</p>
                        )}
                        {managingLouName === null && selectedRecord.managing_lou && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">Loading name...</p>
                        )}
                      </div>
                    )}
                    {selectedRecord.successor_lei && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Successor LEI</label>
                        <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">{selectedRecord.successor_lei}</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Validation */}
              {selectedRecord.validation_authority && (
                <section className="bg-white dark:bg-gray-900 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 pb-2 border-b border-gray-200 dark:border-white/10">
                    Validation
                  </h3>
                  <div className="grid grid-cols-1 gap-4 bg-white dark:bg-gray-900">
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Validation Authority</label>
                      <p className="text-sm text-gray-900 dark:text-white mt-1">{selectedRecord.validation_authority}</p>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
