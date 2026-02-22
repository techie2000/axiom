'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ThemeToggle from '../components/ThemeToggle'
import CountryFlag from '../components/CountryFlag'
import SearchInputWithOverflowTooltip from '../components/SearchInputWithOverflowTooltip'

interface SSIRecord {
  id: string
  ssi_reference: string
  counterparty_name: string
  account_name: string
  country_code: string
  currency: string
  bic: string
  iban?: string
  settlement_method: 'Agent' | 'Direct'
  status: 'Active' | 'Inactive'
  updated_at: string
}

interface APISSIRecord {
  id?: string
  ssi_reference?: string
  counterparty_name?: string
  account_name?: string
  country_code?: string
  currency?: string
  bic?: string
  iban?: string
  settlement_method?: 'Agent' | 'Direct'
  status?: 'Active' | 'Inactive'
  beneficiary_name?: string
  beneficiary_account?: string
  beneficiary_bank_bic?: string
  intermediary_bank_bic?: string
  settlement_type?: string
  active?: boolean
  updated_at?: string
  entity?: {
    name?: string
  }
  settlement_currency?: {
    code?: string
  }
}

type SSIColumnKey =
  | 'ssi_reference'
  | 'counterparty_name'
  | 'account_name'
  | 'country_code'
  | 'country_flag'
  | 'currency'
  | 'bic'
  | 'iban'
  | 'settlement_method'
  | 'status'
  | 'updated_at'

interface SSIColumnConfig {
  key: SSIColumnKey
  label: string
  defaultVisible: boolean
}

const SSI_COLUMNS: SSIColumnConfig[] = [
  { key: 'ssi_reference', label: 'SSI Reference', defaultVisible: true },
  { key: 'counterparty_name', label: 'Counterparty', defaultVisible: true },
  { key: 'account_name', label: 'Account', defaultVisible: true },
  { key: 'country_code', label: 'Country (Alpha-2)', defaultVisible: true },
  { key: 'country_flag', label: 'Flag', defaultVisible: false },
  { key: 'currency', label: 'Currency', defaultVisible: true },
  { key: 'bic', label: 'BIC/SWIFT', defaultVisible: true },
  { key: 'iban', label: 'IBAN', defaultVisible: false },
  { key: 'settlement_method', label: 'Method', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'updated_at', label: 'Updated', defaultVisible: false },
]

const SAMPLE_SSI_DATA: SSIRecord[] = [
  {
    id: '1',
    ssi_reference: 'SSI-GB-0001',
    counterparty_name: 'Meridian London Clearing',
    account_name: 'GBP Settlement Account',
    country_code: 'GB',
    currency: 'GBP',
    bic: 'BARCGB22',
    iban: 'GB29NWBK60161331926819',
    settlement_method: 'Agent',
    status: 'Active',
    updated_at: '2026-02-20T14:22:00Z',
  },
  {
    id: '2',
    ssi_reference: 'SSI-SE-0002',
    counterparty_name: 'Nordic Settlement Services',
    account_name: 'SEK Cash Account',
    country_code: 'SE',
    currency: 'SEK',
    bic: 'ESSESESS',
    iban: 'SE4550000000058398257466',
    settlement_method: 'Direct',
    status: 'Active',
    updated_at: '2026-02-18T09:40:00Z',
  },
  {
    id: '3',
    ssi_reference: 'SSI-US-0003',
    counterparty_name: 'Atlantic Prime Broker',
    account_name: 'USD Delivery Account',
    country_code: 'US',
    currency: 'USD',
    bic: 'BOFAUS3N',
    settlement_method: 'Agent',
    status: 'Inactive',
    updated_at: '2026-02-14T17:05:00Z',
  },
]

const formatDate = (dateString?: string) => {
  if (!dateString || dateString.startsWith('0001-')) return '-'
  return new Date(dateString).toISOString().split('T')[0]
}

const toSettlementMethod = (settlementType?: string): 'Agent' | 'Direct' => {
  const normalized = (settlementType || '').toUpperCase()
  return normalized === 'DVP' || normalized === 'DAP' ? 'Direct' : 'Agent'
}

const looksLikeIBAN = (value?: string) => /^[A-Z]{2}[0-9A-Z]{10,34}$/i.test((value || '').trim())

const mapApiSSIRecord = (item: APISSIRecord): SSIRecord => {
  if (item.ssi_reference || item.counterparty_name || item.account_name) {
    const resolvedId = (item.id || '').trim() || `missing-${Math.random().toString(36).slice(2, 10)}`
    const compactId = resolvedId.replace(/-/g, '').toUpperCase()

    return {
      id: resolvedId,
      ssi_reference: (item.ssi_reference || `SSI-${compactId.slice(0, 8) || 'UNKNOWN'}`).trim(),
      counterparty_name: (item.counterparty_name || '—').trim() || '—',
      account_name: (item.account_name || '—').trim() || '—',
      country_code: (item.country_code || '').trim().toUpperCase(),
      currency: (item.currency || '—').trim().toUpperCase() || '—',
      bic: (item.bic || '—').trim().toUpperCase() || '—',
      iban: (item.iban || '').trim() || undefined,
      settlement_method: item.settlement_method === 'Direct' ? 'Direct' : 'Agent',
      status: item.status === 'Active' ? 'Active' : 'Inactive',
      updated_at: item.updated_at || '',
    }
  }

  const id = (item.id || '').trim()
  const fallbackId = `missing-${Math.random().toString(36).slice(2, 10)}`
  const resolvedID = id || fallbackId
  const compactId = resolvedID.replace(/-/g, '').toUpperCase()
  const ssiReference = `SSI-${compactId.slice(0, 8) || 'UNKNOWN'}`
  const beneficiaryAccount = (item.beneficiary_account || '').trim()
  const countryCodeMatch = beneficiaryAccount.match(/^[A-Z]{2}/i)
  const countryCode = countryCodeMatch ? countryCodeMatch[0].toUpperCase() : ''

  return {
    id: resolvedID,
    ssi_reference: ssiReference,
    counterparty_name: (item.entity?.name || item.beneficiary_name || '—').trim() || '—',
    account_name: beneficiaryAccount || '—',
    country_code: countryCode,
    currency: (item.settlement_currency?.code || '—').trim() || '—',
    bic: (item.beneficiary_bank_bic || item.intermediary_bank_bic || '—').trim() || '—',
    iban: looksLikeIBAN(beneficiaryAccount) ? beneficiaryAccount : undefined,
    settlement_method: toSettlementMethod(item.settlement_type),
    status: item.active ? 'Active' : 'Inactive',
    updated_at: item.updated_at || '',
  }
}

const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const keys = ['token', 'jwt', 'authToken', 'access_token']
  for (const key of keys) {
    const value = localStorage.getItem(key)
    if (value && value.trim()) {
      return value.trim()
    }
  }

  return null
}

export default function SSIPage() {
  const [records, setRecords] = useState<SSIRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dataMode, setDataMode] = useState<'api' | 'sample'>('api')
  const [infoMessage, setInfoMessage] = useState<string>('')
  const [expandedWidth, setExpandedWidth] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [currencyFilter, setCurrencyFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Set<SSIColumnKey>>(
    new Set<SSIColumnKey>(SSI_COLUMNS.filter((column) => column.defaultVisible).map((column) => column.key))
  )

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowColumnSelector(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  useEffect(() => {
    const API_BASE_URL =
      typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080' : 'http://backend:8080'

    const fetchSSIRecords = async () => {
      try {
        const headers: Record<string, string> = {
          Accept: 'application/json',
        }

        const token = getAuthToken()
        if (token) {
          headers.Authorization = `Bearer ${token}`
        }

        const response = await fetch(`${API_BASE_URL}/api/v1/ssis?limit=5000&offset=0`, { headers })

        if (response.ok) {
          const data: APISSIRecord[] = await response.json()
          const mappedRecords = (Array.isArray(data) ? data : [])
            .map(mapApiSSIRecord)
            .sort((a, b) =>
              a.counterparty_name.localeCompare(b.counterparty_name) || a.ssi_reference.localeCompare(b.ssi_reference)
            )

          setRecords(mappedRecords)
          setDataMode('api')
          setInfoMessage(
            mappedRecords.length > 0 ? 'Loaded from SSI API.' : 'No SSI records available yet. Connect data to begin.'
          )
          return
        }

        setRecords(SAMPLE_SSI_DATA)
        setDataMode('sample')
        if (response.status === 401 || response.status === 403) {
          setInfoMessage('SSI API requires authentication. Showing sample data.')
        } else {
          setInfoMessage(`SSI API returned ${response.status}. Showing sample data.`)
        }
      } catch {
        setRecords(SAMPLE_SSI_DATA)
        setDataMode('sample')
        setInfoMessage('SSI API unavailable. Showing sample data.')
      } finally {
        setLoading(false)
      }
    }

    fetchSSIRecords()
  }, [])

  const toggleColumn = (column: SSIColumnKey) => {
    setVisibleColumns((current) => {
      const next = new Set(current)
      if (next.has(column)) {
        next.delete(column)
      } else {
        next.add(column)
      }
      return next
    })
  }

  const filteredRecords = records.filter((record) => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    const matchesSearch =
      !normalizedSearch ||
      record.ssi_reference.toLowerCase().includes(normalizedSearch) ||
      record.counterparty_name.toLowerCase().includes(normalizedSearch) ||
      record.account_name.toLowerCase().includes(normalizedSearch) ||
      record.bic.toLowerCase().includes(normalizedSearch)

    const matchesCountry = !countryFilter || record.country_code === countryFilter
    const matchesCurrency = !currencyFilter || record.currency === currencyFilter
    const matchesStatus = !statusFilter || record.status === statusFilter

    return matchesSearch && matchesCountry && matchesCurrency && matchesStatus
  })

  const hasActiveFilters = Boolean(searchTerm || countryFilter || currencyFilter || statusFilter)
  const tableColSpan = visibleColumns.size

  const countryOptions = Array.from(
    new Set(records.map((record) => record.country_code).filter((countryCode) => countryCode.trim().length > 0))
  ).sort((a, b) => a.localeCompare(b))
  const currencyOptions = Array.from(new Set(records.map((record) => record.currency))).sort((a, b) =>
    a.localeCompare(b)
  )

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className={`${expandedWidth ? 'max-w-full' : 'max-w-7xl'} mx-auto transition-all duration-300`}>
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 opacity-70">Loading SSI records...</p>
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
            <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 inline-block">
              ← Back to Home
            </Link>
            <h1 className="text-4xl font-bold mb-2">Standard Settlement Instructions (SSI)</h1>
            <p className="opacity-70">Browse and filter settlement instructions</p>
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
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-white/20 rounded-lg shadow-xl z-50">
                  <div className="p-3 border-b border-gray-200 dark:border-white/10">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">Select Columns</h3>
                      <button
                        onClick={() => setShowColumnSelector(false)}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        aria-label="Close columns selector"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <button
                        onClick={() => setVisibleColumns(new Set(SSI_COLUMNS.map((column) => column.key)))}
                        className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() =>
                          setVisibleColumns(
                            new Set<SSIColumnKey>(
                              SSI_COLUMNS.filter((column) => column.defaultVisible).map((column) => column.key)
                            )
                          )
                        }
                        className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        Reset Default
                      </button>
                    </div>
                  </div>

                  <div className="p-2 max-h-80 overflow-y-auto">
                    {SSI_COLUMNS.map((column) => (
                      <label
                        key={column.key}
                        className="flex items-center gap-2 px-2 py-2 rounded hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
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

        <div
          className={`mb-6 p-4 rounded-lg border ${
            dataMode === 'api' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
          }`}
        >
          <p className={dataMode === 'api' ? 'text-green-800' : 'text-yellow-800'}>
            <span className="font-semibold">{dataMode === 'api' ? '✅ Data Source:' : '📋 Notice:'}</span> {infoMessage}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-white/5 rounded-lg shadow p-6 border-2 border-gray-200 dark:border-white/10">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total SSI Records</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{records.length}</p>
          </div>
          <div className="bg-white dark:bg-white/5 rounded-lg shadow p-6 border-2 border-gray-200 dark:border-white/10">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Filtered Results</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{filteredRecords.length}</p>
          </div>
          <div className="bg-white dark:bg-white/5 rounded-lg shadow p-6 border-2 border-gray-200 dark:border-white/10">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Data Type</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">SSI</p>
          </div>
        </div>

        <div className="mb-6 bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg p-6">
          <div className={`grid grid-cols-1 ${hasActiveFilters ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3`}>
            <SearchInputWithOverflowTooltip
              type="text"
              placeholder="Search reference, counterparty, account, or BIC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-400"
            />

            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-white/5 text-gray-900 dark:text-white"
            >
              <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="">
                All Countries
              </option>
              {countryOptions.map((country) => (
                <option
                  className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  key={country}
                  value={country}
                >
                  {country}
                </option>
              ))}
            </select>

            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-white/5 text-gray-900 dark:text-white"
            >
              <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="">
                All Currencies
              </option>
              {currencyOptions.map((currency) => (
                <option
                  className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  key={currency}
                  value={currency}
                >
                  {currency}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as '' | 'Active' | 'Inactive')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-white/5 text-gray-900 dark:text-white"
            >
              <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="">
                All Statuses
              </option>
              <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Active">
                Active
              </option>
              <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="Inactive">
                Inactive
              </option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('')
                  setCountryFilter('')
                  setCurrencyFilter('')
                  setStatusFilter('')
                }}
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-white/5 rounded-lg shadow overflow-hidden border-2 border-gray-200 dark:border-white/10">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  {visibleColumns.has('ssi_reference') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      SSI Reference
                    </th>
                  )}
                  {visibleColumns.has('counterparty_name') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Counterparty
                    </th>
                  )}
                  {visibleColumns.has('account_name') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Account
                    </th>
                  )}
                  {visibleColumns.has('country_code') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Country (Alpha-2)
                    </th>
                  )}
                  {visibleColumns.has('country_flag') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Flag
                    </th>
                  )}
                  {visibleColumns.has('currency') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Currency
                    </th>
                  )}
                  {visibleColumns.has('bic') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      BIC/SWIFT
                    </th>
                  )}
                  {visibleColumns.has('iban') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      IBAN
                    </th>
                  )}
                  {visibleColumns.has('settlement_method') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Method
                    </th>
                  )}
                  {visibleColumns.has('status') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                  )}
                  {visibleColumns.has('updated_at') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Updated
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-white/5 divide-y divide-gray-200 dark:divide-white/10">
                {filteredRecords.length > 0 ? (
                  filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-blue-50 dark:hover:bg-white/10 transition-colors">
                      {visibleColumns.has('ssi_reference') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {record.ssi_reference}
                        </td>
                      )}
                      {visibleColumns.has('counterparty_name') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {record.counterparty_name}
                        </td>
                      )}
                      {visibleColumns.has('account_name') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {record.account_name}
                        </td>
                      )}
                      {visibleColumns.has('country_code') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded font-mono">
                            {record.country_code || '—'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.has('country_flag') && (
                        <td className="px-6 py-4 whitespace-nowrap text-2xl text-gray-900 dark:text-white" title={record.country_code}>
                          <CountryFlag
                            countryCode={record.country_code}
                            title={record.country_code || '—'}
                            className="inline-block h-6 w-6 align-middle"
                          />
                        </td>
                      )}
                      {visibleColumns.has('currency') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                          {record.currency}
                        </td>
                      )}
                      {visibleColumns.has('bic') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                          {record.bic}
                        </td>
                      )}
                      {visibleColumns.has('iban') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                          {record.iban || '—'}
                        </td>
                      )}
                      {visibleColumns.has('settlement_method') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {record.settlement_method}
                        </td>
                      )}
                      {visibleColumns.has('status') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              record.status === 'Active'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                            }`}
                          >
                            {record.status}
                          </span>
                        </td>
                      )}
                      {visibleColumns.has('updated_at') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(record.updated_at)}
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={tableColSpan} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      No SSI records found matching your filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
