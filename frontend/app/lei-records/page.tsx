'use client'

import { MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Alert from '../components/Alert'
import CountryFlag from '../components/CountryFlag'
import LEIOtherNamesList from '../components/LEIOtherNamesList'
import PageHeader from '../components/PageHeader'
import PreferenceSavePrompt from '../components/PreferenceSavePrompt'
import ReferenceDetailList from '../components/ReferenceDetailList'
import SearchInputWithOverflowTooltip from '../components/SearchInputWithOverflowTooltip'
import StatCard from '../components/StatCard'
import SyncedWideTable from '../components/SyncedWideTable'
import ThemedSelect from '../components/ThemedSelect'
import { useDeferredBooleanPreference } from '../lib/useDeferredBooleanPreference'
import { buildDocsUrl } from '../lib/docsLinks'
import { useButtonEmojiMode } from '../lib/useButtonEmojiMode'
import { useEnglishTooltips } from '../lib/useEnglishTooltips'
import { useCachedLeiCount } from '../lib/useCachedLeiCount'
import { useUserPreference } from '../lib/useUserPreference'
import { useSearchFocusShortcut } from '../lib/useSearchFocusShortcut'
import MapLink from '../components/MapLink'
import { formatEnumDisplayValue, formatLEICellValue, getStatusBadgePresentation, normalizeRecordNullLikeValues } from './null-utils'
import { computeShowingEnd, formatCurrentPageStatValue } from './stats-format'
import { useTranslation } from 'react-i18next'
import LEIAuditHistoryModal from '../components/LEIAuditHistoryModal'
import {
  buildRegistrationLookupOptions,
  openRegistrationLookup,
  RegistrationLookupOption,
} from '../lib/ra-lookup'

function buildLookupOptions(
  raCode: string | null | undefined,
  raTemplates: Array<{ name: string; url: string }>,
  regNum: string | null | undefined,
): RegistrationLookupOption[] {
  return buildRegistrationLookupOptions(raCode, raTemplates, regNum)
}

interface LEIRecord {
  id: string
  lei: string
  country_flag?: string
  legal_name: string
  transliterated_legal_name: string
  other_names: string
  entity_status: string
  entity_category: string
  entity_sub_category: string
  entity_legal_form: string
  entity_legal_form_name?: string
  
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
  registration_authority_name?: string
  registration_authority_international_name?: string
  registration_authority_website?: string
  registration_authority_comments?: string
  registration_authority_id: string
  registration_number: string
  
  // Associated Entities
  managing_lou: string
  successor_lei: string
  managing_lou_legal_name?: string
  successor_lei_legal_name?: string
  
  // Dates
  registration_date: string
  initial_registration_date: string
  last_update_date: string
  next_renewal_date: string
  
  // Validation
  validation_sources: string
  validation_authority: string
}

interface RelatedLEIReference {
  lei: string
  legal_name: string
}

interface Country {
  code: string
  name: string
  alpha3_code?: string
  region?: string
  active: boolean
  [key: string]: unknown
}

interface LanguageOption {
  code: string
  name: string
  [key: string]: unknown
}

interface ColumnConfig {
  key: keyof LEIRecord
  labelKey: string
  groupKey: string
  defaultVisible: boolean
  width?: string
}

const VIRTUAL_COLUMN_DEPENDENCIES: Partial<Record<keyof LEIRecord, Array<keyof LEIRecord>>> = {
  country_flag: ['legal_address_country'],
}

const AVAILABLE_COLUMNS: ColumnConfig[] = [
  // Core fields
  { key: 'lei', labelKey: 'leiRecords.columns.labels.lei', groupKey: 'leiRecords.columns.groups.core', defaultVisible: true, width: 'w-44' },
  { key: 'legal_name', labelKey: 'leiRecords.columns.labels.legalName', groupKey: 'leiRecords.columns.groups.core', defaultVisible: true, width: 'min-w-96' },
  { key: 'entity_status', labelKey: 'leiRecords.columns.labels.status', groupKey: 'leiRecords.columns.groups.core', defaultVisible: true, width: 'w-32' },
  { key: 'entity_category', labelKey: 'leiRecords.columns.labels.category', groupKey: 'leiRecords.columns.groups.core', defaultVisible: true, width: 'w-40' },
  { key: 'country_flag', labelKey: 'leiRecords.columns.labels.countryFlag', groupKey: 'leiRecords.columns.groups.core', defaultVisible: false, width: 'w-20' },
  { key: 'last_update_date', labelKey: 'leiRecords.columns.labels.lastUpdated', groupKey: 'leiRecords.columns.groups.core', defaultVisible: true, width: 'w-32' },
  
  // Additional Entity Info
  { key: 'transliterated_legal_name', labelKey: 'leiRecords.columns.labels.transliteratedName', groupKey: 'leiRecords.columns.groups.entity', defaultVisible: false, width: 'min-w-64' },
  { key: 'entity_sub_category', labelKey: 'leiRecords.columns.labels.subCategory', groupKey: 'leiRecords.columns.groups.entity', defaultVisible: false, width: 'w-40' },
  { key: 'entity_legal_form', labelKey: 'leiRecords.columns.labels.legalFormName', groupKey: 'leiRecords.columns.groups.entity', defaultVisible: false, width: 'w-40' },
  
  // Legal Address (natural order: address lines, then city/region/country/postal)
  { key: 'legal_address_line_1', labelKey: 'leiRecords.columns.labels.legalAddressLine1', groupKey: 'leiRecords.columns.groups.legalAddress', defaultVisible: false, width: 'min-w-48' },
  { key: 'legal_address_line_2', labelKey: 'leiRecords.columns.labels.legalAddressLine2', groupKey: 'leiRecords.columns.groups.legalAddress', defaultVisible: false, width: 'min-w-48' },
  { key: 'legal_address_line_3', labelKey: 'leiRecords.columns.labels.legalAddressLine3', groupKey: 'leiRecords.columns.groups.legalAddress', defaultVisible: false, width: 'min-w-48' },
  { key: 'legal_address_line_4', labelKey: 'leiRecords.columns.labels.legalAddressLine4', groupKey: 'leiRecords.columns.groups.legalAddress', defaultVisible: false, width: 'min-w-48' },
  { key: 'legal_address_city', labelKey: 'leiRecords.columns.labels.legalCity', groupKey: 'leiRecords.columns.groups.legalAddress', defaultVisible: false, width: 'w-40' },
  { key: 'legal_address_region', labelKey: 'leiRecords.columns.labels.regionName', groupKey: 'leiRecords.columns.groups.legalAddress', defaultVisible: false, width: 'w-32' },
  { key: 'legal_address_country', labelKey: 'leiRecords.columns.labels.countryName', groupKey: 'leiRecords.columns.groups.legalAddress', defaultVisible: true, width: 'w-24' },
  { key: 'legal_address_postal_code', labelKey: 'leiRecords.columns.labels.legalPostalCode', groupKey: 'leiRecords.columns.groups.legalAddress', defaultVisible: false, width: 'w-28' },
  
  // HQ Address (natural order: address lines, then city/region/country/postal)
  { key: 'hq_address_line_1', labelKey: 'leiRecords.columns.labels.hqAddressLine1', groupKey: 'leiRecords.columns.groups.hqAddress', defaultVisible: false, width: 'min-w-48' },
  { key: 'hq_address_line_2', labelKey: 'leiRecords.columns.labels.hqAddressLine2', groupKey: 'leiRecords.columns.groups.hqAddress', defaultVisible: false, width: 'min-w-48' },
  { key: 'hq_address_line_3', labelKey: 'leiRecords.columns.labels.hqAddressLine3', groupKey: 'leiRecords.columns.groups.hqAddress', defaultVisible: false, width: 'min-w-48' },
  { key: 'hq_address_line_4', labelKey: 'leiRecords.columns.labels.hqAddressLine4', groupKey: 'leiRecords.columns.groups.hqAddress', defaultVisible: false, width: 'min-w-48' },
  { key: 'hq_address_city', labelKey: 'leiRecords.columns.labels.hqCity', groupKey: 'leiRecords.columns.groups.hqAddress', defaultVisible: false, width: 'w-40' },
  { key: 'hq_address_region', labelKey: 'leiRecords.columns.labels.hqRegionName', groupKey: 'leiRecords.columns.groups.hqAddress', defaultVisible: false, width: 'w-32' },
  { key: 'hq_address_country', labelKey: 'leiRecords.columns.labels.hqCountryName', groupKey: 'leiRecords.columns.groups.hqAddress', defaultVisible: false, width: 'w-24' },
  { key: 'hq_address_postal_code', labelKey: 'leiRecords.columns.labels.hqPostalCode', groupKey: 'leiRecords.columns.groups.hqAddress', defaultVisible: false, width: 'w-28' },
  
  // Registration
  { key: 'registration_authority', labelKey: 'leiRecords.columns.labels.registrationAuthority', groupKey: 'leiRecords.columns.groups.registration', defaultVisible: false, width: 'w-48' },
  { key: 'registration_number', labelKey: 'leiRecords.columns.labels.registrationNumber', groupKey: 'leiRecords.columns.groups.registration', defaultVisible: false, width: 'w-40' },
  { key: 'initial_registration_date', labelKey: 'leiRecords.columns.labels.initialRegistration', groupKey: 'leiRecords.columns.groups.registration', defaultVisible: false, width: 'w-36' },
  { key: 'next_renewal_date', labelKey: 'leiRecords.columns.labels.nextRenewal', groupKey: 'leiRecords.columns.groups.registration', defaultVisible: false, width: 'w-32' },
  
  // Associated Entities
  { key: 'managing_lou', labelKey: 'leiRecords.columns.labels.managingLou', groupKey: 'leiRecords.columns.groups.associated', defaultVisible: false, width: 'w-40' },
  { key: 'successor_lei', labelKey: 'leiRecords.columns.labels.successorLei', groupKey: 'leiRecords.columns.groups.associated', defaultVisible: false, width: 'w-44' },

  // Validation
  { key: 'validation_authority', labelKey: 'leiRecords.columns.labels.validationAuthority', groupKey: 'leiRecords.columns.groups.validation', defaultVisible: false, width: 'w-40' },
]

// Pre-computed default visible column keys for use as preference default value.
const DEFAULT_VISIBLE_KEYS = AVAILABLE_COLUMNS.filter(col => col.defaultVisible).map(col => col.key).join(',')
const COUNTRY_DETAIL_ORDER = ['code', 'name', 'alpha3_code', 'region', 'active']

export default function LEIRecordsPage() {
  const { t } = useTranslation('common')
  const { getEnglishTooltip } = useEnglishTooltips()
  const { formatLabel } = useButtonEmojiMode()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
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
  const [countryOptions, setCountryOptions] = useState<Country[]>([])
  const [languagesByCode, setLanguagesByCode] = useState<Map<string, LanguageOption>>(new Map())
  const [regionNameByCode, setRegionNameByCode] = useState<Map<string, string>>(new Map())
  const [legalFormNameByCode, setLegalFormNameByCode] = useState<Map<string, string>>(new Map())
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [hasMorePages, setHasMorePages] = useState(false)
  const [sortField, setSortField] = useState<keyof LEIRecord | ''>('')  // Empty: let backend decide (Hybrid Approach)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [filterBarHeight, setFilterBarHeight] = useState(0)
  const countryDropdownRef = useRef<HTMLDivElement>(null)
  const filterBarRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  useSearchFocusShortcut(searchInputRef)

  // Preference-backed column visibility – serialised as a comma-separated list in the store.
  const [storedColumns, setStoredColumns] = useUserPreference('lei-records', 'visible_columns', DEFAULT_VISIBLE_KEYS)
  const expandedWidthPreference = useDeferredBooleanPreference({
    pageKey: 'lei-records',
    preferenceKey: 'expanded_width',
    defaultValue: false,
  })
  const locationDisplayPreference = useDeferredBooleanPreference({
    pageKey: 'lei-records',
    preferenceKey: 'display_location_codes',
    defaultValue: false,
  })

  const visibleColumns = useMemo<Set<keyof LEIRecord>>(() => {
    if (!storedColumns) return new Set(AVAILABLE_COLUMNS.filter(col => col.defaultVisible).map(col => col.key))
    return new Set(storedColumns.split(',').filter(Boolean) as Array<keyof LEIRecord>)
  }, [storedColumns])

  // Prompt to save preference when user changes columns or width.
  const [showColumnSavePrompt, setShowColumnSavePrompt] = useState(false)
  // Incrementing these counters resets the 8-second auto-dismiss timer in
  // PreferenceSavePrompt so users always get 8 s from their *last* change.
  const [columnSaveVersion, setColumnSaveVersion] = useState(0)
  // Track whether the current value differs from the stored preference.
  const pendingColumns = useRef<Set<keyof LEIRecord> | null>(null)
  const previousColumns = useRef<string | null>(null)

  // Apply pending column changes immediately (local state) even before saving.
  const [localColumns, setLocalColumns] = useState<Set<keyof LEIRecord> | null>(null)
  const [showColumnUndoToast, setShowColumnUndoToast] = useState(false)
  const [columnUndoVersion, setColumnUndoVersion] = useState(0)

  const effectiveVisibleColumns = localColumns ?? visibleColumns
  const [hasHydrated, setHasHydrated] = useState(false)
  const effectiveExpandedWidth = hasHydrated ? expandedWidthPreference.value : false
  const showLocationCodes = locationDisplayPreference.value

  useEffect(() => {
    setHasHydrated(true)
  }, [])

  const handleSetVisibleColumns = useCallback((newCols: Set<keyof LEIRecord>) => {
    setLocalColumns(newCols)
    pendingColumns.current = newCols
    setShowColumnSavePrompt(true)
    setColumnSaveVersion(v => v + 1)
  }, [])

  const handleSaveColumns = useCallback(() => {
    if (pendingColumns.current) {
      previousColumns.current = storedColumns
      setStoredColumns(Array.from(pendingColumns.current).join(','))
      setLocalColumns(null)
      pendingColumns.current = null
    }
    setShowColumnSavePrompt(false)
    setShowColumnUndoToast(true)
    setColumnUndoVersion(v => v + 1)
  }, [setStoredColumns, storedColumns])

  const handleDismissColumns = useCallback(() => {
    setShowColumnSavePrompt(false)
  }, [])

  const handleUndoColumns = useCallback(() => {
    if (previousColumns.current !== null) {
      setStoredColumns(previousColumns.current)
      setLocalColumns(null)
      previousColumns.current = null
    }
    setShowColumnUndoToast(false)
  }, [setStoredColumns])

  const handleUndoDismissColumns = useCallback(() => {
    setShowColumnUndoToast(false)
  }, [])

  const toggleLocationDisplayMode = locationDisplayPreference.toggle

  // New features
  const [selectedRecord, setSelectedRecord] = useState<LEIRecord | null>(null)
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [managingLouName, setManagingLouName] = useState<string | null>(null)
  const [managingLouNameLoading, setManagingLouNameLoading] = useState(false)
  const [managingLouNames, setManagingLouNames] = useState<Map<string, string | null>>(new Map())
  const [successorLeiName, setSuccessorLeiName] = useState<string | null>(null)
  const [successorLeiNameLoading, setSuccessorLeiNameLoading] = useState(false)
  const [successorLeiNames, setSuccessorLeiNames] = useState<Map<string, string | null>>(new Map())
  const [predecessorLeiReferences, setPredecessorLeiReferences] = useState<RelatedLEIReference[]>([])
  const [predecessorLeiCache, setPredecessorLeiCache] = useState<Map<string, RelatedLEIReference[]>>(new Map())
  const [predecessorLeiLoading, setPredecessorLeiLoading] = useState(false)
  const [stickyColumnWidths, setStickyColumnWidths] = useState<number[]>([])
  const [dateDisplayMode, setDateDisplayMode] = useState<'relative' | 'absolute'>('relative')
  const [raUrlTemplates, setRaUrlTemplates] = useState<Record<string, Array<{ name: string; url: string }>>>({})
  const recordsRequestControllerRef = useRef<AbortController | null>(null)
  const detailRequestControllerRef = useRef<AbortController | null>(null)

  // Context menu state (right-click on table row)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; record: LEIRecord } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const contextMenuViewDetailsRef = useRef<HTMLButtonElement>(null)
  const contextMenuAuditHistoryRef = useRef<HTMLButtonElement>(null)

  // Registration number lookup dropdown state
  const [regNumDropdown, setRegNumDropdown] = useState<{ key: string; x: number; y: number; options: RegistrationLookupOption[] } | null>(null)
  const regNumDropdownRef = useRef<HTMLDivElement>(null)

  // Audit history modal state
  const [auditRecord, setAuditRecord] = useState<LEIRecord | null>(null)

  const API_BASE_URL = typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080')
    : 'http://backend:8080'
  const { count: totalRecordsCount } = useCachedLeiCount(API_BASE_URL, { pollMs: 30000 })
  const totalRecords = totalRecordsCount ?? 0

  const normalizeLeiCode = useCallback((value: string | null | undefined): string => {
    return String(value || '').trim().toUpperCase()
  }, [])

  const statusOptions = ['ACTIVE', 'INACTIVE', 'LAPSED', 'MERGED', 'RETIRED', 'NULL']

  useEffect(() => {
    if (typeof window === 'undefined') return
    const rawToken = localStorage.getItem('axiom_token')
    const normalizedToken = rawToken?.replace(/^Bearer\s+/i, '').trim() ?? ''
    setIsLoggedIn(normalizedToken !== '' && normalizedToken !== 'undefined' && normalizedToken !== 'null')
  }, [])

  const backHref = isLoggedIn ? '/dashboard' : '/home'

  const isNotSetStatusFilterValue = useCallback((value: string): boolean => {
    const normalized = value.trim().replaceAll(' ', '_').toUpperCase()
    return normalized === 'NULL' || normalized === 'NOT_SET'
  }, [])

  const formatStatusFilterLabel = useCallback((value: string): string => {
    return isNotSetStatusFilterValue(value) ? 'Not Set' : value
  }, [isNotSetStatusFilterValue])

  const normalizeStatusFilterForAPI = useCallback((value: string): string => {
    return isNotSetStatusFilterValue(value) ? 'NULL' : value
  }, [isNotSetStatusFilterValue])

  const categoryOptions = useMemo(() => {
    const values = new Set<string>()

    records.forEach((record) => {
      const category = (record.entity_category || '').trim()
      if (category && category.toUpperCase() !== 'NULL') {
        values.add(category)
      }
    })

    if (categoryFilter && categoryFilter.trim() !== '') {
      values.add(categoryFilter.trim())
    }

    return Array.from(values).sort((lhs, rhs) => lhs.localeCompare(rhs))
  }, [categoryFilter, records])

  const countryByCode = useMemo(() => {
    const map = new Map<string, Country>()
    countryOptions.forEach((country) => {
      const code = String(country?.code || '').trim().toUpperCase()
      if (code) {
        map.set(code, country)
      }
    })
    return map
  }, [countryOptions])

  // Fetch country list on mount.
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const countriesResult = await fetch(`${API_BASE_URL}/api/v1/lei-countries`)

        if (countriesResult.ok) {
          const data: Country[] = await countriesResult.json()
          // Sort by country name
          const sortedCountries = (data || []).sort((a, b) => a.name.localeCompare(b.name))
          setCountryOptions(sortedCountries)
        }
      } catch {
        // Optional filter metadata should not block page rendering.
      }
    }
    fetchFilterOptions()
  }, [API_BASE_URL])

  // Fetch language metadata for rendering other_names.language values.
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/languages?limit=500&offset=0`, {
          headers: {
            Accept: 'application/json',
          },
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
        // Non-blocking: other_names can still render language codes.
      }
    }

    fetchLanguages()
  }, [API_BASE_URL])

  // Fetch RA URL templates from public JSON file
  useEffect(() => {
    fetch('/data/ra-urls.json')
      .then(r => r.json())
      .then((data: Record<string, unknown>) => {
        const parsed: Record<string, Array<{ name: string; url: string }>> = {}
        for (const [key, value] of Object.entries(data)) {
          if (key !== '_comment' && Array.isArray(value)) {
            const validated = value.filter(
              (item): item is { name: string; url: string } =>
                typeof item === 'object' && item !== null &&
                typeof (item as Record<string, unknown>).name === 'string' &&
                typeof (item as Record<string, unknown>).url === 'string',
            )
            if (validated.length > 0) parsed[key] = validated
          }
        }
        setRaUrlTemplates(parsed)
      })
      .catch((err) => { console.error('[ra-urls] Failed to load RA URL templates:', err) })
  }, [])

  // Close country dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setShowCountryDropdown(false)
      }
      if (regNumDropdownRef.current && !regNumDropdownRef.current.contains(event.target as Node)) {
        setRegNumDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close popups with Escape key
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Close in priority order: modal -> column selector -> regNumDropdown -> country dropdown
        if (selectedRecord) {
          setSelectedRecord(null)
        } else if (showColumnSelector) {
          setShowColumnSelector(false)
        } else if (regNumDropdown) {
          setRegNumDropdown(null)
        } else if (showCountryDropdown) {
          setShowCountryDropdown(false)
        }
      }
    }
    document.addEventListener('keydown', handleEscapeKey)
    return () => document.removeEventListener('keydown', handleEscapeKey)
  }, [selectedRecord, showColumnSelector, regNumDropdown, showCountryDropdown])

  // Debounce search input (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setCurrentPage(1) // Reset to page 1 when search changes
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const fetchRecords = useCallback(async () => {
    if (recordsRequestControllerRef.current) {
      recordsRequestControllerRef.current.abort()
    }

    const controller = new AbortController()
    recordsRequestControllerRef.current = controller
    const timeoutId = window.setTimeout(() => controller.abort(), 15000)

    try {
      setLoading(true)
      const offset = (currentPage - 1) * itemsPerPage
      
      // Request one extra record to detect if there are more pages
      const params = new URLSearchParams({
        limit: (itemsPerPage + 1).toString(),
        offset: offset.toString(),
      })
      
      if (debouncedSearch) params.append('search', debouncedSearch)
      if (statusFilter) params.append('status', normalizeStatusFilterForAPI(statusFilter))
      if (categoryFilter) params.append('category', categoryFilter)
      if (countryFilter) params.append('country', countryFilter)

      // Preserve backend default ordering unless user explicitly chooses a column sort.
      if (sortField && !isVirtualColumnKey(sortField)) {
        params.append('sortBy', sortField)
        params.append('sortOrder', sortDirection)
      }
      
      // Send visible columns for dynamic SELECT optimization
      // Backend will fetch only the columns requested
      // Always include other_names for search result display (shown inline with legal_name)
      const columnsToFetch = Array.from(effectiveVisibleColumns).filter(key => !isVirtualColumnKey(key))
      const dependentColumns = getDependentColumnsForVisibleColumns(effectiveVisibleColumns)
      dependentColumns.forEach((column) => {
        if (!columnsToFetch.includes(column)) {
          columnsToFetch.push(column)
        }
      })
      if (!columnsToFetch.includes('other_names')) {
        columnsToFetch.push('other_names')
      }
      // Fetch registration_number alongside registration_authority so the ▾ lookup link
      // can resolve the registration authority URL even when the number column is hidden (#269)
      if (columnsToFetch.includes('registration_authority') && !columnsToFetch.includes('registration_number')) {
        columnsToFetch.push('registration_number')
      }
      const columnsParam = columnsToFetch.join(',')
      if (columnsParam) params.append('columns', columnsParam)

      const response = await fetch(
        `${API_BASE_URL}/api/v1/lei?${params.toString()}`,
        {
          headers: {
            'Accept': 'application/json'
          },
          signal: controller.signal,
        }
      )

      if (response.ok) {
        const data = await response.json()
        // If we got more than requested, there are more pages - only show the requested amount
        const hasMorePages = data && data.length > itemsPerPage
        const displayData = hasMorePages ? data.slice(0, itemsPerPage) : (data || [])
        const normalizedDisplayData = displayData.map((record: LEIRecord) => normalizeRecordNullLikeValues(record))
        
        setRecords(normalizedDisplayData)
        setHasMorePages(hasMorePages)
        
        if (!normalizedDisplayData || normalizedDisplayData.length === 0) {
          setError('No LEI data matches the selected filters.')
        } else {
          setError(null)
        }
      } else {
        setError(`API returned ${response.status}: ${response.statusText}`)
      }
    } catch (err) {
      if (controller.signal.aborted) {
        if (recordsRequestControllerRef.current !== controller) {
          return
        }
        setError('The LEI request took too long. Please retry or narrow your filters.')
      } else {
        console.error('LEI Records fetch error:', err)
        setError('Unable to connect to backend API.')
      }
    } finally {
      window.clearTimeout(timeoutId)
      if (recordsRequestControllerRef.current === controller) {
        recordsRequestControllerRef.current = null
        setLoading(false)
      }
    }
  }, [
    API_BASE_URL,
    categoryFilter,
    countryFilter,
    currentPage,
    debouncedSearch,
    effectiveVisibleColumns,
    itemsPerPage,
    normalizeStatusFilterForAPI,
    sortDirection,
    sortField,
    statusFilter,
  ])

  useEffect(() => {
    return () => {
      if (recordsRequestControllerRef.current) {
        recordsRequestControllerRef.current.abort()
      }
    }
  }, [])

  // Fetch records when filters, page, or visible columns change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchRecords()
    }
  }, [fetchRecords])

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('')
    setCategoryFilter('')
    setCountryFilter('')
    setCountrySearch('')
    setCurrentPage(1)
  }

  const handleSort = (field: keyof LEIRecord) => {
    if (isVirtualColumnKey(field)) {
      return
    }

    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

  const toggleColumn = (columnKey: keyof LEIRecord) => {
    const newColumns = new Set(effectiveVisibleColumns)
    if (newColumns.has(columnKey)) {
      newColumns.delete(columnKey)
    } else {
      newColumns.add(columnKey)
    }
    handleSetVisibleColumns(newColumns)
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

  // Shared helper: batch-fetch legal names for a set of LEI codes using a single HTTP request.
  // Returns a map of LEI code -> legal name for codes found in the database.
  const fetchLegalNamesBatch = useCallback(async (codes: string[]): Promise<Map<string, string>> => {
    if (codes.length === 0) return new Map()
    const params = new URLSearchParams({ codes: codes.join(',') })
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/lei/names?${params}`)
      if (!response.ok) return new Map()
      const data: Record<string, string> = await response.json()
      return new Map(Object.entries(data))
    } catch {
      return new Map()
    }
  }, [API_BASE_URL])

  const fetchLeiDetailRecord = useCallback(async (leiCode: string): Promise<LEIRecord | null> => {
    const normalizedLeiCode = normalizeLeiCode(leiCode)
    if (!normalizedLeiCode) {
      return null
    }

    if (detailRequestControllerRef.current) {
      detailRequestControllerRef.current.abort()
    }

    const controller = new AbortController()
    detailRequestControllerRef.current = controller

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/lei/${normalizedLeiCode}`, {
        signal: controller.signal,
      })
      if (!response.ok) {
        return null
      }

      const fullRecord = await response.json()
      return normalizeRecordNullLikeValues(fullRecord)
    } catch (err) {
      if (controller.signal.aborted) {
        return null
      }
      console.error('Error fetching complete record:', err)
      return null
    } finally {
      if (detailRequestControllerRef.current === controller) {
        detailRequestControllerRef.current = null
      }
    }
  }, [API_BASE_URL, normalizeLeiCode])

  // Handler to fetch complete record for detail view
  const handleRecordClick = async (partialRecord: LEIRecord) => {
    const fullRecord = await fetchLeiDetailRecord(partialRecord.lei)
    if (fullRecord) {
      setSelectedRecord(fullRecord)
      return
    }

    setSelectedRecord(normalizeRecordNullLikeValues(partialRecord))
  }

  // Right-click context menu handler
  const handleRowContextMenu = useCallback((event: ReactMouseEvent, record: LEIRecord) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({ x: event.clientX, y: event.clientY, record })
  }, [])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  // Close context menu on outside click or ESC
  useEffect(() => {
    const handleClick = () => closeContextMenu()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu()
    }
    if (contextMenu) {
      document.addEventListener('click', handleClick)
      document.addEventListener('keydown', handleKey)
    }
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [contextMenu, closeContextMenu])

  // Focus context menu on open
  useEffect(() => {
    if (contextMenu && contextMenuRef.current) {
      contextMenuRef.current.focus()
    }
  }, [contextMenu])

  useEffect(() => {
    return () => {
      if (detailRequestControllerRef.current) {
        detailRequestControllerRef.current.abort()
      }
    }
  }, [])

  const handleLinkedLeiClick = async (event: ReactMouseEvent, leiCode: string) => {
    event.stopPropagation()
    const fullRecord = await fetchLeiDetailRecord(leiCode)
    if (!fullRecord) {
      return
    }

    setSelectedRecord(fullRecord)
  }

  /** Called from LEIAuditHistoryModal when the user clicks a LEI link (managing_lou / successor_lei). */
  const handleAuditLeiClick = useCallback((leiCode: string) => {
    const normalizedLeiCode = (leiCode || '').trim()
    if (!normalizedLeiCode) return
    // Close the audit modal then open the detail modal for the clicked LEI
    setAuditRecord(null)
    void fetchLeiDetailRecord(normalizedLeiCode)
      .then((record) => {
        if (record) {
          setSelectedRecord(record)
        }
      })
      .catch(() => { /* best-effort: user may retry manually */ })
  }, [fetchLeiDetailRecord])

  // Fetch managing LOU name when modal opens
  useEffect(() => {
    const fetchManagingLouName = async () => {
      if (!selectedRecord?.managing_lou) {
        setManagingLouName(null)
        setManagingLouNameLoading(false)
        return
      }

      setManagingLouNameLoading(true)
      setManagingLouName(null)

      try {
        const names = await fetchLegalNamesBatch([selectedRecord.managing_lou])
        setManagingLouName(names.get(selectedRecord.managing_lou) || null)
      } catch (err) {
        console.error('Failed to fetch managing LOU name:', err)
        setManagingLouName(null)
      } finally {
        setManagingLouNameLoading(false)
      }
    }

    fetchManagingLouName()
  }, [fetchLegalNamesBatch, selectedRecord])

  // Fetch successor LEI name when modal opens
  useEffect(() => {
    const fetchSuccessorLeiName = async () => {
      if (!selectedRecord?.successor_lei) {
        setSuccessorLeiName(null)
        setSuccessorLeiNameLoading(false)
        return
      }

      setSuccessorLeiNameLoading(true)
      setSuccessorLeiName(null)

      try {
        const names = await fetchLegalNamesBatch([selectedRecord.successor_lei])
        setSuccessorLeiName(names.get(selectedRecord.successor_lei) || null)
      } catch {
        setSuccessorLeiName(null)
      } finally {
        setSuccessorLeiNameLoading(false)
      }
    }

    fetchSuccessorLeiName()
  }, [fetchLegalNamesBatch, selectedRecord])

  // Fetch predecessor LEI references that point to the selected LEI as successor.
  useEffect(() => {
    const fetchPredecessorLeiReferences = async () => {
      if (!selectedRecord?.lei) {
        setPredecessorLeiReferences([])
        setPredecessorLeiLoading(false)
        return
      }

      const selectedLei = selectedRecord.lei.trim()
      const cachedReferences = predecessorLeiCache.get(selectedLei)
      if (cachedReferences) {
        setPredecessorLeiReferences(cachedReferences)
        setPredecessorLeiLoading(false)
        return
      }

      setPredecessorLeiLoading(true)

      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/lei/${selectedLei}/predecessors`)
        if (!response.ok) {
          setPredecessorLeiReferences([])
          setPredecessorLeiCache((previous) => {
            const next = new Map(previous)
            next.set(selectedLei, [])
            return next
          })
          return
        }

        const data: LEIRecord[] = await response.json()
        const references = (data || [])
          .filter((record) => (record?.lei || '').trim() !== '')
          .map((record) => ({
            lei: String(record.lei || '').trim(),
            legal_name: String(record.legal_name || '').trim(),
          }))

        setPredecessorLeiReferences(references)
        setPredecessorLeiCache((previous) => {
          const next = new Map(previous)
          next.set(selectedLei, references)
          return next
        })
      } catch {
        setPredecessorLeiReferences([])
        setPredecessorLeiCache((previous) => {
          const next = new Map(previous)
          next.set(selectedLei, [])
          return next
        })
      } finally {
        setPredecessorLeiLoading(false)
      }
    }

    fetchPredecessorLeiReferences()
  }, [selectedRecord?.lei, API_BASE_URL, predecessorLeiCache])

  const mergeNameCacheWithMisses = useCallback(
    (
      previous: Map<string, string | null>,
      requestedCodes: string[],
      fetched: Map<string, string>
    ): Map<string, string | null> => {
      const next = new Map(previous)
      requestedCodes.forEach((code) => {
        next.set(code, fetched.get(code) ?? null)
      })
      return next
    },
    []
  )

  // Fetch managing LOU names for all records in table (single batch request).
  useEffect(() => {
    const fetchManagingLouNamesForTable = async () => {
      const uniqueLouCodes = Array.from(
        new Set(
          records
            .map((r) => normalizeLeiCode(r.managing_lou))
            .filter((code): code is string => code !== '')
        )
      )

      if (uniqueLouCodes.length === 0) return

      const codesToFetch = uniqueLouCodes.filter((code) => !managingLouNames.has(code))
      if (codesToFetch.length === 0) return

      const fetched = await fetchLegalNamesBatch(codesToFetch)

      setManagingLouNames((prev) => {
        return mergeNameCacheWithMisses(prev, codesToFetch, fetched)
      })
    }

    if (records.length > 0) {
      fetchManagingLouNamesForTable()
    }
  }, [records, managingLouNames, fetchLegalNamesBatch, mergeNameCacheWithMisses, normalizeLeiCode])

  // Fetch successor LEI names for all records in table (single batch request).
  useEffect(() => {
    const fetchSuccessorLeiNamesForTable = async () => {
      const uniqueSuccessorLeiCodes = Array.from(
        new Set(
          records
            .map((r) => normalizeLeiCode(r.successor_lei))
            .filter((code): code is string => code !== '')
        )
      )

      if (uniqueSuccessorLeiCodes.length === 0) return

      const codesToFetch = uniqueSuccessorLeiCodes.filter((code) => !successorLeiNames.has(code))
      if (codesToFetch.length === 0) return

      const fetched = await fetchLegalNamesBatch(codesToFetch)

      setSuccessorLeiNames((prev) => {
        return mergeNameCacheWithMisses(prev, codesToFetch, fetched)
      })
    }

    if (records.length > 0) {
      fetchSuccessorLeiNamesForTable()
    }
  }, [records, successorLeiNames, fetchLegalNamesBatch, mergeNameCacheWithMisses, normalizeLeiCode])


  const formatCellValue = (value: any, key: keyof LEIRecord): string => {
    return formatLEICellValue(value, key)
  }

  const isVirtualColumnKey = (key: keyof LEIRecord): boolean => {
    return Object.prototype.hasOwnProperty.call(VIRTUAL_COLUMN_DEPENDENCIES, key)
  }

  const getDependentColumnsForVisibleColumns = (columns: Set<keyof LEIRecord>): Array<keyof LEIRecord> => {
    const requiredColumns = new Set<keyof LEIRecord>()

    columns.forEach((column) => {
      const dependencies = VIRTUAL_COLUMN_DEPENDENCIES[column]
      if (!dependencies) {
        return
      }

      dependencies.forEach((dependency) => requiredColumns.add(dependency))
    })

    return Array.from(requiredColumns)
  }

  const getCountryNameByCode = (countryCode: string): string | null => {
    const normalizedCode = (countryCode || '').trim().toUpperCase()
    if (!normalizedCode) return null

    return countryByCode.get(normalizedCode)?.name || null
  }

  const getCountryDetailsByCode = (countryCode: string): Country | undefined => {
    const normalizedCode = (countryCode || '').trim().toUpperCase()
    if (!normalizedCode) return undefined

    return countryByCode.get(normalizedCode)
  }

  const getRegionNameByCode = (regionCode: string): string | null => {
    const normalizedCode = (regionCode || '').trim().toUpperCase()
    if (!normalizedCode) return null

    return regionNameByCode.get(normalizedCode) || null
  }

  const getLegalFormNameByCode = (legalFormCode: string): string | null => {
    const normalizedCode = (legalFormCode || '').trim().toUpperCase()
    if (!normalizedCode) return null

    return legalFormNameByCode.get(normalizedCode) || null
  }

  const formatCountryDisplay = (countryCode: string): string => {
    const normalizedCode = (countryCode || '').trim().toUpperCase()
    if (!normalizedCode) {
      return '-'
    }

    const countryName = getCountryNameByCode(normalizedCode)
    if (showLocationCodes) {
      return normalizedCode
    }

    return countryName || normalizedCode
  }

  const formatRegionDisplay = (regionCode: string): string => {
    const normalizedCode = (regionCode || '').trim().toUpperCase()
    if (!normalizedCode) {
      return '-'
    }

    const regionName = getRegionNameByCode(normalizedCode)
    if (showLocationCodes) {
      return normalizedCode
    }

    return regionName || normalizedCode
  }

  const formatLegalFormDisplay = (legalFormCode: string): string => {
    const normalizedCode = (legalFormCode || '').trim().toUpperCase()
    if (!normalizedCode) {
      return '-'
    }

    const legalFormName = getLegalFormNameByCode(normalizedCode)
    if (showLocationCodes) {
      return normalizedCode
    }

    return legalFormName || normalizedCode
  }

  const getColumnLabel = (column: ColumnConfig): string => {
    if (column.key === 'entity_legal_form') {
      return showLocationCodes ? t('leiRecords.columns.labels.legalFormCode') : t('leiRecords.columns.labels.legalFormName')
    }
    if (column.key === 'legal_address_region') {
      return showLocationCodes ? t('leiRecords.columns.labels.regionCode') : t('leiRecords.columns.labels.regionName')
    }
    if (column.key === 'hq_address_region') {
      return showLocationCodes ? t('leiRecords.columns.labels.hqRegionCode') : t('leiRecords.columns.labels.hqRegionName')
    }
    if (column.key === 'legal_address_country') {
      return showLocationCodes ? t('leiRecords.columns.labels.countryCode') : t('leiRecords.columns.labels.countryName')
    }
    if (column.key === 'hq_address_country') {
      return showLocationCodes ? t('leiRecords.columns.labels.hqCountryCode') : t('leiRecords.columns.labels.hqCountryName')
    }
    return t(column.labelKey)
  }

  const getColumnLabelTranslationKey = (column: ColumnConfig): string => {
    if (column.key === 'entity_legal_form') {
      return showLocationCodes ? 'leiRecords.columns.labels.legalFormCode' : 'leiRecords.columns.labels.legalFormName'
    }
    if (column.key === 'legal_address_region') {
      return showLocationCodes ? 'leiRecords.columns.labels.regionCode' : 'leiRecords.columns.labels.regionName'
    }
    if (column.key === 'hq_address_region') {
      return showLocationCodes ? 'leiRecords.columns.labels.hqRegionCode' : 'leiRecords.columns.labels.hqRegionName'
    }
    if (column.key === 'legal_address_country') {
      return showLocationCodes ? 'leiRecords.columns.labels.countryCode' : 'leiRecords.columns.labels.countryName'
    }
    if (column.key === 'hq_address_country') {
      return showLocationCodes ? 'leiRecords.columns.labels.hqCountryCode' : 'leiRecords.columns.labels.hqCountryName'
    }
    return column.labelKey
  }

  const isHqAddressSameAsLegal = (record: LEIRecord): boolean => {
    // Helper to normalize empty values (null, undefined, "") to null for comparison
    const normalize = (val: string | null | undefined): string | null => {
      return (val === null || val === undefined || val === '') ? null : val
    }
    
    // Check if all HQ address fields match legal address fields
    return (
      normalize(record.hq_address_line_1) === normalize(record.legal_address_line_1) &&
      normalize(record.hq_address_line_2) === normalize(record.legal_address_line_2) &&
      normalize(record.hq_address_line_3) === normalize(record.legal_address_line_3) &&
      normalize(record.hq_address_line_4) === normalize(record.legal_address_line_4) &&
      normalize(record.hq_address_city) === normalize(record.legal_address_city) &&
      normalize(record.hq_address_region) === normalize(record.legal_address_region) &&
      normalize(record.hq_address_country) === normalize(record.legal_address_country) &&
      normalize(record.hq_address_postal_code) === normalize(record.legal_address_postal_code)
    )
  }

  const getColumnsByGroup = () => {
    const groups: Record<string, ColumnConfig[]> = {}
    AVAILABLE_COLUMNS.forEach(col => {
      if (!groups[col.groupKey]) groups[col.groupKey] = []
      groups[col.groupKey].push(col)
    })
    return groups
  }

  const toggleGroupColumns = (groupKey: string) => {
    const groupColumns = AVAILABLE_COLUMNS.filter(col => col.groupKey === groupKey)
    const allGroupColumnsVisible = groupColumns.every(col => effectiveVisibleColumns.has(col.key))

    const newVisibleColumns = new Set(effectiveVisibleColumns)
    if (allGroupColumnsVisible) {
      // If all are visible, hide them all
      groupColumns.forEach(col => newVisibleColumns.delete(col.key))
    } else {
      // If some or none are visible, show them all
      groupColumns.forEach(col => newVisibleColumns.add(col.key))
    }
    handleSetVisibleColumns(newVisibleColumns)
  }

  const isGroupFullySelected = (groupKey: string) => {
    const groupColumns = AVAILABLE_COLUMNS.filter(col => col.groupKey === groupKey)
    return groupColumns.every(col => effectiveVisibleColumns.has(col.key))
  }

  const isGroupPartiallySelected = (groupKey: string) => {
    const groupColumns = AVAILABLE_COLUMNS.filter(col => col.groupKey === groupKey)
    const visibleCount = groupColumns.filter(col => effectiveVisibleColumns.has(col.key)).length
    return visibleCount > 0 && visibleCount < groupColumns.length
  }

  const totalPages = Math.ceil(totalRecords / itemsPerPage)
  const hasActiveFilters = debouncedSearch || statusFilter || categoryFilter || countryFilter
  const visibleColumnsInOrder = AVAILABLE_COLUMNS.filter((col) => effectiveVisibleColumns.has(col.key))
  const LEI_COLUMN_WIDTH_PX = 184
  const leiColumnIndex = visibleColumnsInOrder.findIndex((column) => column.key === 'lei')

  const getMeasuredColumnWidth = (columnIndex: number, fallbackWidth: number): number => {
    if (columnIndex < 0) {
      return fallbackWidth
    }

    const measuredWidth = stickyColumnWidths[columnIndex]
    if (typeof measuredWidth === 'number' && measuredWidth > 0) {
      return measuredWidth
    }

    return fallbackWidth
  }

  const leiColumnWidth = getMeasuredColumnWidth(leiColumnIndex, LEI_COLUMN_WIDTH_PX)

  const getPinnedColumnWidth = (columnKey: keyof LEIRecord): number | null => {
    if (columnKey === 'lei') return leiColumnWidth
    return null
  }

  const getPinnedColumnStyle = (columnKey: keyof LEIRecord, isHeader: boolean) => {
    if (columnKey === 'lei') {
      return {
        position: 'sticky' as const,
        left: 0,
        zIndex: isHeader ? 30 : 24,
      }
    }

    if (columnKey === 'legal_name') {
      return {
        position: 'sticky' as const,
        left: `${leiColumnWidth}px`,
        zIndex: isHeader ? 29 : 23,
      }
    }

    return undefined
  }

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
      <div className="min-h-screen p-8 theme-page">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 theme-spinner"></div>
            <p className="mt-4 opacity-70">{t('leiRecords.loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8 pb-14 theme-page">
      <div className={`${effectiveExpandedWidth ? 'max-w-full' : 'max-w-7xl'} mx-auto transition-all duration-300`}>
        <PageHeader
          title={t('leiRecords.title')}
          subtitle={t('leiRecords.subtitle')}
          titleTooltip={getEnglishTooltip('leiRecords.title')}
          subtitleTooltip={getEnglishTooltip('leiRecords.subtitle')}
          backHref={backHref}
          docsHref={buildDocsUrl('workflows/lei-records/')}
          actions={
            <>
              <button
                onClick={expandedWidthPreference.toggle}
                className="h-9 px-3 rounded-lg theme-btn-neutral theme-focus text-sm font-medium"
                title={effectiveExpandedWidth ? getEnglishTooltip('referenceLayout.normalButton') : getEnglishTooltip('referenceLayout.expandButton')}
                aria-label={effectiveExpandedWidth ? t('referenceLayout.normalButton') : t('referenceLayout.expandButton')}
              >
                {effectiveExpandedWidth ? formatLabel(t('referenceLayout.normalButton')) : formatLabel(t('referenceLayout.expandButton'))}
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="h-9 px-3 rounded-lg theme-btn-neutral theme-focus text-sm font-medium"
                  title={getEnglishTooltip('leiRecords.columns.button')}
                  aria-label={t('leiRecords.columns.button', { count: effectiveVisibleColumns.size })}
                >
                  {formatLabel(t('leiRecords.columns.button', { count: effectiveVisibleColumns.size }))}
                </button>

                {showColumnSelector && (
                  <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto theme-scrollbar theme-dropdown rounded-lg shadow-xl z-50">
                    <div className="sticky top-0 theme-dropdown border-b p-3">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold">{t('leiRecords.columns.selector.title')}</h3>
                        <button
                          onClick={() => setShowColumnSelector(false)}
                          className="theme-text-muted hover:opacity-80"
                          title={t('common.close')}
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <button
                          onClick={() => handleSetVisibleColumns(new Set(AVAILABLE_COLUMNS.map(c => c.key)))}
                          className="px-2 py-1 theme-filterchip rounded"
                          title={getEnglishTooltip('leiRecords.columns.selector.selectAll')}
                        >
                          {t('leiRecords.columns.selector.selectAll')}
                        </button>
                        <button
                          onClick={() => handleSetVisibleColumns(new Set(AVAILABLE_COLUMNS.filter(c => c.defaultVisible).map(c => c.key)))}
                          className="px-2 py-1 theme-btn-neutral rounded"
                          title={getEnglishTooltip('leiRecords.columns.selector.resetToDefault')}
                        >
                          {t('leiRecords.columns.selector.resetToDefault')}
                        </button>
                      </div>
                    </div>

                    {Object.entries(getColumnsByGroup()).map(([groupKey, columns]) => (
                      <div key={groupKey} className="border-b last:border-b-0" style={{ borderColor: 'rgb(var(--border-rgb) / 0.75)' }}>
                        <button
                          type="button"
                          onClick={() => toggleGroupColumns(groupKey)}
                          className="w-full px-3 py-2.5 theme-subtle font-semibold text-sm cursor-pointer transition-colors flex items-center justify-between gap-3 theme-focus"
                          title={getEnglishTooltip('leiRecords.columns.selector.toggleGroup')}
                        >
                          <span className="flex items-center gap-2.5">
                            <span className="text-base leading-none">
                              {isGroupFullySelected(groupKey) ? '☑' : isGroupPartiallySelected(groupKey) ? '◐' : '☐'}
                            </span>
                            <span>{t(groupKey)}</span>
                          </span>
                          <span className="text-xs theme-text-muted font-normal">
                            {columns.filter(c => effectiveVisibleColumns.has(c.key)).length}/{columns.length}
                          </span>
                        </button>
                        <div className="p-2">
                          {columns.map((column) => (
                            <label
                              key={String(column.key)}
                              className="flex items-center gap-2 px-2 py-1.5 theme-table-row-hover transition-colors rounded cursor-pointer text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={effectiveVisibleColumns.has(column.key)}
                                onChange={() => toggleColumn(column.key)}
                                className="rounded"
                              />
                              <span
                                className=""
                                title={getEnglishTooltip(getColumnLabelTranslationKey(column))}
                              >
                                {getColumnLabel(column)}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={toggleLocationDisplayMode}
                className="h-9 px-3 rounded-lg theme-btn-neutral theme-focus text-sm font-medium"
                title={showLocationCodes ? getEnglishTooltip('leiRecords.display.codes') : getEnglishTooltip('leiRecords.display.names')}
                aria-label={showLocationCodes ? t('leiRecords.display.codes') : t('leiRecords.display.names')}
              >
                {formatLabel(showLocationCodes ? t('leiRecords.display.codes') : t('leiRecords.display.names'))}
              </button>
            </>
          }
        />

        {error && (
          <Alert
            variant={error.includes('No LEI data matches') ? 'warning' : 'error'}
            title={error.includes('No LEI data matches') ? '📋 Notice:' : '⚠️ Error:'}
            className="mb-6"
          >
            {error}
          </Alert>
        )}

        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title={t('leiRecords.stats.totalRecords')} titleTooltip={getEnglishTooltip('leiRecords.stats.totalRecords')} value={totalRecords > 0 ? totalRecords.toLocaleString() : '—'} />
          <StatCard
            title={t('leiRecords.stats.currentPage')}
            titleTooltip={getEnglishTooltip('leiRecords.stats.currentPage')}
            value={formatCurrentPageStatValue({
              hasActiveFilters: Boolean(hasActiveFilters),
              currentPage,
              totalPages,
              t,
            })}
          />
          <StatCard
            title={t('leiRecords.stats.showing')}
            titleTooltip={getEnglishTooltip('leiRecords.stats.showing')}
            value={`${((currentPage - 1) * itemsPerPage) + 1}-${computeShowingEnd(currentPage, itemsPerPage, totalRecords, records.length)}`}
          />
        </div>

        {/* Info message about sorting behavior (Hybrid Approach) */}
        {!hasActiveFilters && (
          <Alert variant="info" title={t('leiRecords.infoAlert.title')} className="mb-6">
            {t('leiRecords.infoAlert.message')}
          </Alert>
        )}

        <div className="relative z-40 mb-6 theme-panel border backdrop-blur-sm rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('leiRecords.filters.search')}</label>
              <SearchInputWithOverflowTooltip
                ref={searchInputRef}
                type="text"
                placeholder={t('leiRecords.filters.searchPlaceholder')}
                title={getEnglishTooltip('leiRecords.filters.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border theme-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('leiRecords.filters.status')}</label>
              <ThemedSelect
                value={statusFilter}
                onChange={setStatusFilter}
                ariaLabel={t('leiRecords.filters.status')}
                title={statusFilter || getEnglishTooltip('leiRecords.filters.allStatuses')}
                className="w-full"
                buttonClassName="px-4 py-2"
                options={[
                  { value: '', label: t('leiRecords.filters.allStatuses') },
                  ...statusOptions.map((status) => ({
                    value: status,
                    label: formatStatusFilterLabel(status),
                  })),
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('leiRecords.filters.category')}</label>
              <ThemedSelect
                value={categoryFilter}
                onChange={setCategoryFilter}
                ariaLabel={t('leiRecords.filters.category')}
                title={categoryFilter || getEnglishTooltip('leiRecords.filters.allCategories')}
                className="w-full"
                buttonClassName="px-4 py-2"
                options={[
                  { value: '', label: t('leiRecords.filters.allCategories') },
                  ...categoryOptions.map((category) => ({
                    value: category,
                    label: formatEnumDisplayValue(category),
                  })),
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('leiRecords.filters.country')}</label>
              <div className="relative z-50" ref={countryDropdownRef}>
                <SearchInputWithOverflowTooltip
                  type="text"
                  placeholder={t('leiRecords.filters.countryPlaceholder')}
                  title={getEnglishTooltip('leiRecords.filters.countryPlaceholder')}
                  value={countrySearch}
                  onChange={(e) => {
                    setCountrySearch(e.target.value)
                    setShowCountryDropdown(true)
                  }}
                  onFocus={() => setShowCountryDropdown(true)}
                  className="w-full px-4 py-2 rounded-lg border theme-input"
                />
                
                {showCountryDropdown && (
                  <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto theme-scrollbar theme-dropdown rounded-lg shadow-lg">
                    <button
                      onClick={() => {
                        setCountryFilter('')
                        setCountrySearch('')
                        setShowCountryDropdown(false)
                      }}
                      className="w-full px-4 py-2 text-left theme-table-row-hover border-b"
                      style={{ borderColor: 'rgb(var(--border-rgb) / 0.75)' }}
                    >
                      {t('leiRecords.filters.allCountries')}
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
                          className={`w-full px-4 py-2 text-left theme-table-row-hover text-sm ${
                            countryFilter === country.code
                              ? 'theme-filterchip font-medium'
                              : ''
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
                      <div className="px-4 py-2 theme-text-muted text-sm">
                        {t('leiRecords.filters.noCountriesFound')}
                      </div>
                    )}
                  </div>
                )}
                
                {countryFilter && (
                  <div className="mt-1 text-xs theme-text-muted">
                    {t('leiRecords.filters.filteredBy', { name: countryOptions.find(c => c.code === countryFilter)?.name || countryFilter })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-6 py-2 rounded-lg theme-btn-neutral transition-colors font-medium shadow-sm"
              >
                ✕ {t('common.clearFilters')}
              </button>
            )}
          </div>
        </div>

        {records.length > 0 && (
          <div className="mb-4 flex justify-between items-center">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-lg theme-btn-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('leiRecords.pagination.previous')}
            </button>
            <span className="theme-text-muted">
                {hasActiveFilters || totalPages === 0
                  ? t('leiRecords.pagination.pageFiltered', { page: currentPage, count: records.length })
                  : t('leiRecords.pagination.pageOf', { page: currentPage, total: totalPages.toLocaleString() })}
            </span>
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={isLastPage}
              className="px-4 py-2 rounded-lg theme-btn-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('leiRecords.pagination.next')}
            </button>
          </div>
        )}

        {/* Sticky filter summary bar - shows when scrolling */}
        {hasActiveFilters && (
          <div ref={filterBarRef} className="sticky top-0 z-40 theme-filterbar px-6 py-3 shadow-md rounded-t-lg">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap text-sm">
                <span className="font-medium">{t('leiRecords.filters.activeFilters')}</span>
                {debouncedSearch && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="px-2 py-1 theme-filterchip rounded text-xs font-medium transition-colors flex items-center gap-1"
                  >
                    {t('leiRecords.filters.searchChip', { value: debouncedSearch })} <span className="ml-1">✕</span>
                  </button>
                )}
                {statusFilter && (
                  <button
                    onClick={() => setStatusFilter('')}
                    className="px-2 py-1 theme-filterchip rounded text-xs font-medium transition-colors flex items-center gap-1"
                  >
                    {t('leiRecords.filters.statusChip', { value: formatStatusFilterLabel(statusFilter) })} <span className="ml-1">✕</span>
                  </button>
                )}
                {categoryFilter && (
                  <button
                    onClick={() => setCategoryFilter('')}
                    className="px-2 py-1 theme-filterchip rounded text-xs font-medium transition-colors flex items-center gap-1"
                  >
                    {t('leiRecords.filters.categoryChip', { value: formatEnumDisplayValue(categoryFilter) })} <span className="ml-1">✕</span>
                  </button>
                )}
                {countryFilter && (
                  <button
                    onClick={() => setCountryFilter('')}
                    className="px-2 py-1 theme-filterchip rounded text-xs font-medium transition-colors flex items-center gap-1"
                  >
                    {t('leiRecords.filters.countryChip', { name: countryOptions.find(c => c.code === countryFilter)?.name || countryFilter })} <span className="ml-1">✕</span>
                  </button>
                )}
              </div>
              <button
                onClick={clearFilters}
                className="px-3 py-1 text-xs rounded-lg theme-filterchip-clear transition-colors font-medium shadow-sm"
              >
                ✕ {t('common.clearFilters')}
              </button>
            </div>
          </div>
        )}

        {records.length > 0 ? (
          <div className="relative">
            {/* Loading overlay - Fixed to viewport for visibility when scrolled */}
            {loading && (
              <div className="fixed inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 theme-loader-shell px-8 py-6 rounded-lg shadow-2xl">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 theme-spinner"></div>
                  <p className="text-base font-semibold">{t('leiRecords.loadingResults')}</p>
                </div>
              </div>
            )}

            <SyncedWideTable
              stickyTopOffset={hasActiveFilters ? filterBarHeight : 0}
              dependencyKey={`${effectiveExpandedWidth}-${showLocationCodes}-${visibleColumnsInOrder.map((column) => column.key).join('|')}-${records.length}-${currentPage}-${loading}`}
              tableClassName="min-w-full theme-table-collapse"
              tableStyle={{ tableLayout: 'auto' }}
              stickyHeaderClassName="theme-table-header"
              mainHeaderClassName="theme-table-header"
              bodyClassName="theme-table-shell theme-table-divider"
              topScrollbarClassName="mb-1 overflow-x-auto theme-table-shell border rounded-t-lg"
              stickyContainerClassName="fixed z-30 overflow-x-auto theme-table-shell border-b backdrop-blur-sm shadow-lg transition-all duration-300 ease-in-out"
              containerClassName={`overflow-x-auto theme-table-shell border backdrop-blur-sm shadow-lg transition-opacity duration-200 ${loading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}
              containerStyle={{
                borderTopLeftRadius: hasActiveFilters ? 0 : '0.5rem',
                borderTopRightRadius: hasActiveFilters ? 0 : '0.5rem',
                borderBottomLeftRadius: '0.5rem',
                borderBottomRightRadius: '0.5rem',
                borderTop: hasActiveFilters ? 'none' : undefined,
              }}
              onMainHeaderWidthsChange={(measuredWidths) => {
                setStickyColumnWidths((previousWidths) => {
                  if (
                    previousWidths.length === measuredWidths.length &&
                    previousWidths.every((width, index) => Math.abs(width - measuredWidths[index]) < 0.5)
                  ) {
                    return previousWidths
                  }

                  return measuredWidths
                })
              }}
              headerRow={(
                <tr>
                  {visibleColumnsInOrder.map((column) => (
                    <th
                      key={String(column.key)}
                      onClick={() => handleSort(column.key)}
                      className={`${column.width || 'min-w-40'} ${column.key === 'lei' ? 'px-2' : 'px-4'} py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer transition-colors theme-table-header-cell ${
                        column.key === 'lei' || column.key === 'legal_name' ? "relative bg-[rgb(var(--surface-muted-rgb))] hover:bg-[rgb(var(--surface-muted-rgb))] dark:bg-[rgb(var(--surface-muted-rgb))] dark:hover:bg-[rgb(var(--surface-muted-rgb))] shadow-[inset_-1px_0_0_0_rgba(203,213,225,1)] dark:shadow-[inset_-1px_0_0_0_rgba(55,65,81,1)]" : ''
                      }`}
                      style={(() => {
                        const pinnedWidth = getPinnedColumnWidth(column.key)
                        if (pinnedWidth) {
                          return {
                            ...getPinnedColumnStyle(column.key, true),
                            width: `${pinnedWidth}px`,
                            minWidth: `${pinnedWidth}px`,
                            maxWidth: `${pinnedWidth}px`,
                          }
                        }

                        return getPinnedColumnStyle(column.key, true)
                      })()}
                    >
                      <div
                        className={`flex items-center gap-1 ${column.key === 'lei' || column.key === 'legal_name' ? 'overflow-hidden whitespace-nowrap text-ellipsis' : ''}`}
                        title={getEnglishTooltip(getColumnLabelTranslationKey(column))}
                      >
                        {getColumnLabel(column)}
                        {sortField === column.key && (
                          <span className="theme-sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              )}
              bodyRows={
                <>
                  {records.filter(r => r && r.id).map((record, index) => {
                    return (
                      <tr
                        key={record.id}
                        data-lei={record.lei}
                        data-row-index={index}
                        onClick={() => handleRecordClick(record)}
                        onContextMenu={(e) => handleRowContextMenu(e, record)}
                        className="group theme-table-row-hover transition-colors cursor-pointer"
                        style={{ height: 'auto', minHeight: '48px' }}
                      >
                        {visibleColumnsInOrder.map((column) => {
                          const value = record[column.key]
                          const isStatus = column.key === 'entity_status'
                          const isLeiColumn = column.key === 'lei'
                          const isLegalName = column.key === 'legal_name'
                          const isLegalFormColumn = column.key === 'entity_legal_form'
                          const isManagingLou = column.key === 'managing_lou'
                          const isSuccessorLei = column.key === 'successor_lei'
                          const isRegistrationAuthority = column.key === 'registration_authority'
                          const isRegistrationNumber = column.key === 'registration_number'
                          const isCountryFlagColumn = column.key === 'country_flag'
                          const isRegionColumn = column.key === 'legal_address_region' || column.key === 'hq_address_region'
                          const isCountryColumn = column.key === 'legal_address_country' || column.key === 'hq_address_country'

                          return (
                            <td
                              key={String(column.key)}
                              className={`${column.key === 'lei' ? 'px-2' : 'px-4'} py-3 text-sm ${column.key === 'lei' ? 'font-mono' : ''} ${column.key.includes('date') || column.key === 'lei' ? 'whitespace-nowrap' : ''} ${
                                column.key === 'lei' || column.key === 'legal_name'
                                  ? "relative bg-[rgb(var(--surface-soft-rgb))] dark:bg-[rgb(var(--surface-rgb))] group-hover:bg-[rgb(var(--surface-muted-rgb))] dark:group-hover:bg-[rgb(var(--surface-muted-rgb))] shadow-[inset_-1px_0_0_0_rgba(203,213,225,1)] dark:shadow-[inset_-1px_0_0_0_rgba(55,65,81,1)] overflow-hidden text-ellipsis"
                                  : ''
                              }`}
                              style={(() => {
                                const pinnedWidth = getPinnedColumnWidth(column.key)
                                if (pinnedWidth) {
                                  return {
                                    ...getPinnedColumnStyle(column.key, false),
                                    width: `${pinnedWidth}px`,
                                    minWidth: `${pinnedWidth}px`,
                                    maxWidth: `${pinnedWidth}px`,
                                  }
                                }

                                return getPinnedColumnStyle(column.key, false)
                              })()}
                            >
                              {isLeiColumn ? (
                                <div>
                                  <div className="font-mono">{formatCellValue(value, column.key)}</div>
                                </div>
                              ) : isStatus ? (
                                (() => {
                                  const statusPresentation = getStatusBadgePresentation(value)
                                  return (
                                    <span className={`px-2 py-1 text-xs rounded ${
                                      statusPresentation.isActive
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                        : 'theme-subtle'
                                    }`}>
                                      {statusPresentation.label}
                                    </span>
                                  )
                                })()
                              ) : isManagingLou ? (
                                <div>
                                  <button
                                    type="button"
                                    onClick={(event) => handleLinkedLeiClick(event, normalizeLeiCode(String(value || '')))}
                                    className="font-mono text-left theme-link hover:underline"
                                  >
                                    {formatCellValue(value, column.key)}
                                  </button>
                                  {(() => {
                                    const normalizedValue = value ? normalizeLeiCode(String(value)) : ''
                                    const cachedName = normalizedValue ? managingLouNames.get(normalizedValue) : null
                                    if (!cachedName) return null
                                    return (
                                      <div className="mt-1 text-xs theme-text-muted">
                                        {cachedName}
                                      </div>
                                    )
                                  })()}
                                </div>
                              ) : isSuccessorLei ? (
                                <div>
                                  <button
                                    type="button"
                                    onClick={(event) => handleLinkedLeiClick(event, normalizeLeiCode(String(value || '')))}
                                    className="font-mono text-left theme-link hover:underline"
                                  >
                                    {formatCellValue(value, column.key)}
                                  </button>
                                  {(() => {
                                    const normalizedValue = value ? normalizeLeiCode(String(value)) : ''
                                    const cachedName = normalizedValue ? successorLeiNames.get(normalizedValue) : null
                                    if (!cachedName) return null
                                    return (
                                      <div className="mt-1 text-xs theme-text-muted">
                                        {cachedName}
                                      </div>
                                    )
                                  })()}
                                </div>
                              ) : isLegalName ? (
                                <div>
                                  <div>{formatCellValue(value, column.key)}</div>
                                  <LEIOtherNamesList
                                    otherNamesData={record.other_names}
                                    showCodes={showLocationCodes}
                                    languagesByCode={languagesByCode}
                                  />
                                </div>
                              ) : isCountryColumn ? (
                                <ReferenceDetailList
                                  values={[String(value || '')]}
                                  normalizeValue={(rawValue) => String(rawValue || '').trim().toUpperCase()}
                                  getDisplayValue={(normalizedValue) => formatCountryDisplay(normalizedValue)}
                                  getDetails={(normalizedValue) => getCountryDetailsByCode(normalizedValue)}
                                  preferredOrder={COUNTRY_DETAIL_ORDER}
                                />
                              ) : isCountryFlagColumn ? (
                                <CountryFlag
                                  countryCode={String(record.legal_address_country || '')}
                                  title={formatCountryDisplay(String(record.legal_address_country || ''))}
                                  className="h-4 w-6 rounded-sm border border-[rgb(var(--border-rgb))]"
                                />
                              ) : isRegionColumn ? (
                                formatRegionDisplay(String(value || ''))
                              ) : isLegalFormColumn ? (
                                <div>
                                  <div className="font-mono">{String(value || '-')}</div>
                                  {!showLocationCodes && (record.entity_legal_form_name || formatLegalFormDisplay(String(value || ''))) && (
                                    <div className="mt-1 text-xs theme-text-muted">
                                      {record.entity_legal_form_name || formatLegalFormDisplay(String(value || ''))}
                                    </div>
                                  )}
                                </div>
                              ) : isRegistrationAuthority ? (
                                (() => {
                                  const raCode = String(value || '')
                                  const raName = record.registration_authority_name
                                  const raIntlName = record.registration_authority_international_name
                                  const raWebsite = record.registration_authority_website
                                  const raComments = record.registration_authority_comments
                                  const nameLabel = raName || raCode
                                  const showIntl = raIntlName && raIntlName !== raName
                                  return (
                                    <div className="group/ra" title={raComments || undefined}>
                                      <span className="inline-flex items-center gap-1">
                                        {raWebsite ? (
                                          <a
                                            href={raWebsite}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-mono theme-link hover:underline"
                                            onClick={e => e.stopPropagation()}
                                          >
                                            {raCode}
                                          </a>
                                        ) : (
                                          <span className="font-mono">{raCode || '-'}</span>
                                        )}
                                      </span>
                                      {nameLabel && nameLabel !== raCode && (
                                        <div className="mt-1 text-xs theme-text-muted">
                                          {nameLabel}
                                          {showIntl && <span className="ml-1 opacity-75">({raIntlName})</span>}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()
                              ) : isRegistrationNumber ? (
                                (() => {
                                  const regNum = String(value || '')
                                  const raCode = record.registration_authority
                                  const raTemplates = raCode ? (raUrlTemplates[raCode] ?? []) : []
                                  const lookupOptions = buildLookupOptions(raCode, raTemplates, regNum)
                                  if (!regNum) return <span>-</span>
                                  return (
                                    <div className="group/rn inline-flex items-center gap-1">
                                      <span className="font-mono">{regNum}</span>
                                      {lookupOptions.length > 0 && (
                                        <button
                                          type="button"
                                          className="opacity-0 group-hover/rn:opacity-100 transition-opacity text-xs theme-link"
                                          aria-label={`${t('leiRecords.modal.registrationNumber')}: ${regNum}`}
                                          aria-haspopup="listbox"
                                          aria-expanded={regNumDropdown?.key === record.lei}
                                          title={`${t('leiRecords.modal.registrationNumber')}: ${regNum}`}
                                          onClick={e => {
                                            e.stopPropagation()
                                            const rect = e.currentTarget.getBoundingClientRect()
                                            setRegNumDropdown({
                                              key: record.lei,
                                              x: rect.left,
                                              y: rect.bottom + 4,
                                              options: lookupOptions,
                                            })
                                          }}
                                        >
                                          ▾
                                        </button>
                                      )}
                                    </div>
                                  )
                                })()
                              ) : (
                                formatCellValue(value, column.key)
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </>
              }
            />
          </div>
        ) : (
            <div className="text-center py-12 theme-panel border backdrop-blur-sm rounded-lg">
              <p className="text-xl theme-text-muted">{t('leiRecords.noRecordsFound')}</p>
            </div>
          )}

        {records.length > 0 && (
          <div className="mt-4 flex justify-between items-center flex-wrap gap-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-lg theme-btn-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('leiRecords.pagination.previous')}
            </button>
            <div className="flex items-center gap-4">
              <span className="theme-text-muted">
                {t('leiRecords.pagination.page', { page: currentPage })}{hasActiveFilters && ` (${t('leiRecords.stats.showing').toLowerCase()} ${records.length})`}
              </span>
              <div className="flex items-center gap-2">
                <label htmlFor="items-per-page" className="text-sm theme-text-muted">{t('leiRecords.pagination.itemsPerPage')}</label>
                <ThemedSelect
                  value={String(itemsPerPage)}
                  onChange={(next) => {
                    setItemsPerPage(Number(next))
                    setCurrentPage(1)
                  }}
                  ariaLabel={t('leiRecords.pagination.itemsPerPage')}
                  className="min-w-[5.5rem]"
                  buttonClassName="px-3 py-1 text-sm"
                  options={[
                    { value: '50', label: '50' },
                    { value: '100', label: '100' },
                    { value: '250', label: '250' },
                    { value: '500', label: '500' },
                  ]}
                />
              </div>
            </div>
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={isLastPage}
              className="px-4 py-2 rounded-lg theme-btn-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('leiRecords.pagination.next')}
            </button>
          </div>
        )}

        <div className="mt-8 text-center text-sm text-[rgb(var(--muted-foreground-rgb))]">
          <p>{t('leiRecords.dataSource')}</p>
          <p className="mt-2">
            {t('leiRecords.totalDatabase', { count: totalRecords })} |
            <Link href="/lei" className="ml-1 theme-link hover:opacity-80 underline">
              {t('leiRecords.viewSyncStatus')}
            </Link>
          </p>
        </div>
      </div>

      {/* Detailed View Modal */}
      {selectedRecord && (
        <div
          role="presentation"
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedRecord(null)}
        >
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- role=dialog is interactive per ARIA spec; jsx-a11y does not recognise it as such; stopPropagation is required to prevent backdrop click-to-close from firing on inner clicks */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('leiRecords.modal.title')}
            className="bg-[rgb(var(--surface-rgb))] rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto theme-scrollbar border-2 border-[rgb(var(--border-rgb))]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-[rgb(var(--surface-rgb))] border-b-2 border-[rgb(var(--border-rgb))] p-6 z-10">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-[rgb(var(--foreground-rgb))] mb-2">{t('leiRecords.modal.title')}</h2>
                  <p className="text-lg font-mono text-[rgb(var(--primary-rgb))] dark:text-[rgb(var(--primary-rgb))]">{selectedRecord.lei}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAuditRecord(selectedRecord)}
                    className="px-3 py-2 rounded-lg bg-[rgb(var(--surface-muted-rgb))] hover:bg-[rgb(var(--surface-muted-rgb))] transition-colors text-[rgb(var(--foreground-rgb))] text-sm font-medium"
                    title={t('leiAudit.viewAuditHistory')}
                  >
                    {formatLabel(t('leiAudit.historyButton'))}
                  </button>
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="px-4 py-2 rounded-lg bg-[rgb(var(--surface-muted-rgb))] hover:bg-[rgb(var(--surface-muted-rgb))] dark:bg-[rgb(var(--surface-muted-rgb))] dark:hover:bg-[rgb(var(--surface-muted-rgb))] transition-colors text-[rgb(var(--foreground-rgb))] font-medium"
                  >
                    {formatLabel(t('leiRecords.modal.close'))}
                  </button>
                </div>
              </div>
              {/* Date Display Mode Toggle */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[rgb(var(--muted-foreground-rgb))]">{t('leiRecords.modal.dateDisplay')}</span>
                <button
                  onClick={() => setDateDisplayMode(dateDisplayMode === 'relative' ? 'absolute' : 'relative')}
                  className="px-3 py-1 rounded-lg theme-filterchip transition-colors font-medium"
                >
                  {formatLabel(dateDisplayMode === 'relative' ? t('leiRecords.modal.dateRelative') : t('leiRecords.modal.dateDaysOnly'))}
                </button>
                <span className="text-[rgb(var(--muted-foreground-rgb))] ml-2">{t('leiRecords.modal.display')}</span>
                <button
                  onClick={toggleLocationDisplayMode}
                  className="px-3 py-1 rounded-lg theme-filterchip transition-colors font-medium"
                >
                  {formatLabel(showLocationCodes ? t('leiRecords.display.codes') : t('leiRecords.display.names'))}
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="bg-[rgb(var(--surface-rgb))] pb-6">
              {/* Core Information */}
              <section className="bg-[rgb(var(--surface-rgb))] p-6 pb-0">
                <h3 className="text-lg font-semibold text-[rgb(var(--foreground-rgb))] mb-3 pb-2 border-b border-[rgb(var(--border-rgb))]">
                  {t('leiRecords.modal.coreInformation')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[rgb(var(--surface-rgb))]">
                  <div>
                    <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">Legal Name</span>
                    <p className="text-sm font-semibold text-[rgb(var(--foreground-rgb))] mt-1">{selectedRecord.legal_name}</p>
                  </div>
                  {selectedRecord.transliterated_legal_name && (
                    <div>
                      <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">Transliterated Name</span>
                      <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1">{selectedRecord.transliterated_legal_name}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">Status</span>
                    <p className="mt-1">
                      {(() => {
                        const statusPresentation = getStatusBadgePresentation(selectedRecord.entity_status)
                        return (
                      <span className={`px-2 py-1 text-xs rounded ${
                        statusPresentation.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'theme-subtle'
                      }`}>
                        {statusPresentation.label}
                      </span>
                        )
                      })()}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">Category</span>
                    <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1">{selectedRecord.entity_category || '-'}</p>
                  </div>
                  {selectedRecord.entity_sub_category && (
                    <div>
                      <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">Sub Category</span>
                      <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1">{selectedRecord.entity_sub_category}</p>
                    </div>
                  )}
                  {selectedRecord.entity_legal_form && (
                    <div>
                      <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">Legal Form</span>
                      <p className="text-sm font-mono text-[rgb(var(--foreground-rgb))] mt-1">{selectedRecord.entity_legal_form}</p>
                      {(() => {
                        const elfDisplayName = selectedRecord.entity_legal_form_name || formatLegalFormDisplay(selectedRecord.entity_legal_form)
                        if (elfDisplayName === selectedRecord.entity_legal_form) return null
                        return <p className="text-xs text-[rgb(var(--muted-foreground-rgb))] mt-0.5">{elfDisplayName}</p>
                      })()}
                    </div>
                  )}
                </div>
                <LEIOtherNamesList
                  otherNamesData={selectedRecord.other_names}
                  showCodes={showLocationCodes}
                  languagesByCode={languagesByCode}
                  className="mt-4 pt-4 border-t border-[rgb(var(--border-rgb))]"
                  showLabel={true}
                  label="Other Names"
                  labelClassName="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase"
                  listClassName="mt-2 space-y-1"
                  itemClassName="text-sm text-[rgb(var(--foreground-rgb))]"
                  languageClassName="ml-2 text-xs text-[rgb(var(--muted-foreground-rgb))]"
                />
              </section>

              {/* Addresses - Side by Side with Aligned Fields */}
              <section className="bg-[rgb(var(--surface-rgb))] p-6 pb-0">
                <h3 className="text-lg font-semibold text-[rgb(var(--foreground-rgb))] mb-3 pb-2 border-b border-[rgb(var(--border-rgb))]">
                  {t('leiRecords.modal.addresses')}
                </h3>
                
                {/* Column Headers */}
                <div className="grid grid-cols-2 gap-6 mb-4 bg-[rgb(var(--surface-rgb))]">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-[rgb(var(--muted-foreground-rgb))] uppercase tracking-wide">
                      {t('leiRecords.modal.legalAddress')}
                    </h4>
                    {selectedRecord.legal_address_city && (
                      <MapLink
                        address={{
                          line1: selectedRecord.legal_address_line_1,
                          line2: selectedRecord.legal_address_line_2,
                          line3: selectedRecord.legal_address_line_3,
                          line4: selectedRecord.legal_address_line_4,
                          city: selectedRecord.legal_address_city,
                          region: selectedRecord.legal_address_region,
                          country: getCountryNameByCode(selectedRecord.legal_address_country) || selectedRecord.legal_address_country,
                          postalCode: selectedRecord.legal_address_postal_code,
                        }}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-[rgb(var(--muted-foreground-rgb))] uppercase tracking-wide">
                      {t('leiRecords.modal.hqAddress')}
                    </h4>
                    {!isHqAddressSameAsLegal(selectedRecord) && selectedRecord.hq_address_city && (
                      <MapLink
                        address={{
                          line1: selectedRecord.hq_address_line_1,
                          line2: selectedRecord.hq_address_line_2,
                          line3: selectedRecord.hq_address_line_3,
                          line4: selectedRecord.hq_address_line_4,
                          city: selectedRecord.hq_address_city,
                          region: selectedRecord.hq_address_region,
                          country: getCountryNameByCode(selectedRecord.hq_address_country) || selectedRecord.hq_address_country,
                          postalCode: selectedRecord.hq_address_postal_code,
                        }}
                      />
                    )}
                  </div>
                </div>

                {isHqAddressSameAsLegal(selectedRecord) ? (
                  <div className="space-y-4 bg-[rgb(var(--surface-rgb))]">
                    {/* Address Row - Legal on left, message on right */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">Address</span>
                        <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1">
                          {selectedRecord.legal_address_line_1 || '-'}
                          {selectedRecord.legal_address_line_2 && <><br/>{selectedRecord.legal_address_line_2}</>}
                          {selectedRecord.legal_address_line_3 && <><br/>{selectedRecord.legal_address_line_3}</>}
                          {selectedRecord.legal_address_line_4 && <><br/>{selectedRecord.legal_address_line_4}</>}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">Address</span>
                        <p className="text-sm text-[rgb(var(--muted-foreground-rgb))] italic mt-1">
                          {t('leiRecords.modal.sameAsLegal')}
                        </p>
                      </div>
                    </div>

                    {/* City Row */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">City</span>
                        <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1">{selectedRecord.legal_address_city || '-'}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">City</span>
                        <p className="text-sm text-[rgb(var(--muted-foreground-rgb))] italic mt-1">〃</p>
                      </div>
                    </div>

                    {/* Region Row */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">{showLocationCodes ? 'Region Code' : 'Region Name'}</span>
                        <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1">{formatRegionDisplay(selectedRecord.legal_address_region)}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">{showLocationCodes ? 'Region Code' : 'Region Name'}</span>
                        <p className="text-sm text-[rgb(var(--muted-foreground-rgb))] italic mt-1">〃</p>
                      </div>
                    </div>

                    {/* Country Row */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">{showLocationCodes ? 'Country Code' : 'Country Name'}</span>
                        <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1 flex items-center gap-2">
                          <ReferenceDetailList
                            values={[selectedRecord.legal_address_country]}
                            normalizeValue={(rawValue) => String(rawValue || '').trim().toUpperCase()}
                            getDisplayValue={(normalizedValue) => formatCountryDisplay(normalizedValue)}
                            getDetails={(normalizedValue) => getCountryDetailsByCode(normalizedValue)}
                            preferredOrder={COUNTRY_DETAIL_ORDER}
                          />
                          <CountryFlag
                            countryCode={String(selectedRecord.legal_address_country || '')}
                            title={formatCountryDisplay(selectedRecord.legal_address_country)}
                            className="h-3.5 w-5 rounded-sm border border-[rgb(var(--border-rgb))]"
                          />
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">{showLocationCodes ? 'Country Code' : 'Country Name'}</span>
                        <p className="text-sm text-[rgb(var(--muted-foreground-rgb))] italic mt-1">〃</p>
                      </div>
                    </div>

                    {/* Postal Code Row */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">Postal Code</span>
                        <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1">{selectedRecord.legal_address_postal_code || '-'}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">Postal Code</span>
                        <p className="text-sm text-[rgb(var(--muted-foreground-rgb))] italic mt-1">〃</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 bg-[rgb(var(--surface-rgb))]">
                    {/* Address Row */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">Address</span>
                        <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1">
                          {selectedRecord.legal_address_line_1 || '-'}
                          {selectedRecord.legal_address_line_2 && <><br/>{selectedRecord.legal_address_line_2}</>}
                          {selectedRecord.legal_address_line_3 && <><br/>{selectedRecord.legal_address_line_3}</>}
                          {selectedRecord.legal_address_line_4 && <><br/>{selectedRecord.legal_address_line_4}</>}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">Address</span>
                        <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1">
                          {selectedRecord.hq_address_line_1 || '-'}
                          {selectedRecord.hq_address_line_2 && <><br/>{selectedRecord.hq_address_line_2}</>}
                          {selectedRecord.hq_address_line_3 && <><br/>{selectedRecord.hq_address_line_3}</>}
                          {selectedRecord.hq_address_line_4 && <><br/>{selectedRecord.hq_address_line_4}</>}
                        </p>
                      </div>
                    </div>

                    {/* City Row */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">City</span>
                        <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1">{selectedRecord.legal_address_city || '-'}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">City</span>
                        <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1">{selectedRecord.hq_address_city || '-'}</p>
                      </div>
                    </div>

                    {/* Region Row */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">{showLocationCodes ? 'Region Code' : 'Region Name'}</span>
                        <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1">{formatRegionDisplay(selectedRecord.legal_address_region)}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">{showLocationCodes ? 'Region Code' : 'Region Name'}</span>
                        <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1">{formatRegionDisplay(selectedRecord.hq_address_region)}</p>
                      </div>
                    </div>

                    {/* Country Row */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">{showLocationCodes ? 'Country Code' : 'Country Name'}</span>
                        <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1 flex items-center gap-2">
                          <ReferenceDetailList
                            values={[selectedRecord.legal_address_country]}
                            normalizeValue={(rawValue) => String(rawValue || '').trim().toUpperCase()}
                            getDisplayValue={(normalizedValue) => formatCountryDisplay(normalizedValue)}
                            getDetails={(normalizedValue) => getCountryDetailsByCode(normalizedValue)}
                            preferredOrder={COUNTRY_DETAIL_ORDER}
                          />
                          <CountryFlag
                            countryCode={String(selectedRecord.legal_address_country || '')}
                            title={formatCountryDisplay(selectedRecord.legal_address_country)}
                            className="h-3.5 w-5 rounded-sm border border-[rgb(var(--border-rgb))]"
                          />
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">{showLocationCodes ? 'Country Code' : 'Country Name'}</span>
                        <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1 flex items-center gap-2">
                          <ReferenceDetailList
                            values={[selectedRecord.hq_address_country]}
                            normalizeValue={(rawValue) => String(rawValue || '').trim().toUpperCase()}
                            getDisplayValue={(normalizedValue) => formatCountryDisplay(normalizedValue)}
                            getDetails={(normalizedValue) => getCountryDetailsByCode(normalizedValue)}
                            preferredOrder={COUNTRY_DETAIL_ORDER}
                          />
                          <CountryFlag
                            countryCode={String(selectedRecord.hq_address_country || '')}
                            title={formatCountryDisplay(selectedRecord.hq_address_country)}
                            className="h-3.5 w-5 rounded-sm border border-[rgb(var(--border-rgb))]"
                          />
                        </p>
                      </div>
                    </div>

                    {/* Postal Code Row */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">Postal Code</span>
                        <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1">{selectedRecord.legal_address_postal_code || '-'}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">Postal Code</span>
                        <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1">{selectedRecord.hq_address_postal_code || '-'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Registration Information */}
              <section className="bg-[rgb(var(--surface-rgb))] p-6 pb-0">
                <h3 className="text-lg font-semibold text-[rgb(var(--foreground-rgb))] mb-3 pb-2 border-b border-[rgb(var(--border-rgb))]">
                  {t('leiRecords.modal.registrationInformation')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[rgb(var(--surface-rgb))]">
                  <div>
                    <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">{t('leiRecords.modal.registrationAuthority')}</span>
                    {(() => {
                      const raWebsite = selectedRecord.registration_authority_website
                      const raCode = selectedRecord.registration_authority
                      const raName = selectedRecord.registration_authority_name
                      const raIntlName = selectedRecord.registration_authority_international_name
                      const raComments = selectedRecord.registration_authority_comments
                      const showIntl = raIntlName && raIntlName !== raName
                      return (
                        <>
                          <p className="text-sm font-mono text-[rgb(var(--foreground-rgb))] mt-1" title={raComments || undefined}>
                            {raWebsite ? (
                              <a href={raWebsite} target="_blank" rel="noopener noreferrer" className="theme-link hover:underline">
                                {raCode || '-'}
                              </a>
                            ) : (raCode || '-')}
                          </p>
                          {raName && (
                            <p className="text-xs text-[rgb(var(--muted-foreground-rgb))] mt-0.5">
                              {raName}
                              {showIntl && <span className="ml-1 opacity-75">({raIntlName})</span>}
                            </p>
                          )}
                        </>
                      )
                    })()}
                  </div>
                  <div>
                    <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">{t('leiRecords.modal.registrationNumber')}</span>
                    {(() => {
                      const regNum = selectedRecord.registration_number
                      const raCode = selectedRecord.registration_authority
                      const raTemplates = raCode ? (raUrlTemplates[raCode] ?? []) : []
                      const lookupOptions = buildLookupOptions(raCode, raTemplates, regNum)
                      return (
                        <p className="text-sm font-mono text-[rgb(var(--foreground-rgb))] mt-1">
                          <span className="group/rn-modal inline-flex items-center gap-1">
                            <span>{regNum || '-'}</span>
                            {lookupOptions.length > 0 && regNum && (
                              <button
                                type="button"
                                className="opacity-0 group-hover/rn-modal:opacity-100 transition-opacity text-xs theme-link"
                                aria-label={`${t('leiRecords.modal.registrationNumber')}: ${regNum}`}
                                aria-haspopup="listbox"
                                aria-expanded={regNumDropdown?.key === `modal-${selectedRecord.lei}`}
                                title={`${t('leiRecords.modal.registrationNumber')}: ${regNum}`}
                                onClick={e => {
                                  e.stopPropagation()
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  setRegNumDropdown({
                                    key: `modal-${selectedRecord.lei}`,
                                    x: rect.left,
                                    y: rect.bottom + 4,
                                    options: lookupOptions,
                                  })
                                }}
                              >
                                ▾
                              </button>
                            )}
                          </span>
                        </p>
                      )
                    })()}
                  </div>
                  <div>
                    <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">Initial Registration</span>
                    <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1">
                      {formatCellValue(selectedRecord.initial_registration_date, 'initial_registration_date')}
                      {selectedRecord.initial_registration_date && selectedRecord.initial_registration_date !== '0001-01-01T00:00:00Z' && (
                        <span className="ml-2 text-xs text-[rgb(var(--muted-foreground-rgb))]">
                          ({dateDisplayMode === 'relative' 
                            ? getRelativeTime(selectedRecord.initial_registration_date).relative
                            : `${Math.abs(getRelativeTime(selectedRecord.initial_registration_date).days)} days ago`})
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">Last Updated</span>
                    <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1">
                      {formatCellValue(selectedRecord.last_update_date, 'last_update_date')}
                      {selectedRecord.last_update_date && selectedRecord.last_update_date !== '0001-01-01T00:00:00Z' && (
                        <span className="ml-2 text-xs text-[rgb(var(--muted-foreground-rgb))]">
                          ({dateDisplayMode === 'relative' 
                            ? getRelativeTime(selectedRecord.last_update_date).relative
                            : `${Math.abs(getRelativeTime(selectedRecord.last_update_date).days)} days ago`})
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">Next Renewal</span>
                    <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1">
                      {formatCellValue(selectedRecord.next_renewal_date, 'next_renewal_date')}
                      {selectedRecord.next_renewal_date && selectedRecord.next_renewal_date !== '0001-01-01T00:00:00Z' && (
                        <span className="ml-2 text-xs text-[rgb(var(--muted-foreground-rgb))]">
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
              {(selectedRecord.managing_lou || selectedRecord.successor_lei || predecessorLeiLoading || predecessorLeiReferences.length > 0) && (
                <section className="bg-[rgb(var(--surface-rgb))] p-6 pb-0">
                  <h3 className="text-lg font-semibold text-[rgb(var(--foreground-rgb))] mb-3 pb-2 border-b border-[rgb(var(--border-rgb))]">
                    {t('leiRecords.modal.associatedEntities')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[rgb(var(--surface-rgb))]">
                    <div>
                      <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">{t('leiRecords.modal.predecessorLei')}</span>
                      <div className="mt-1 space-y-2">
                        {predecessorLeiLoading && (
                          <p className="text-xs text-[rgb(var(--muted-foreground-rgb))] dark:text-[rgb(var(--muted-foreground-rgb))] italic">{t('leiRecords.modal.checkingPredecessorLinks')}</p>
                        )}
                        {!predecessorLeiLoading && predecessorLeiReferences.length === 0 && (
                          <p className="text-xs text-[rgb(var(--muted-foreground-rgb))] dark:text-[rgb(var(--muted-foreground-rgb))] italic">{t('leiRecords.modal.noPredecessorLinks')}</p>
                        )}
                        {!predecessorLeiLoading && predecessorLeiReferences.map((reference) => (
                          <div key={reference.lei}>
                            <button
                              type="button"
                              onClick={(event) => handleLinkedLeiClick(event, reference.lei)}
                              className="block font-mono text-sm text-left text-[rgb(var(--primary-rgb))] hover:text-[rgb(var(--primary-rgb))] hover:underline dark:text-[rgb(var(--primary-rgb))] dark:hover:text-[rgb(var(--primary-rgb))]"
                            >
                              {reference.lei}
                            </button>
                            {reference.legal_name && (
                              <p className="text-xs text-[rgb(var(--muted-foreground-rgb))] mt-1">{reference.legal_name}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">{t('leiRecords.modal.successorLei')}</span>
                      {selectedRecord.successor_lei ? (
                        <>
                          <button
                            type="button"
                            onClick={(event) => handleLinkedLeiClick(event, selectedRecord.successor_lei)}
                            className="mt-1 block font-mono text-sm text-left text-[rgb(var(--primary-rgb))] hover:text-[rgb(var(--primary-rgb))] hover:underline dark:text-[rgb(var(--primary-rgb))] dark:hover:text-[rgb(var(--primary-rgb))]"
                          >
                            {selectedRecord.successor_lei}
                          </button>
                          {successorLeiName && (
                            <p className="text-xs text-[rgb(var(--muted-foreground-rgb))] mt-1">{successorLeiName}</p>
                          )}
                          {successorLeiNameLoading && (
                            <p className="text-xs text-[rgb(var(--muted-foreground-rgb))] dark:text-[rgb(var(--muted-foreground-rgb))] mt-1 italic">{t('leiRecords.modal.loadingName')}</p>
                          )}
                          {!successorLeiNameLoading && !successorLeiName && (
                            <p className="text-xs text-[rgb(var(--muted-foreground-rgb))] dark:text-[rgb(var(--muted-foreground-rgb))] mt-1 italic">Name unavailable.</p>
                          )}
                        </>
                      ) : (
                        <p className="mt-1 text-xs text-[rgb(var(--muted-foreground-rgb))] dark:text-[rgb(var(--muted-foreground-rgb))] italic">No successor link found.</p>
                      )}
                    </div>

                    {selectedRecord.managing_lou && (
                      <div className="md:col-span-2 border-t border-[rgb(var(--border-rgb))] pt-4 dark:border-white/10">
                        <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">{t('leiRecords.modal.managingLou')}</span>
                        <button
                          type="button"
                          onClick={(event) => handleLinkedLeiClick(event, selectedRecord.managing_lou)}
                          className="mt-1 block font-mono text-sm text-left text-[rgb(var(--primary-rgb))] hover:text-[rgb(var(--primary-rgb))] hover:underline dark:text-[rgb(var(--primary-rgb))] dark:hover:text-[rgb(var(--primary-rgb))]"
                        >
                          {selectedRecord.managing_lou}
                        </button>
                        {managingLouName && (
                          <p className="text-xs text-[rgb(var(--muted-foreground-rgb))] mt-1">{managingLouName}</p>
                        )}
                        {managingLouNameLoading && (
                          <p className="text-xs text-[rgb(var(--muted-foreground-rgb))] dark:text-[rgb(var(--muted-foreground-rgb))] mt-1 italic">{t('leiRecords.modal.loadingName')}</p>
                        )}
                        {!managingLouNameLoading && !managingLouName && (
                          <p className="text-xs text-[rgb(var(--muted-foreground-rgb))] dark:text-[rgb(var(--muted-foreground-rgb))] mt-1 italic">{t('leiRecords.modal.nameUnavailable')}</p>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Validation */}
              {selectedRecord.validation_authority && (
                <section className="bg-[rgb(var(--surface-rgb))] p-6">
                  <h3 className="text-lg font-semibold text-[rgb(var(--foreground-rgb))] mb-3 pb-2 border-b border-[rgb(var(--border-rgb))]">
                    {t('leiRecords.modal.validation')}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 bg-[rgb(var(--surface-rgb))]">
                    <div>
                      <span className="text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] uppercase">{t('leiRecords.modal.validationAuthority')}</span>
                      <p className="text-sm text-[rgb(var(--foreground-rgb))] mt-1">{selectedRecord.validation_authority}</p>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Registration number lookup dropdown */}
      {regNumDropdown && (
        <div
          ref={regNumDropdownRef}
          aria-label={t('leiRecords.modal.registrationNumber')}
          className="fixed z-[60] min-w-56 theme-dropdown rounded-lg shadow-xl border border-[rgb(var(--border-rgb))] overflow-hidden"
          style={{ top: regNumDropdown.y, left: regNumDropdown.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 text-xs font-medium text-[rgb(var(--muted-foreground-rgb))] border-b border-[rgb(var(--border-rgb))]">
            {t('leiRecords.modal.registrationNumber')}
          </div>
          {regNumDropdown.options.map(opt => (
            <button
              key={opt.key}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm theme-link hover:bg-[rgb(var(--surface-rgb))] transition-colors"
              onClick={() => {
                openRegistrationLookup(opt)
                setRegNumDropdown(null)
              }}
            >
              <span className="flex-1">{opt.label}</span>
              <span className="text-xs opacity-60">↗</span>
            </button>
          ))}
        </div>
      )}

      {/* Context menu (right-click on table row) */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          role="menu"
          tabIndex={-1}
          aria-label={t('leiAudit.contextMenuLabel') ?? 'Row actions'}
          className="fixed z-[60] min-w-48 theme-dropdown rounded-lg shadow-xl border border-[rgb(var(--border-rgb))] overflow-hidden"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              closeContextMenu()
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              contextMenuAuditHistoryRef.current?.focus()
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              contextMenuViewDetailsRef.current?.focus()
            }
          }}
        >
          <button
            ref={contextMenuViewDetailsRef}
            role="menuitem"
            type="button"
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-[rgb(var(--surface-muted-rgb))] transition-colors focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-blue-500"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                contextMenuAuditHistoryRef.current?.focus()
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                contextMenuRef.current?.focus()
              } else if (e.key === 'Escape') {
                closeContextMenu()
              }
            }}
            onClick={() => {
              closeContextMenu()
              void handleRecordClick(contextMenu.record)
            }}
          >
            {formatLabel(t('leiAudit.viewDetails'))}
          </button>
          <button
            ref={contextMenuAuditHistoryRef}
            role="menuitem"
            type="button"
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-[rgb(var(--surface-muted-rgb))] transition-colors focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-blue-500"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                contextMenuViewDetailsRef.current?.focus()
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                contextMenuRef.current?.focus()
              } else if (e.key === 'Escape') {
                closeContextMenu()
              }
            }}
            onClick={() => {
              closeContextMenu()
              setAuditRecord(contextMenu.record)
            }}
          >
            {formatLabel(t('leiAudit.viewAuditHistory'))}
          </button>
        </div>
      )}

      {/* Audit History Modal */}
      {auditRecord && (
        <LEIAuditHistoryModal
          lei={auditRecord.lei}
          legalName={auditRecord.legal_name}
          onClose={() => setAuditRecord(null)}
          apiBaseUrl={API_BASE_URL}
          availableColumns={AVAILABLE_COLUMNS.filter((c) => c.key !== 'country_flag')}
          visibleColumns={effectiveVisibleColumns}
          onLeiClick={handleAuditLeiClick}
        />
      )}

      {/* Unobtrusive prompts to save changed preferences */}
      <PreferenceSavePrompt
        visible={showColumnSavePrompt}
        resetKey={columnSaveVersion}
        label={t('leiRecords.saveColumnPrompt')}
        onSave={handleSaveColumns}
        onDismiss={handleDismissColumns}
        showUndo={showColumnUndoToast}
        undoResetKey={columnUndoVersion}
        onUndo={handleUndoColumns}
        onUndoDismiss={handleUndoDismissColumns}
        undoLabel={t('preferences.savedUndo')}
      />
      <PreferenceSavePrompt
        visible={expandedWidthPreference.showPrompt}
        resetKey={expandedWidthPreference.promptResetKey}
        label={t('referenceLayout.savePageWidthDefault')}
        onSave={expandedWidthPreference.save}
        onDismiss={expandedWidthPreference.dismiss}
        showUndo={expandedWidthPreference.showUndo}
        undoResetKey={expandedWidthPreference.undoResetKey}
        onUndo={expandedWidthPreference.undo}
        onUndoDismiss={expandedWidthPreference.undoDismiss}
        undoLabel={t('preferences.savedUndo')}
      />
      <PreferenceSavePrompt
        visible={locationDisplayPreference.showPrompt}
        resetKey={locationDisplayPreference.promptResetKey}
        label={t('referenceLayout.saveDisplayModeDefault')}
        onSave={locationDisplayPreference.save}
        onDismiss={locationDisplayPreference.dismiss}
        showUndo={locationDisplayPreference.showUndo}
        undoResetKey={locationDisplayPreference.undoResetKey}
        onUndo={locationDisplayPreference.undo}
        onUndoDismiss={locationDisplayPreference.undoDismiss}
        undoLabel={t('preferences.savedUndo')}
      />
    </div>
  )
}
