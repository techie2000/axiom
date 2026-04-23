'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Badge from './Badge'
import CountryFlag from './CountryFlag'
import { useButtonEmojiMode } from '../lib/useButtonEmojiMode'
import { getRegistrationStatusBadgePresentation, REGISTRATION_STATUS_BADGE_VARIANT } from '../lei-records/null-utils'

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
/** Fields whose values are LEI codes — rendered with monospace primary styling + optional click. */
const LEI_CODE_FIELDS = new Set(['managing_lou', 'successor_lei'])
/**
 * Fields whose values are enum strings with underscores (e.g. FULLY_CORROBORATED).
 * In the snapshot view these are displayed with underscores replaced by spaces so they read
 * naturally (e.g. "FULLY CORROBORATED") without altering the stored value.
 */
const ENUM_DISPLAY_FIELDS = new Set([
  'validation_sources',
  'registration_status',
  'entity_status',
  'entity_category',
  'entity_sub_category',
])
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

function maybeParseJSONLikeString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  if (
    !((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']')))
  ) {
    return value
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function canonicalizeForSemanticCompare(value: unknown): unknown {
  const parsedValue = maybeParseJSONLikeString(value)

  if (Array.isArray(parsedValue)) {
    return parsedValue.map((item) => canonicalizeForSemanticCompare(item))
  }

  if (parsedValue && typeof parsedValue === 'object') {
    const sortedEntries = Object.entries(parsedValue as Record<string, unknown>)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, nestedValue]) => [key, canonicalizeForSemanticCompare(nestedValue)] as const)

    return Object.fromEntries(sortedEntries)
  }

  return parsedValue
}

export function valuesDifferSemantically(left: unknown, right: unknown): boolean {
  const leftCanonical = canonicalizeForSemanticCompare(left)
  const rightCanonical = canonicalizeForSemanticCompare(right)
  return JSON.stringify(leftCanonical) !== JSON.stringify(rightCanonical)
}

function formatTimestamp(dateStr: string): string {
  if (!dateStr || dateStr.startsWith('0001-')) return '—'
  try {
    return new Date(dateStr).toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
  } catch {
    return dateStr
  }
}

/** Fallback label for fields not in the column config: snake_case → Title Case with acronym handling */
function formatFieldLabel(key: string): string {
  const words = key.split('_').map((word) => {
    // Preserve all-caps acronyms (HQ, LEI, ISO, etc.)
    if (word.length > 1 && word === word.toUpperCase()) {
      return word
    }
    // Title case: first letter uppercase, rest lowercase
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  })
  return words.join(' ')
}

/** Format a single name-object entry ({ name, type?, language? }) as "Name (Type) [lang]". */
function formatNameEntry(obj: Record<string, unknown>): string {
  const name = typeof obj.name === 'string' ? obj.name : ''
  if (!name) return JSON.stringify(obj)
  const type = typeof obj.type === 'string' ? obj.type : null
  const lang = typeof obj.language === 'string' ? obj.language : null
  const typePart = type ? ` (${type.replace(/_/g, ' ')})` : ''
  const langPart = lang ? ` [${lang}]` : ''
  return `${name}${typePart}${langPart}`
}

export function formatSnapshotValue(value: unknown): string {
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
    // JSON-encoded arrays/objects stored as strings (e.g. other_names in record_snapshot)
    if (
      (value.startsWith('[') && value.endsWith(']')) ||
      (value.startsWith('{') && value.endsWith('}'))
    ) {
      try {
        const parsed: unknown = JSON.parse(value)
        if (parsed !== null && typeof parsed !== 'string') return formatSnapshotValue(parsed)
      } catch {
        // fall through to plain string return
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
          if (obj.name) return formatNameEntry(obj)
          return JSON.stringify(item)
        }
        return String(item)
      })
      .join('\n')
  }
  if (typeof value === 'object') {
    // An empty plain object (e.g. validation_sources stored as JSONB `{}`) means "no value".
    if (Object.keys(value as Record<string, unknown>).length === 0) return '—'
    return JSON.stringify(value)
  }
  return String(value)
}

export function formatEnumDisplayText(fieldKey: string, value: unknown, formattedText: string): string {
  if (!ENUM_DISPLAY_FIELDS.has(fieldKey)) return formattedText
  if (formattedText === '—') return formattedText

  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return (value as string[]).map((item) => item.replace(/_/g, ' ')).join('\n')
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
          return (parsed as string[]).map((item) => item.replace(/_/g, ' ')).join('\n')
        }
      } catch {
        // Fall through to plain enum string handling.
      }
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return formattedText
    }

    return formattedText.replace(/_/g, ' ')
  }

  return formattedText
}

export interface AlignedDiffRow {
  oldLine: string | null
  newLine: string | null
  state: 'unchanged' | 'added' | 'removed'
}

function splitDisplayLines(fieldKey: string, value: unknown): string[] {
  const formattedText = formatEnumDisplayText(fieldKey, value, formatSnapshotValue(value))
  if (formattedText === '—') {
    return []
  }
  return formattedText.split('\n')
}

export function alignMultilineDiffRows(fieldKey: string, oldValue: unknown, newValue: unknown): AlignedDiffRow[] {
  const oldLines = splitDisplayLines(fieldKey, oldValue)
  const newLines = splitDisplayLines(fieldKey, newValue)
  const shouldAlign = oldLines.length > 1 || newLines.length > 1

  if (!shouldAlign) {
    return []
  }

  const lcs: number[][] = Array.from({ length: oldLines.length + 1 }, () =>
    Array<number>(newLines.length + 1).fill(0)
  )

  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      lcs[oldIndex][newIndex] = oldLines[oldIndex] === newLines[newIndex]
        ? lcs[oldIndex + 1][newIndex + 1] + 1
        : Math.max(lcs[oldIndex + 1][newIndex], lcs[oldIndex][newIndex + 1])
    }
  }

  const rows: AlignedDiffRow[] = []
  let oldIndex = 0
  let newIndex = 0

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (
      oldIndex < oldLines.length &&
      newIndex < newLines.length &&
      oldLines[oldIndex] === newLines[newIndex]
    ) {
      rows.push({
        oldLine: oldLines[oldIndex],
        newLine: newLines[newIndex],
        state: 'unchanged',
      })
      oldIndex += 1
      newIndex += 1
      continue
    }

    if (
      newIndex < newLines.length &&
      (oldIndex === oldLines.length || lcs[oldIndex][newIndex + 1] >= lcs[oldIndex + 1][newIndex])
    ) {
      rows.push({
        oldLine: null,
        newLine: newLines[newIndex],
        state: 'added',
      })
      newIndex += 1
      continue
    }

    if (oldIndex < oldLines.length) {
      rows.push({
        oldLine: oldLines[oldIndex],
        newLine: null,
        state: 'removed',
      })
      oldIndex += 1
    }
  }

  return rows
}

interface SnapshotValueProps {
  fieldKey: string
  value: unknown
  snapshot?: ParsedSnapshot
  showCodes?: boolean
  countryByCode?: Map<string, string>
  onLeiClick?: (lei: string) => void
  linkedLeiNames?: Map<string, string>
  registrationAuthorityNameByCode?: Map<string, string>
  registrationAuthorityFallback?: {
    code?: string
    name?: string
    internationalName?: string
  }
}

/** Renders a value with optional country flag, names/codes display mode, and LEI code links. */
function SnapshotValue({ fieldKey, value, snapshot, showCodes = true, countryByCode, onLeiClick, linkedLeiNames, registrationAuthorityNameByCode, registrationAuthorityFallback }: SnapshotValueProps) {
  const text = formatSnapshotValue(value)
  const displayText = formatEnumDisplayText(fieldKey, value, text)
  if (displayText === '—') return <span className="theme-text-muted">—</span>
  if (fieldKey === 'registration_authority' && typeof value === 'string') {
    const raCode = value.trim()
    const snapshotRaCode = typeof snapshot?.registration_authority === 'string'
      ? snapshot.registration_authority.trim()
      : ''
    const canUseSnapshotName = snapshotRaCode !== '' && snapshotRaCode === raCode
    const raName = typeof snapshot?.registration_authority_name === 'string'
      ? (canUseSnapshotName ? snapshot.registration_authority_name.trim() : '')
      : ''
    const raIntlName = typeof snapshot?.registration_authority_international_name === 'string'
      ? (canUseSnapshotName ? snapshot.registration_authority_international_name.trim() : '')
      : ''
    const fallbackNameFromMap = registrationAuthorityNameByCode?.get(raCode)?.trim() || ''
    const fallbackCode = (registrationAuthorityFallback?.code || '').trim()
    const fallbackNameFromRecord = fallbackCode === raCode
      ? (registrationAuthorityFallback?.name || '').trim()
      : ''
    const fallbackIntlFromRecord = fallbackCode === raCode
      ? (registrationAuthorityFallback?.internationalName || '').trim()
      : ''

    const fallbackName = fallbackNameFromMap || fallbackNameFromRecord
    const displayName = raName || fallbackName
    const displayIntlName = raIntlName || fallbackIntlFromRecord
    const showIntl = displayIntlName && displayName && displayIntlName !== displayName

    return (
      <span className="flex flex-col gap-0.5">
        <span className="font-mono">{raCode || '—'}</span>
        {displayName && displayName !== raCode && (
          <span className="text-xs theme-text-muted">
            {displayName}
            {showIntl && <span className="ml-1 opacity-75">({displayIntlName})</span>}
          </span>
        )}
      </span>
    )
  }
  if (COUNTRY_CODE_FIELDS.has(fieldKey) && typeof value === 'string' && ALPHA2_RE.test(value.trim().toUpperCase())) {
    const code = value.trim().toUpperCase()
    const displayText = (!showCodes && countryByCode) ? (countryByCode.get(code) ?? code) : code
    return (
      <span className="inline-flex items-center gap-1.5">
        <CountryFlag countryCode={code} className="h-4 w-6 rounded-sm border border-[rgb(var(--border-rgb))]" />
        <span>{displayText}</span>
      </span>
    )
  }
  if (fieldKey === 'registration_status' && typeof value === 'string' && value.trim().length > 0) {
    const regStatusPresentation = getRegistrationStatusBadgePresentation(value)
    return (
      <Badge
        title={regStatusPresentation.tooltip}
        className="inline-block whitespace-nowrap"
        variant={REGISTRATION_STATUS_BADGE_VARIANT[regStatusPresentation.variant]}
      >
        {regStatusPresentation.label}
      </Badge>
    )
  }
  if (LEI_CODE_FIELDS.has(fieldKey) && typeof value === 'string' && value.trim().length > 0) {
    const lei = value.trim()
    const entityName = linkedLeiNames?.get(lei) || ''
    const leiEl = onLeiClick ? (
      <button
        type="button"
        onClick={() => onLeiClick(lei)}
        className="font-mono text-[rgb(var(--primary-rgb))] hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-[rgb(var(--primary-rgb))] rounded"
      >
        {lei}
      </button>
    ) : (
      <span className="font-mono text-[rgb(var(--primary-rgb))]">{lei}</span>
    )
    if (entityName) {
      return (
        <span className="flex flex-col items-start gap-0.5">
          {leiEl}
          <span className="text-xs theme-text-muted">{entityName}</span>
        </span>
      )
    }
    return leiEl
  }
  // Multi-line values (e.g. other_names with multiple entries)
  if (displayText.includes('\n')) {
    return (
      <span className="flex flex-col gap-0.5">
        {displayText.split('\n').map((line, i) => (
          <span key={i}>{line}</span>
        ))}
      </span>
    )
  }
  return <>{displayText}</>
}

/** Compute changed fields by diffing two snapshots — used for arbitrary version pairs. */
export function computeChangedFields(
  olderSnapshot: ParsedSnapshot,
  newerSnapshot: ParsedSnapshot
): ParsedChangedFields {
  const allKeys = new Set([...Object.keys(olderSnapshot), ...Object.keys(newerSnapshot)])
  const changes: ParsedChangedFields = {}
  for (const key of allKeys) {
    const oldVal = olderSnapshot[key]
    const newVal = newerSnapshot[key]
    if (valuesDifferSemantically(oldVal, newVal)) {
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
  onLeiClick?: (lei: string) => void
  linkedLeiNames?: Map<string, string>
  registrationAuthorityNameByCode?: Map<string, string>
  registrationAuthorityFallback?: {
    code?: string
    name?: string
    internationalName?: string
  }
}

function SnapshotTable({ snapshot, columns, changedFields, labelMap, showCodes = true, countryByCode, onLeiClick, linkedLeiNames, registrationAuthorityNameByCode, registrationAuthorityFallback }: SnapshotTableProps) {
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
          {columns.map((col, i) => {
            const rawValue = snapshot[col.key]
            const isChanged = Object.prototype.hasOwnProperty.call(changedFields, col.key)
            const label = labelMap.get(col.key) ?? formatFieldLabel(col.key)
            const change = isChanged ? changedFields[col.key] : null
            const isNewGroup = i === 0 || col.groupKey !== columns[i - 1].groupKey
            return (
              <React.Fragment key={col.key}>
                {isNewGroup && (
                  <tr className="bg-[rgb(var(--surface-muted-rgb))]">
                    <td
                      colSpan={2}
                      className="px-3 py-1 text-xs font-semibold theme-text-muted uppercase tracking-wider border-t border-[rgb(var(--border-rgb))]"
                    >
                      {t(col.groupKey)}
                    </td>
                  </tr>
                )}
                <tr
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
                    {isChanged && <span className="mr-1" aria-hidden="true">🚩</span>}
                    {label}
                  </td>
                  <td className="px-3 py-2 break-words">
                    {isChanged && change !== null ? (
                      /* Show old → new inline so the change is immediately obvious */
                      <span className="flex flex-col gap-0.5">
                        <span className="text-red-600 dark:text-red-400 text-xs">
                          <SnapshotValue fieldKey={col.key} value={change.old_value} snapshot={snapshot} showCodes={showCodes} countryByCode={countryByCode} onLeiClick={onLeiClick} linkedLeiNames={linkedLeiNames} registrationAuthorityNameByCode={registrationAuthorityNameByCode} registrationAuthorityFallback={registrationAuthorityFallback} />
                        </span>
                        <span className="text-green-600 dark:text-green-400 font-semibold">
                          <SnapshotValue fieldKey={col.key} value={change.new_value} snapshot={snapshot} showCodes={showCodes} countryByCode={countryByCode} onLeiClick={onLeiClick} linkedLeiNames={linkedLeiNames} registrationAuthorityNameByCode={registrationAuthorityNameByCode} registrationAuthorityFallback={registrationAuthorityFallback} />
                        </span>
                      </span>
                    ) : (
                      <SnapshotValue fieldKey={col.key} value={rawValue} snapshot={snapshot} showCodes={showCodes} countryByCode={countryByCode} onLeiClick={onLeiClick} linkedLeiNames={linkedLeiNames} registrationAuthorityNameByCode={registrationAuthorityNameByCode} registrationAuthorityFallback={registrationAuthorityFallback} />
                    )}
                  </td>
                </tr>
              </React.Fragment>
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
  onLeiClick?: (lei: string) => void
  linkedLeiNames?: Map<string, string>
  registrationAuthorityNameByCode?: Map<string, string>
  registrationAuthorityFallback?: {
    code?: string
    name?: string
    internationalName?: string
  }
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
  onLeiClick,
  linkedLeiNames,
  registrationAuthorityNameByCode,
  registrationAuthorityFallback,
}: CompareTableProps) {
  const { t } = useTranslation('common')
  if (columns.length === 0) {
    return <p className="text-sm theme-text-muted py-4">{t('leiAudit.noColumnsSelected')}</p>
  }
  return (
    <div className="rounded-lg border border-[rgb(var(--border-rgb))] overflow-hidden overflow-x-auto">
      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col style={{ width: '11rem' }} />
          <col style={{ width: 'calc((100% - 11rem) / 2)' }} />
          <col style={{ width: 'calc((100% - 11rem) / 2)' }} />
        </colgroup>
        <thead>
          <tr className="bg-[rgb(var(--surface-muted-rgb))]">
            <th className="px-3 py-2 text-left text-xs font-medium theme-text-muted uppercase tracking-wider">
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
          {columns.map((col, i) => {
            const isChanged = Object.prototype.hasOwnProperty.call(changedFields, col.key)
            const change = isChanged ? changedFields[col.key] : null
            const label = labelMap.get(col.key) ?? formatFieldLabel(col.key)
            // Older value: use old_value from changedFields if available, else older snapshot
            const olderValue = isChanged && change ? change.old_value : olderSnapshot[col.key]
            // Newer value: use new_value from changedFields if available, else newer snapshot
            const newerValue = isChanged && change ? change.new_value : newerSnapshot[col.key]
            const alignedRows = isChanged ? alignMultilineDiffRows(col.key, olderValue, newerValue) : []
            const useAlignedRows = alignedRows.length > 0
            const isNewGroup = i === 0 || col.groupKey !== columns[i - 1].groupKey
            return (
              <React.Fragment key={col.key}>
                {isNewGroup && (
                  <tr className="bg-[rgb(var(--surface-muted-rgb))]">
                    <td
                      colSpan={3}
                      className="px-3 py-1 text-xs font-semibold theme-text-muted uppercase tracking-wider border-t border-[rgb(var(--border-rgb))]"
                    >
                      {t(col.groupKey)}
                    </td>
                  </tr>
                )}
                <tr
                  className={`border-t border-[rgb(var(--border-rgb))] ${
                    isChanged ? 'bg-amber-50 dark:bg-amber-900/15' : ''
                  }`}
                >
                  <td
                    className={`px-3 py-2 font-medium text-xs whitespace-nowrap ${
                      isChanged ? 'text-amber-700 dark:text-amber-400' : 'theme-text-muted'
                    }`}
                  >
                    {isChanged && <span className="mr-1" aria-hidden="true">🚩</span>}
                    {label}
                  </td>
                  {useAlignedRows ? (
                    <td colSpan={2} className="px-3 py-2">
                      <div className="grid gap-1" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
                        {alignedRows.map((row, rowIndex) => (
                          <React.Fragment key={`${col.key}-aligned-${rowIndex}`}>
                            <div
                              className={`px-2 py-1 rounded whitespace-pre-wrap break-words ${
                                row.state === 'removed'
                                  ? 'bg-red-100/70 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                  : row.state === 'unchanged'
                                    ? 'theme-text-muted'
                                    : 'theme-text-muted opacity-70'
                              }`}
                            >
                              {row.oldLine ?? '—'}
                            </div>
                            <div
                              className={`px-2 py-1 rounded whitespace-pre-wrap break-words ${
                                row.state === 'added'
                                  ? 'bg-green-100/70 dark:bg-green-900/30 text-green-800 dark:text-green-300 font-semibold'
                                  : row.state === 'unchanged'
                                    ? 'theme-text-muted'
                                    : 'theme-text-muted opacity-70'
                              }`}
                            >
                              {row.newLine ?? '—'}
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    </td>
                  ) : (
                    <>
                      {/* Older (previous) value — red */}
                      <td
                        className={`px-3 py-2 break-words ${
                          isChanged ? 'text-red-600 dark:text-red-400' : 'theme-text-muted'
                        }`}
                      >
                        <SnapshotValue fieldKey={col.key} value={olderValue} snapshot={olderSnapshot} showCodes={showCodes} countryByCode={countryByCode} onLeiClick={onLeiClick} linkedLeiNames={linkedLeiNames} registrationAuthorityNameByCode={registrationAuthorityNameByCode} registrationAuthorityFallback={registrationAuthorityFallback} />
                      </td>
                      {/* Newer (current) value — green */}
                      <td
                        className={`px-3 py-2 break-words ${
                          isChanged ? 'text-green-700 dark:text-green-400 font-semibold' : ''
                        }`}
                      >
                        <SnapshotValue fieldKey={col.key} value={newerValue} snapshot={newerSnapshot} showCodes={showCodes} countryByCode={countryByCode} onLeiClick={onLeiClick} linkedLeiNames={linkedLeiNames} registrationAuthorityNameByCode={registrationAuthorityNameByCode} registrationAuthorityFallback={registrationAuthorityFallback} />
                      </td>
                    </>
                  )}
                </tr>
              </React.Fragment>
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
  onLeiClick?: (lei: string) => void
  registrationAuthorityNameByCode?: Map<string, string>
  registrationAuthorityFallback?: {
    code?: string
    name?: string
    internationalName?: string
  }
}

export default function LEIAuditHistoryModal({
  lei,
  legalName,
  onClose,
  apiBaseUrl,
  availableColumns,
  visibleColumns,
  onLeiClick,
  registrationAuthorityNameByCode,
  registrationAuthorityFallback,
}: Props) {
  const { t } = useTranslation('common')
  const { formatLabel } = useButtonEmojiMode()

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

  // Ref and state for entity names fetched for LEI code fields (managing_lou, successor_lei, etc.)
  const linkedLeiNamesCache = React.useRef<Map<string, string>>(new Map())
  const [linkedLeiNames, setLinkedLeiNames] = useState<Map<string, string>>(new Map())

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

  // Fetch entity names for LEI code fields whenever the visible snapshots change
  useEffect(() => {
    const cache = linkedLeiNamesCache.current
    const leiCodes = new Set<string>()
    for (const snap of [selectedSnapshot, compareSnapshot]) {
      for (const fieldKey of [...LEI_CODE_FIELDS]) {
        const val = snap[fieldKey]
        if (typeof val === 'string' && val.trim().length > 0) leiCodes.add(val.trim())
      }
    }
    const toFetch = [...leiCodes].filter((code) => !cache.has(code))
    if (toFetch.length === 0) return
    toFetch.forEach((code) => cache.set(code, '')) // mark as in-progress
    void Promise.all(
      toFetch.map(async (code) => {
        try {
          const res = await fetch(`${apiBaseUrl}/api/v1/lei/${encodeURIComponent(code)}`)
          if (res.ok) {
            const data: { legal_name?: string } = await res.json()
            cache.set(code, data.legal_name || '')
          }
        } catch {
          // best-effort: name display is non-critical
        }
      })
    ).then(() => setLinkedLeiNames(new Map(cache)))
  }, [selectedSnapshot, compareSnapshot, apiBaseUrl])

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

  /** Index of each column key in availableColumns — used to sort the diff panel. */
  const columnOrder = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>()
    availableColumns.forEach((col, idx) => map.set(col.key, idx))
    return map
  }, [availableColumns])

  /** Map from column key → groupKey for diff panel section headers. */
  const columnGroupMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>()
    availableColumns.forEach((col) => map.set(col.key, col.groupKey))
    return map
  }, [availableColumns])

  /** Changed field entries sorted by column config order. */
  const activeChangedFields = compareMode ? compareChangedFields : selectedChangedFields
  const sortedChangedFieldEntries = useMemo<Array<[string, ParsedChangedFields[string]]>>(() => {
    const entries = Object.entries(activeChangedFields)
    return entries.sort((a, b) => (columnOrder.get(a[0]) ?? 999) - (columnOrder.get(b[0]) ?? 999))
  }, [activeChangedFields, columnOrder])

  /**
   * Positioning percentages for the compare-range highlight on the slider.
   * `null` when compare mode is inactive or no second version is selected.
   */
  const sliderRangeStyle = useMemo<{ left: string; right: string } | null>(() => {
    if (!compareMode || resolvedCompareIndex === null || audits.length <= 1) return null
    const total = audits.length - 1
    const lo = Math.min(selectedIndex, resolvedCompareIndex)
    const hi = Math.max(selectedIndex, resolvedCompareIndex)
    return {
      left: `${(lo / total) * 100}%`,
      right: `${100 - (hi / total) * 100}%`,
    }
  }, [compareMode, resolvedCompareIndex, selectedIndex, audits.length])

  return (
    <div
      role="presentation"
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- role=dialog is interactive per ARIA spec; stopPropagation is required for backdrop click-to-close */}
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
                <p className="text-sm theme-text-muted mt-0.5 break-words leading-5">{legalName}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Column selector — groups + Select All + Reset, matching LEI page style */}
              <div className="relative">
                <button
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="px-3 py-1.5 rounded-lg theme-btn-neutral text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  title={t('leiAudit.selectColumns')}
                >
                  {formatLabel(`⚙️ ${t('leiAudit.columns')} (${localColumns.size})`)}
                </button>
                {showColumnSelector && (
                  // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                  <div
                    className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto theme-scrollbar theme-dropdown rounded-lg shadow-xl z-50"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.stopPropagation()
                        setShowColumnSelector(false)
                      }
                    }}
                  >
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
                {formatLabel(t('leiAudit.showChangedOnly'))}
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
                {formatLabel(t('leiAudit.compareMode'))}
              </button>

              {/* Names / Codes display toggle */}
              <button
                onClick={() => setShowCodes(!showCodes)}
                className="px-3 py-1.5 rounded-lg theme-btn-neutral text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title={showCodes ? t('leiAudit.displayToggleNamesTitle') : t('leiAudit.displayToggleCodesTitle')}
              >
                {formatLabel(showCodes ? t('leiAudit.displayToggleCodes') : t('leiAudit.displayToggleNames'))}
              </button>

              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg theme-btn-neutral text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title={t('leiRecords.modal.close')}
              >
                {formatLabel(t('leiRecords.modal.close'))}
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
                <div className="relative flex-1">
                  <input
                    type="range"
                    min={0}
                    max={audits.length - 1}
                    value={selectedIndex}
                    onChange={(e) => setSelectedIndex(Number(e.target.value))}
                    className="w-full h-2 accent-[rgb(var(--primary-rgb))]"
                    aria-label={t('leiAudit.timelineSlider')}
                    aria-valuetext={t('leiAudit.viewingVersion', {
                      current: audits.length - selectedIndex,
                      total: audits.length,
                    })}
                  />
                  {/* Range highlight between selected and compare version */}
                  {sliderRangeStyle && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 pointer-events-none">
                      <div
                        className="absolute h-full bg-blue-400/50 dark:bg-blue-500/50 rounded-full"
                        style={sliderRangeStyle}
                        aria-hidden="true"
                      />
                    </div>
                  )}
                </div>
                <span className="text-xs theme-text-muted whitespace-nowrap">
                  {t('leiAudit.oldest')}
                </span>
              </div>
              <p className="text-xs theme-text-muted text-center mt-1">
                {t('leiAudit.viewingVersion', {
                  current: audits.length - selectedIndex,
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
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs font-mono text-[rgb(var(--muted-foreground-rgb,128,128,128))] opacity-60">
                            v{audits.length - idx}
                          </span>
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
                          {/* Header — field column matches w-44 in snapshot table */}
                          <div
                            className="grid gap-2 text-xs font-semibold theme-text-muted border-b border-amber-200 dark:border-amber-800 pb-1 mb-1"
                            style={{ gridTemplateColumns: '11rem minmax(0, 1fr) minmax(0, 1fr)' }}
                          >
                            <span>{t('leiAudit.field')}</span>
                            <span className="text-red-600 dark:text-red-400">{t('leiAudit.oldValue')}</span>
                            <span className="text-green-700 dark:text-green-400">{t('leiAudit.newValue')}</span>
                          </div>
                          {sortedChangedFieldEntries.map(([field, change], i) => {
                            const group = columnGroupMap.get(field)
                            const prevGroup = i > 0 ? columnGroupMap.get(sortedChangedFieldEntries[i - 1][0]) : undefined
                            const showGroupHeader = group && group !== prevGroup
                            const alignedRows = alignMultilineDiffRows(field, change.old_value, change.new_value)
                            const useAlignedRows = alignedRows.length > 0
                            return (
                              <React.Fragment key={field}>
                                {showGroupHeader && (
                                  <div className="text-xs font-semibold theme-text-muted uppercase tracking-wider pt-1.5 border-t border-amber-200 dark:border-amber-700 mt-1">
                                    {t(group)}
                                  </div>
                                )}
                                {useAlignedRows ? (
                                  <div className="grid gap-2 text-xs" style={{ gridTemplateColumns: '11rem minmax(0, 1fr) minmax(0, 1fr)' }}>
                                    <span className="font-medium text-[rgb(var(--foreground-rgb))]">{labelMap.get(field) ?? formatFieldLabel(field)}</span>
                                    <div className="space-y-1">
                                      {alignedRows.map((row, rowIndex) => (
                                        <div
                                          key={`${field}-old-${rowIndex}`}
                                          className={`px-2 py-1 rounded whitespace-pre-wrap break-words ${
                                            row.state === 'removed'
                                              ? 'bg-red-100/70 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                              : row.state === 'unchanged'
                                                ? 'theme-text-muted'
                                                : 'theme-text-muted opacity-70'
                                          }`}
                                        >
                                          {row.oldLine ?? '—'}
                                        </div>
                                      ))}
                                    </div>
                                    <div className="space-y-1">
                                      {alignedRows.map((row, rowIndex) => (
                                        <div
                                          key={`${field}-new-${rowIndex}`}
                                          className={`px-2 py-1 rounded whitespace-pre-wrap break-words ${
                                            row.state === 'added'
                                              ? 'bg-green-100/70 dark:bg-green-900/30 text-green-800 dark:text-green-300 font-medium'
                                              : row.state === 'unchanged'
                                                ? 'theme-text-muted'
                                                : 'theme-text-muted opacity-70'
                                          }`}
                                        >
                                          {row.newLine ?? '—'}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    className="grid gap-2 text-xs"
                                    style={{ gridTemplateColumns: '11rem minmax(0, 1fr) minmax(0, 1fr)' }}
                                  >
                                    <span className="font-medium text-[rgb(var(--foreground-rgb))]">
                                      {labelMap.get(field) ?? formatFieldLabel(field)}
                                    </span>
                                    <span className="text-red-600 dark:text-red-400 break-words">
                                      <SnapshotValue fieldKey={field} value={change.old_value} showCodes={showCodes} countryByCode={countryByCode} onLeiClick={onLeiClick} linkedLeiNames={linkedLeiNames} registrationAuthorityNameByCode={registrationAuthorityNameByCode} registrationAuthorityFallback={registrationAuthorityFallback} />
                                    </span>
                                    <span className="text-green-600 dark:text-green-400 font-medium break-words">
                                      <SnapshotValue fieldKey={field} value={change.new_value} showCodes={showCodes} countryByCode={countryByCode} onLeiClick={onLeiClick} linkedLeiNames={linkedLeiNames} registrationAuthorityNameByCode={registrationAuthorityNameByCode} registrationAuthorityFallback={registrationAuthorityFallback} />
                                    </span>
                                  </div>
                                )}
                              </React.Fragment>
                            )
                          })}
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
                          newerLabel={`v${audits.length - (newerIdx ?? 0)} — ${formatTimestamp(newerAudit.created_at)}${(newerIdx ?? 0) === 0 ? ` (${t('leiAudit.latest')})` : ''}`}
                          olderLabel={`v${audits.length - (olderIdx ?? 0)} — ${formatTimestamp(olderAudit.created_at)}`}
                          showCodes={showCodes}
                          countryByCode={countryByCode}
                          onLeiClick={onLeiClick}
                          linkedLeiNames={linkedLeiNames}
                          registrationAuthorityNameByCode={registrationAuthorityNameByCode}
                          registrationAuthorityFallback={registrationAuthorityFallback}
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
                        onLeiClick={onLeiClick}
                        linkedLeiNames={linkedLeiNames}
                        registrationAuthorityNameByCode={registrationAuthorityNameByCode}
                        registrationAuthorityFallback={registrationAuthorityFallback}
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
