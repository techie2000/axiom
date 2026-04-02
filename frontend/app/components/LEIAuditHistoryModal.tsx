'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCountryFlagEmoji } from '../lib/country-flag'

export interface LEIAuditEntry {
  id: string
  lei_record_id: string
  lei: string
  action: string
  record_snapshot: string
  changed_fields: string
  source_file_id?: string
  changed_by: string
  created_at: string
}

export interface AuditColumnConfig {
  key: string
  labelKey: string
  groupKey: string
  defaultVisible: boolean
}

type ParsedChangedFields = Record<string, { old_value: unknown; new_value: unknown; field_name?: string }>
type ParsedSnapshot = Record<string, unknown>

/** Fields whose values are ISO 3166-1 alpha-2 country codes — rendered with a flag. */
const COUNTRY_CODE_FIELDS = new Set(['legal_address_country', 'hq_address_country'])
const ALPHA2_RE = /^[A-Z]{2}$/
/** Border colour that uses the theme token at 75% opacity. Used in column-selector group rows. */
const GROUP_BORDER_STYLE: React.CSSProperties = { borderColor: 'rgb(var(--border-rgb) / 0.75)' }

/**
 * Convert a PascalCase or camelCase Go struct field name to the equivalent
 * JSON snake_case name.  This normalises `changed_fields` keys stored in the
 * database by older backend versions that used struct names instead of JSON
 * tag names (e.g. HQAddressLine1 → hq_address_line_1).
 *
 * If the key is already snake_case (no uppercase letters) it is returned
 * unchanged.
 */
function normalizeFieldKey(key: string): string {
  if (key === key.toLowerCase()) return key // already snake_case
  return key
    // HQAddress → HQ_Address  (sequence of caps before a cap+lowercase pair)
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    // addressLine → address_Line  (lowercase before uppercase)
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    // line1 → line_1  (letter before digit)
    .replace(/([a-zA-Z])(\d)/g, '$1_$2')
    .toLowerCase()
}

/** Re-key a parsed changed_fields object so all keys are snake_case. */
function normalizeChangedFields(cf: ParsedChangedFields): ParsedChangedFields {
  const out: ParsedChangedFields = {}
  for (const [key, val] of Object.entries(cf)) {
    const nk = normalizeFieldKey(key)
    out[nk] = { ...val, field_name: nk }
  }
  return out
}

function parseJSON<T>(value: unknown, fallback: T): T {
  if (value && typeof value === 'object') return value as T
  if (typeof value === 'string' && value.length > 0) {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return fallback
}

function formatTimestamp(dateStr: string): string {
  if (!dateStr || dateStr.startsWith('0001-')) return '—'
  try {
    return new Date(dateStr).toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
  } catch {
    return dateStr
  }
}

/** Fallback label for fields not in the column config: snake_case → Title Case */
function formatFieldLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatSnapshotValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string') {
    if (value.startsWith('0001-') || value.toLowerCase() === 'null') return '—'
    // Format ISO date strings
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      try {
        return new Date(value).toISOString().split('T')[0]
      } catch {
        return value
      }
    }
    return value
  }
  // Handle arrays (e.g. other_names: [{name, type, language}, …])
  if (Array.isArray(value)) {
    if (value.length === 0) return '—'
    return value
      .map((item) => {
        if (typeof item === 'object' && item !== null) {
          // Expected shape from backend: { name, type, language } (other_names array elements)
          const obj = item as Record<string, unknown>
          // For name objects render the name field; fall back to JSON
          if (obj.name) return String(obj.name)
          return JSON.stringify(item)
        }
        return String(item)
      })
      .join('; ')
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

interface SnapshotValueProps {
  fieldKey: string
  value: unknown
  showCodes?: boolean
  countryByCode?: Map<string, string>
}

/** Renders a value with optional country flag and names/codes display mode. */
function SnapshotValue({ fieldKey, value, showCodes = true, countryByCode }: SnapshotValueProps) {
  const text = formatSnapshotValue(value)
  if (text === '—') return <span className="theme-text-muted">—</span>
  if (COUNTRY_CODE_FIELDS.has(fieldKey) && typeof value === 'string' && ALPHA2_RE.test(value.toUpperCase())) {
    const code = value.toUpperCase()
    const flag = getCountryFlagEmoji(code)
    const displayText = (!showCodes && countryByCode) ? (countryByCode.get(code) ?? code) : code
    return (
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true">{flag}</span>
        <span>{displayText}</span>
      </span>
    )
  }
  return <>{text}</>
}

/** Compute changed fields by diffing two snapshots — used for arbitrary version pairs. */
function computeChangedFields(
  olderSnapshot: ParsedSnapshot,
  newerSnapshot: ParsedSnapshot
): ParsedChangedFields {
  const allKeys = new Set([...Object.keys(olderSnapshot), ...Object.keys(newerSnapshot)])
  const changes: ParsedChangedFields = {}
  for (const key of allKeys) {
    const oldVal = olderSnapshot[key]
    const newVal = newerSnapshot[key]
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[key] = { old_value: oldVal, new_value: newVal, field_name: key }
    }
  }
  return changes
}

interface ActionBadgeProps {
  action: string
}

function ActionBadge({ action }: ActionBadgeProps) {
  const colours: Record<string, string> = {
    CREATE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    UPDATE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colours[action] ?? 'theme-subtle'}`}>
      {action}
    </span>
  )
}

interface SnapshotTableProps {
  snapshot: ParsedSnapshot
  columns: AuditColumnConfig[]
  changedFields: ParsedChangedFields
  labelMap: Map<string, string>
  showCodes?: boolean
  countryByCode?: Map<string, string>
}

function SnapshotTable({ snapshot, columns, changedFields, labelMap, showCodes = true, countryByCode }: SnapshotTableProps) {
  const { t } = useTranslation('common')
  if (columns.length === 0) {
    return <p className="text-sm theme-text-muted py-4">{t('leiAudit.noColumnsSelected')}</p>
  }
  return (
    <div className="rounded-lg border border-[rgb(var(--border-rgb))] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[rgb(var(--surface-muted-rgb))]">
            <th className="px-3 py-2 text-left text-xs font-medium theme-text-muted uppercase tracking-wider w-44">
              {t('leiAudit.field')}
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium theme-text-muted uppercase tracking-wider">
              {t('leiAudit.value')}
            </th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col) => {
            const rawValue = snapshot[col.key]
            const isChanged = Object.prototype.hasOwnProperty.call(changedFields, col.key)
            const label = labelMap.get(col.key) ?? formatFieldLabel(col.key)
            const change = isChanged ? changedFields[col.key] : null
            return (
              <tr
                key={col.key}
                className={`border-t border-[rgb(var(--border-rgb))] ${
                  isChanged ? 'bg-amber-50 dark:bg-amber-900/15' : ''
                }`}
              >
                <td
                  className={`px-3 py-2 font-medium text-xs whitespace-nowrap ${
                    isChanged
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'theme-text-muted'
                  }`}
                >
                  {isChanged && <span className="mr-1" aria-hidden="true">⚑</span>}
                  {label}
                </td>
                <td className="px-3 py-2 break-all">
                  {isChanged && change !== null ? (
                    /* Show old → new inline so the change is immediately obvious */
                    <span className="flex flex-col gap-0.5">
                      <span className="text-red-600 dark:text-red-400 text-xs">
                        <SnapshotValue fieldKey={col.key} value={change.old_value} showCodes={showCodes} countryByCode={countryByCode} />
                      </span>
                      <span className="text-green-600 dark:text-green-400 font-semibold">
                        <SnapshotValue fieldKey={col.key} value={change.new_value} showCodes={showCodes} countryByCode={countryByCode} />
                      </span>
                    </span>
                  ) : (
                    <SnapshotValue fieldKey={col.key} value={rawValue} showCodes={showCodes} countryByCode={countryByCode} />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

interface CompareTableProps {
  columns: AuditColumnConfig[]
  changedFields: ParsedChangedFields
  newerSnapshot: ParsedSnapshot
  olderSnapshot: ParsedSnapshot
  labelMap: Map<string, string>
  newerLabel: string
  olderLabel: string
  showCodes?: boolean
  countryByCode?: Map<string, string>
}

/** Single merged table for compare mode — rows always aligned. Older (red) on left, Newer (green) on right. */
function CompareTable({
  columns,
  changedFields,
  newerSnapshot,
  olderSnapshot,
  labelMap,
  newerLabel,
  olderLabel,
  showCodes = true,
  countryByCode,
}: CompareTableProps) {
  const { t } = useTranslation('common')
  if (columns.length === 0) {
    return <p className="text-sm theme-text-muted py-4">{t('leiAudit.noColumnsSelected')}</p>
  }
  return (
    <div className="rounded-lg border border-[rgb(var(--border-rgb))] overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[rgb(var(--surface-muted-rgb))]">
            <th className="px-3 py-2 text-left text-xs font-medium theme-text-muted uppercase tracking-wider w-40">
              {t('leiAudit.field')}
            </th>
            {/* Older (previous) on left — red, matches "Old value" position in diff panel */}
            <th className="px-3 py-2 text-left text-xs font-medium text-red-700 dark:text-red-400 uppercase tracking-wider">
              {olderLabel}
            </th>
            {/* Newer (current) on right — green, matches "New value" position in diff panel */}
            <th className="px-3 py-2 text-left text-xs font-medium text-green-700 dark:text-green-400 uppercase tracking-wider">
              {newerLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col) => {
            const isChanged = Object.prototype.hasOwnProperty.call(changedFields, col.key)
            const change = isChanged ? changedFields[col.key] : null
            const label = labelMap.get(col.key) ?? formatFieldLabel(col.key)
            // Older value: use old_value from changedFields if available, else older snapshot
            const olderValue = isChanged && change ? change.old_value : olderSnapshot[col.key]
            // Newer value: use new_value from changedFields if available, else newer snapshot
            const newerValue = isChanged && change ? change.new_value : newerSnapshot[col.key]
            return (
              <tr
                key={col.key}
                className={`border-t border-[rgb(var(--border-rgb))] ${
                  isChanged ? 'bg-amber-50 dark:bg-amber-900/15' : ''
                }`}
              >
                <td
                  className={`px-3 py-2 font-medium text-xs whitespace-nowrap ${
                    isChanged ? 'text-amber-700 dark:text-amber-400' : 'theme-text-muted'
                  }`}
                >
                  {isChanged && <span className="mr-1" aria-hidden="true">⚑</span>}
                  {label}
                </td>
                {/* Older (previous) value — red */}
                <td
                  className={`px-3 py-2 break-all ${
                    isChanged ? 'text-red-600 dark:text-red-400' : 'theme-text-muted'
                  }`}
                >
                  <SnapshotValue fieldKey={col.key} value={olderValue} showCodes={showCodes} countryByCode={countryByCode} />
                </td>
                {/* Newer (current) value — green */}
                <td
                  className={`px-3 py-2 break-all ${
                    isChanged ? 'text-green-700 dark:text-green-400 font-semibold' : ''
                  }`}
                >
                  <SnapshotValue fieldKey={col.key} value={newerValue} showCodes={showCodes} countryByCode={countryByCode} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

interface Props {
  lei: string
  legalName: string
  onClose: () => void
  apiBaseUrl: string
  availableColumns: AuditColumnConfig[]
  visibleColumns: Set<string>
}

export default function LEIAuditHistoryModal({
  lei,
  legalName,
  onClose,
  apiBaseUrl,
  availableColumns,
  visibleColumns,
}: Props) {
  const { t } = useTranslation('common')

  const [audits, setAudits] = useState<LEIAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Timeline: index 0 = newest record (audits are already sorted DESC from API)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [compareMode, setCompareMode] = useState(false)
  // compareIndex: user-pinned version for arbitrary comparison; null = use adjacent (selectedIndex+1)
  const [compareIndex, setCompareIndex] = useState<number | null>(null)
  const [showChangedOnly, setShowChangedOnly] = useState(false)

  // Names / Codes display toggle
  const [showCodes, setShowCodes] = useState(true)
  const [countryByCode, setCountryByCode] = useState<Map<string, string>>(new Map())

  // Local column visibility that can be extended within this modal
  const [localColumns, setLocalColumns] = useState<Set<string>>(new Set(visibleColumns))
  const [showColumnSelector, setShowColumnSelector] = useState(false)

  // Build a display-label map (key → translated label) for SnapshotTable
  const labelMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>()
    availableColumns.forEach((col) => {
      map.set(col.key, t(col.labelKey))
    })
    return map
  }, [availableColumns, t])

  // Close on ESC
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showColumnSelector) {
          setShowColumnSelector(false)
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, showColumnSelector])

  // Fetch audit history (newest-first, up to 200 records)
  useEffect(() => {
    const controller = new AbortController()
    const fetchAudits = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/v1/lei/${encodeURIComponent(lei)}/audit?limit=200`,
          { signal: controller.signal }
        )
        if (!res.ok) {
          setError(t('leiAudit.errors.fetchFailed'))
          return
        }
        const data: LEIAuditEntry[] = await res.json()
        setAudits(Array.isArray(data) ? data : [])
        setSelectedIndex(0)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError(t('leiAudit.errors.fetchFailed'))
        }
      } finally {
        setLoading(false)
      }
    }
    void fetchAudits()
    return () => controller.abort()
  }, [lei, apiBaseUrl, t])

  // Fetch country data for Names / Codes display mode
  useEffect(() => {
    const controller = new AbortController()
    const fetchCountries = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/lei-countries`, { signal: controller.signal })
        if (!res.ok) return
        const data: Array<{ code: string; name: string }> = await res.json()
        if (Array.isArray(data)) {
          const map = new Map<string, string>()
          data.forEach((c) => {
            if (c.code) map.set(c.code.trim().toUpperCase(), c.name || c.code)
          })
          setCountryByCode(map)
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          // Non-fatal: names mode falls back to codes; log for developer visibility
          if (process.env.NODE_ENV !== 'production') console.debug('[LEIAuditHistoryModal] country fetch failed:', err)
        }
      }
    }
    void fetchCountries()
    return () => controller.abort()
  }, [apiBaseUrl])

  // Columns shown in the snapshot view, respecting localColumns
  const displayColumns = useMemo<AuditColumnConfig[]>(() => {
    return availableColumns.filter((col) => localColumns.has(col.key))
  }, [availableColumns, localColumns])

  const selectedAudit = audits[selectedIndex] ?? null

  // Resolve the actual compare index: pinned by user, or the next sequential entry
  const resolvedCompareIndex = useMemo<number | null>(() => {
    if (!compareMode) return null
    if (compareIndex !== null) return compareIndex
    const next = selectedIndex + 1
    return next < audits.length ? next : null
  }, [compareMode, compareIndex, selectedIndex, audits.length])

  const compareAudit = resolvedCompareIndex !== null ? (audits[resolvedCompareIndex] ?? null) : null

  const selectedSnapshot = useMemo<ParsedSnapshot>(() => {
    return selectedAudit
      ? parseJSON<ParsedSnapshot>(selectedAudit.record_snapshot, {})
      : {}
  }, [selectedAudit])

  const compareSnapshot = useMemo<ParsedSnapshot>(() => {
    return compareAudit
      ? parseJSON<ParsedSnapshot>(compareAudit.record_snapshot, {})
      : {}
  }, [compareAudit])

  const selectedChangedFields = useMemo<ParsedChangedFields>(() => {
    const raw = selectedAudit
      ? parseJSON<ParsedChangedFields>(selectedAudit.changed_fields, {})
      : {}
    // Normalise keys: old DB records used Go struct names (PascalCase); new
    // records use JSON tag names (snake_case).  After normalisation both match
    // the snake_case column keys used by the rest of the UI.
    return normalizeChangedFields(raw)
  }, [selectedAudit])

  // Changed fields for compare mode: dynamic diff when user pinned an arbitrary version
  const compareChangedFields = useMemo<ParsedChangedFields>(() => {
    if (!compareMode || resolvedCompareIndex === null) return selectedChangedFields
    if (compareIndex !== null) {
      // Compute diff dynamically between the two snapshots
      const olderIdx = Math.max(selectedIndex, resolvedCompareIndex)
      const newerIdx = Math.min(selectedIndex, resolvedCompareIndex)
      const olderSnap = parseJSON<ParsedSnapshot>(audits[olderIdx]?.record_snapshot ?? '', {})
      const newerSnap = parseJSON<ParsedSnapshot>(audits[newerIdx]?.record_snapshot ?? '', {})
      return computeChangedFields(olderSnap, newerSnap)
    }
    return selectedChangedFields
  }, [compareMode, resolvedCompareIndex, compareIndex, selectedIndex, audits, selectedChangedFields])

  // Determine which snapshot is "older" and which is "newer" for the compare table
  const { olderSnapshot, newerSnapshot, olderAudit, newerAudit, olderIdx, newerIdx } = useMemo(() => {
    const compIdx = resolvedCompareIndex
    if (compIdx === null || selectedIndex <= compIdx) {
      // selectedIndex is smaller (more recent); resolvedCompareIndex is older
      return {
        olderSnapshot: compareSnapshot, newerSnapshot: selectedSnapshot,
        olderAudit: compareAudit, newerAudit: selectedAudit,
        olderIdx: compIdx, newerIdx: selectedIndex,
      }
    }
    // resolvedCompareIndex is smaller (more recent); selectedIndex is older
    return {
      olderSnapshot: selectedSnapshot, newerSnapshot: compareSnapshot,
      olderAudit: selectedAudit, newerAudit: compareAudit,
      olderIdx: selectedIndex, newerIdx: compIdx,
    }
  }, [selectedIndex, resolvedCompareIndex, selectedSnapshot, compareSnapshot, selectedAudit, compareAudit])

  // "Show changed fields only" – restrict displayColumns to those that changed
  const filteredDisplayColumns = useMemo<AuditColumnConfig[]>(() => {
    // In compare mode use the compare changed fields (may be dynamically computed)
    const activeChangedFields = compareMode ? compareChangedFields : selectedChangedFields
    if (!showChangedOnly || Object.keys(activeChangedFields).length === 0) {
      return displayColumns
    }
    const changedKeys = new Set(Object.keys(activeChangedFields))
    return displayColumns.filter((col) => changedKeys.has(col.key))
  }, [displayColumns, showChangedOnly, selectedChangedFields, compareChangedFields, compareMode])

  const toggleColumn = (key: string) => {
    setLocalColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  /** Build a { groupKey → columns[] } map preserving group order. */
  const columnsByGroup = useMemo<Record<string, AuditColumnConfig[]>>(() => {
    const groups: Record<string, AuditColumnConfig[]> = {}
    availableColumns.forEach((col) => {
      const g = col.groupKey || 'other'
      if (!groups[g]) groups[g] = []
      groups[g].push(col)
    })
    return groups
  }, [availableColumns])

  const isGroupFullySelected = (groupKey: string) => {
    const cols = columnsByGroup[groupKey] ?? []
    return cols.every((c) => localColumns.has(c.key))
  }

  const isGroupPartiallySelected = (groupKey: string) => {
    const cols = columnsByGroup[groupKey] ?? []
    return cols.some((c) => localColumns.has(c.key)) && !isGroupFullySelected(groupKey)
  }

  const toggleGroupColumns = (groupKey: string) => {
    const cols = columnsByGroup[groupKey] ?? []
    if (isGroupFullySelected(groupKey)) {
      setLocalColumns((prev) => {
        const next = new Set(prev)
        cols.forEach((c) => next.delete(c.key))
        return next
      })
    } else {
      setLocalColumns((prev) => {
        const next = new Set(prev)
        cols.forEach((c) => next.add(c.key))
        return next
      })
    }
  }

  const defaultColumnKeys = useMemo(
    () => new Set(availableColumns.filter((c) => c.defaultVisible).map((c) => c.key)),
    [availableColumns]
  )

  return (
    <div
      role="presentation"
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- role=dialog is interactive per ARIA spec */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('leiAudit.title')}
        className="bg-[rgb(var(--surface-rgb))] rounded-lg shadow-2xl max-w-7xl w-full max-h-[95vh] flex flex-col border-2 border-[rgb(var(--border-rgb))]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 bg-[rgb(var(--surface-rgb))] border-b-2 border-[rgb(var(--border-rgb))] p-4 z-10">
          <div className="flex flex-wrap justify-between items-start gap-3">
            <div>
              <h2 className="text-xl font-bold text-[rgb(var(--foreground-rgb))]">
                {t('leiAudit.title')}
              </h2>
              <p className="text-sm font-mono text-[rgb(var(--primary-rgb))] mt-0.5">{lei}</p>
              {legalName && (
                <p className="text-sm theme-text-muted mt-0.5">{legalName}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Column selector — groups + Select All + Reset, matching LEI page style */}
              <div className="relative">
                <button
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="px-3 py-1.5 rounded-lg theme-btn-neutral text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  ⚙️ {t('leiAudit.columns')} ({localColumns.size})
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
                          onClick={() => setLocalColumns(new Set(availableColumns.map((c) => c.key)))}
                          className="px-2 py-1 theme-filterchip rounded"
                        >
                          {t('leiRecords.columns.selector.selectAll')}
                        </button>
                        <button
                          onClick={() => setLocalColumns(new Set(defaultColumnKeys))}
                          className="px-2 py-1 theme-btn-neutral rounded"
                        >
                          {t('leiRecords.columns.selector.resetToDefault')}
                        </button>
                      </div>
                    </div>
                    {Object.entries(columnsByGroup).map(([groupKey, cols]) => (
                      <div key={groupKey} className="border-b last:border-b-0" style={GROUP_BORDER_STYLE}>
                        <button
                          type="button"
                          onClick={() => toggleGroupColumns(groupKey)}
                          className="w-full px-3 py-2.5 theme-subtle font-semibold text-sm cursor-pointer transition-colors flex items-center justify-between gap-3 theme-focus"
                        >
                          <span className="flex items-center gap-2.5">
                            <span className="text-base leading-none">
                              {isGroupFullySelected(groupKey) ? '☑' : isGroupPartiallySelected(groupKey) ? '◐' : '☐'}
                            </span>
                            <span>{t(groupKey)}</span>
                          </span>
                          <span className="text-xs theme-text-muted font-normal">
                            {cols.filter((c) => localColumns.has(c.key)).length}/{cols.length}
                          </span>
                        </button>
                        <div className="p-2">
                          {cols.map((col) => (
                            <label
                              key={col.key}
                              className="flex items-center gap-2 px-2 py-1.5 theme-table-row-hover transition-colors rounded cursor-pointer text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={localColumns.has(col.key)}
                                onChange={() => toggleColumn(col.key)}
                                className="rounded"
                              />
                              <span>{t(col.labelKey)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Show changed fields only toggle */}
              <button
                onClick={() => setShowChangedOnly(!showChangedOnly)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  showChangedOnly
                    ? 'bg-[rgb(var(--primary-rgb))] text-white'
                    : 'theme-btn-neutral'
                }`}
                title={t('leiAudit.showChangedOnlyTitle')}
              >
                {t('leiAudit.showChangedOnly')}
              </button>

              {/* Compare mode toggle */}
              <button
                onClick={() => {
                  setCompareMode(!compareMode)
                  if (compareMode) setCompareIndex(null) // clear pin when leaving compare mode
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  compareMode
                    ? 'bg-[rgb(var(--primary-rgb))] text-white'
                    : 'theme-btn-neutral'
                }`}
                title={t('leiAudit.compareModeTitle')}
              >
                {t('leiAudit.compareMode')}
              </button>

              {/* Names / Codes display toggle */}
              <button
                onClick={() => setShowCodes(!showCodes)}
                className="px-3 py-1.5 rounded-lg theme-btn-neutral text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title={showCodes ? t('leiAudit.displayToggleNamesTitle') : t('leiAudit.displayToggleCodesTitle')}
              >
                {showCodes ? t('leiAudit.displayToggleNames') : t('leiAudit.displayToggleCodes')}
              </button>

              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg theme-btn-neutral text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {t('leiRecords.modal.close')}
              </button>
            </div>
          </div>

          {/* Timeline slider */}
          {!loading && !error && audits.length > 1 && (
            <div className="mt-3">
              <div className="flex items-center gap-3">
                <span className="text-xs theme-text-muted whitespace-nowrap">
                  {t('leiAudit.newest')}
                </span>
                <input
                  type="range"
                  min={0}
                  max={audits.length - 1}
                  value={selectedIndex}
                  onChange={(e) => setSelectedIndex(Number(e.target.value))}
                  className="flex-1 h-2 accent-[rgb(var(--primary-rgb))]"
                  aria-label={t('leiAudit.timelineSlider')}
                  aria-valuetext={t('leiAudit.viewingVersion', {
                    current: selectedIndex + 1,
                    total: audits.length,
                  })}
                />
                <span className="text-xs theme-text-muted whitespace-nowrap">
                  {t('leiAudit.oldest')}
                </span>
              </div>
              <p className="text-xs theme-text-muted text-center mt-1">
                {t('leiAudit.viewingVersion', {
                  current: selectedIndex + 1,
                  total: audits.length,
                })}
                {selectedIndex === 0 && (
                  <span className="ml-2 text-green-600 dark:text-green-400">
                    ({t('leiAudit.latest')})
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div
                className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-400 mb-3"
                role="status"
                aria-label={t('leiAudit.loading')}
              />
              <p className="text-sm theme-text-muted">{t('leiAudit.loading')}</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>
          </div>
        ) : audits.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <p className="theme-text-muted text-sm">{t('leiAudit.noHistory')}</p>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* ── Left: timeline list ─────────────────────────────────── */}
            <div className="w-60 flex-shrink-0 border-r border-[rgb(var(--border-rgb))] overflow-y-auto theme-scrollbar">
              <div className="p-2 border-b border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-muted-rgb))] sticky top-0">
                <span className="text-xs font-medium theme-text-muted uppercase tracking-wider">
                  {t('leiAudit.timeline')} ({audits.length})
                </span>
              </div>
              {audits.map((audit, idx) => {
                const cf = parseJSON<ParsedChangedFields>(audit.changed_fields, {})
                const changedCount = Object.keys(cf).length
                const isSelected = idx === selectedIndex
                const isPinned = idx === compareIndex
                return (
                  <div
                    key={audit.id}
                    className={`relative border-b border-[rgb(var(--border-rgb))] group ${
                      isSelected
                        ? 'bg-[rgb(var(--primary-rgb))]/10 border-l-2 border-l-[rgb(var(--primary-rgb))]'
                        : isPinned
                          ? 'bg-amber-50 dark:bg-amber-900/20 border-l-2 border-l-amber-500'
                          : 'hover:bg-[rgb(var(--surface-muted-rgb))]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedIndex(idx)}
                      className="w-full text-left px-3 py-2.5 pr-8 transition-colors focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <ActionBadge action={audit.action} />
                        <span className="flex items-center gap-1">
                          {isPinned && (
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                              {t('leiAudit.pinned')}
                            </span>
                          )}
                          {idx === 0 && !isPinned && (
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                              {t('leiAudit.latest')}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="text-xs theme-text-muted mt-1">
                        {formatTimestamp(audit.created_at)}
                      </div>
                      {changedCount > 0 && (
                        <div className="text-xs text-[rgb(var(--primary-rgb))] mt-0.5">
                          {t('leiAudit.fieldsChanged', { count: changedCount })}
                        </div>
                      )}
                    </button>
                    {/* Pin button — always visible in compare mode; hidden otherwise */}
                    {compareMode && !isSelected && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setCompareIndex(isPinned ? null : idx)
                        }}
                        className={`absolute top-2 right-1.5 px-1.5 py-0.5 rounded text-xs transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 ${
                          isPinned
                            ? 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30'
                            : 'opacity-0 group-hover:opacity-100 theme-text-muted hover:text-amber-600 dark:hover:text-amber-400'
                        }`}
                        title={isPinned ? t('leiAudit.unpin') : t('leiAudit.pinForCompare')}
                        aria-label={isPinned ? t('leiAudit.unpin') : t('leiAudit.pinForCompare')}
                      >
                        {isPinned ? '📌' : <span aria-hidden="true">📍</span>}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ── Right: record view ──────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto theme-scrollbar p-4">
              {selectedAudit && (
                <>
                  {/* Metadata bar */}
                  <div className="mb-4 p-3 rounded-lg bg-[rgb(var(--surface-muted-rgb))] border border-[rgb(var(--border-rgb))] text-sm flex flex-wrap gap-4">
                    <span>
                      <span className="font-medium">{t('leiAudit.action')}:</span>{' '}
                      <ActionBadge action={selectedAudit.action} />
                    </span>
                    <span>
                      <span className="font-medium">{t('leiAudit.date')}:</span>{' '}
                      {formatTimestamp(selectedAudit.created_at)}
                    </span>
                    <span>
                      <span className="font-medium">{t('leiAudit.changedBy')}:</span>{' '}
                      {selectedAudit.changed_by || '—'}
                    </span>
                    {Object.keys(selectedChangedFields).length > 0 && (
                      <span>
                        <span className="font-medium">{t('leiAudit.changedFieldsCount')}:</span>{' '}
                        {Object.keys(selectedChangedFields).length}
                      </span>
                    )}
                  </div>

                  {/* Diff summary for UPDATE records */}
                  {selectedAudit.action === 'UPDATE' &&
                    Object.keys(selectedChangedFields).length > 0 && (
                      <div className="mb-4 p-3 rounded-lg border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                        <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2">
                          {t('leiAudit.changedFields')}
                        </h4>
                        <div className="space-y-1.5">
                          {/* Header */}
                          <div className="grid grid-cols-3 gap-2 text-xs font-semibold theme-text-muted border-b border-amber-200 dark:border-amber-800 pb-1 mb-1">
                            <span>{t('leiAudit.field')}</span>
                            <span>{t('leiAudit.oldValue')}</span>
                            <span>{t('leiAudit.newValue')}</span>
                          </div>
                          {Object.entries(selectedChangedFields).map(([field, change]) => (
                            <div key={field} className="grid grid-cols-3 gap-2 text-xs">
                              <span className="font-medium text-[rgb(var(--foreground-rgb))]">
                                {labelMap.get(field) ?? formatFieldLabel(field)}
                              </span>
                              <span className="text-red-600 dark:text-red-400 break-all">
                                <SnapshotValue fieldKey={field} value={change.old_value} showCodes={showCodes} countryByCode={countryByCode} />
                              </span>
                              <span className="text-green-600 dark:text-green-400 font-medium break-all">
                                <SnapshotValue fieldKey={field} value={change.new_value} showCodes={showCodes} countryByCode={countryByCode} />
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Record view: compare or single */}
                  {compareMode ? (
                    <>
                      {compareAudit && newerAudit && olderAudit ? (
                        <CompareTable
                          columns={filteredDisplayColumns}
                          changedFields={compareChangedFields}
                          newerSnapshot={newerSnapshot}
                          olderSnapshot={olderSnapshot}
                          labelMap={labelMap}
                          newerLabel={`#${(newerIdx ?? 0) + 1} — ${formatTimestamp(newerAudit.created_at)}${(newerIdx ?? 0) === 0 ? ` (${t('leiAudit.latest')})` : ''}`}
                          olderLabel={`#${(olderIdx ?? 0) + 1} — ${formatTimestamp(olderAudit.created_at)}`}
                          showCodes={showCodes}
                          countryByCode={countryByCode}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-40 gap-2 text-sm theme-text-muted">
                          <p>{t('leiAudit.noPreviousVersion')}</p>
                          <p className="text-xs">{t('leiAudit.pinHint')}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      <h3 className="text-sm font-semibold mb-2 pb-1 border-b border-[rgb(var(--border-rgb))]">
                        {t('leiAudit.recordState')}
                      </h3>
                      <SnapshotTable
                        snapshot={selectedSnapshot}
                        columns={filteredDisplayColumns}
                        changedFields={selectedChangedFields}
                        labelMap={labelMap}
                        showCodes={showCodes}
                        countryByCode={countryByCode}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
