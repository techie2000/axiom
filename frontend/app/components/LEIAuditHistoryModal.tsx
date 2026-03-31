'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  defaultVisible: boolean
}

type ParsedChangedFields = Record<string, { old: unknown; new: unknown }>
type ParsedSnapshot = Record<string, unknown>

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
  return String(value)
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
}

function SnapshotTable({ snapshot, columns, changedFields, labelMap }: SnapshotTableProps) {
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
            const label = labelMap.get(col.key) ?? col.key
            return (
              <tr
                key={col.key}
                className={`border-t border-[rgb(var(--border-rgb))] ${
                  isChanged ? 'bg-amber-50 dark:bg-amber-900/20' : ''
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
                <td
                  className={`px-3 py-2 break-all ${
                    isChanged ? 'text-amber-700 dark:text-amber-300 font-semibold' : ''
                  }`}
                >
                  {formatSnapshotValue(rawValue)}
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
  const [showChangedOnly, setShowChangedOnly] = useState(false)

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

  // Columns shown in the snapshot view, respecting localColumns
  const displayColumns = useMemo<AuditColumnConfig[]>(() => {
    return availableColumns.filter((col) => localColumns.has(col.key))
  }, [availableColumns, localColumns])

  const selectedAudit = audits[selectedIndex] ?? null
  // In compare mode, show the entry right after the selected one (older version)
  const compareAudit = compareMode ? (audits[selectedIndex + 1] ?? null) : null

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
    return selectedAudit
      ? parseJSON<ParsedChangedFields>(selectedAudit.changed_fields, {})
      : {}
  }, [selectedAudit])

  // "Show changed fields only" – restrict displayColumns to those that changed
  const filteredDisplayColumns = useMemo<AuditColumnConfig[]>(() => {
    if (!showChangedOnly || Object.keys(selectedChangedFields).length === 0) {
      return displayColumns
    }
    const changedKeys = new Set(Object.keys(selectedChangedFields))
    return displayColumns.filter((col) => changedKeys.has(col.key))
  }, [displayColumns, showChangedOnly, selectedChangedFields])

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

  return (
    <div
      role="presentation"
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- role=dialog is interactive per ARIA spec */}
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
              {/* Column selector */}
              <div className="relative">
                <button
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="px-3 py-1.5 rounded-lg theme-btn-neutral text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  ⚙️ {t('leiAudit.columns')} ({localColumns.size})
                </button>
                {showColumnSelector && (
                  <div className="absolute right-0 mt-2 w-64 max-h-80 overflow-y-auto theme-scrollbar theme-dropdown rounded-lg shadow-xl z-50 border border-[rgb(var(--border-rgb))]">
                    <div className="sticky top-0 theme-dropdown border-b p-2 flex justify-between items-center">
                      <span className="text-sm font-semibold">{t('leiAudit.selectColumns')}</span>
                      <button
                        onClick={() => setShowColumnSelector(false)}
                        className="theme-text-muted hover:opacity-80 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                    {availableColumns.map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-[rgb(var(--surface-muted-rgb))] cursor-pointer text-sm"
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
                onClick={() => setCompareMode(!compareMode)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  compareMode
                    ? 'bg-[rgb(var(--primary-rgb))] text-white'
                    : 'theme-btn-neutral'
                }`}
                title={t('leiAudit.compareModeTitle')}
              >
                {t('leiAudit.compareMode')}
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
                  {t('leiAudit.oldest')}
                </span>
                <input
                  type="range"
                  min={0}
                  max={audits.length - 1}
                  value={selectedIndex}
                  onChange={(e) => setSelectedIndex(Number(e.target.value))}
                  className="flex-1 h-2 accent-[rgb(var(--primary-rgb))]"
                  aria-label={t('leiAudit.timelineSlider')}
                />
                <span className="text-xs theme-text-muted whitespace-nowrap">
                  {t('leiAudit.newest')}
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
                return (
                  <button
                    key={audit.id}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    className={`w-full text-left px-3 py-2.5 border-b border-[rgb(var(--border-rgb))] transition-colors focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      isSelected
                        ? 'bg-[rgb(var(--primary-rgb))]/10 border-l-2 border-l-[rgb(var(--primary-rgb))]'
                        : 'hover:bg-[rgb(var(--surface-muted-rgb))]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <ActionBadge action={audit.action} />
                      {idx === 0 && (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                          {t('leiAudit.latest')}
                        </span>
                      )}
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
                              <span className="font-mono font-medium text-[rgb(var(--foreground-rgb))]">
                                {labelMap.get(field) ?? field}
                              </span>
                              <span className="text-red-600 dark:text-red-400 line-through break-all">
                                {formatSnapshotValue(change.old)}
                              </span>
                              <span className="text-green-600 dark:text-green-400 font-medium break-all">
                                {formatSnapshotValue(change.new)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Record view: compare or single */}
                  {compareMode ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-semibold mb-2 pb-1 border-b border-[rgb(var(--border-rgb))]">
                          #{selectedIndex + 1} — {formatTimestamp(selectedAudit.created_at)}
                          {selectedIndex === 0 && (
                            <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                              ({t('leiAudit.latest')})
                            </span>
                          )}
                        </h3>
                        <SnapshotTable
                          snapshot={selectedSnapshot}
                          columns={filteredDisplayColumns}
                          changedFields={selectedChangedFields}
                          labelMap={labelMap}
                        />
                      </div>
                      <div>
                        {compareAudit ? (
                          <>
                            <h3 className="text-sm font-semibold mb-2 pb-1 border-b border-[rgb(var(--border-rgb))]">
                              #{selectedIndex + 2} — {formatTimestamp(compareAudit.created_at)}
                              <span className="ml-2 text-xs theme-text-muted">
                                ({t('leiAudit.olderVersion')})
                              </span>
                            </h3>
                            <SnapshotTable
                              snapshot={compareSnapshot}
                              columns={filteredDisplayColumns}
                              changedFields={parseJSON<ParsedChangedFields>(
                                compareAudit.changed_fields,
                                {}
                              )}
                              labelMap={labelMap}
                            />
                          </>
                        ) : (
                          <div className="flex items-center justify-center h-40 text-sm theme-text-muted">
                            {t('leiAudit.noPreviousVersion')}
                          </div>
                        )}
                      </div>
                    </div>
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
