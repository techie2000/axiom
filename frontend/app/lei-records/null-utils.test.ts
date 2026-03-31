import { describe, expect, it } from 'vitest'
import {
  formatEnumDisplayValue,
  formatLEICellValue,
  formatLEIDisplayValue,
  getStatusBadgePresentation,
  isNullLikeValue,
  normalizeRecordNullLikeValues,
} from './null-utils'

describe('LEI null-like value helpers', () => {
  it('detects null-like string values', () => {
    expect(isNullLikeValue('NULL')).toBe(true)
    expect(isNullLikeValue(' null ')).toBe(true)
    expect(isNullLikeValue('NuLl')).toBe(true)
    expect(isNullLikeValue('ACTIVE')).toBe(false)
    expect(isNullLikeValue(null)).toBe(false)
  })

  it('normalizes null-like record fields to empty strings', () => {
    const input = {
      entity_status: 'NULL',
      legal_name: 'ABC LIMITED',
      managing_lou: ' null ',
      entity_category: 'GENERAL',
    }

    const normalized = normalizeRecordNullLikeValues(input)

    expect(normalized.entity_status).toBe('')
    expect(normalized.managing_lou).toBe('')
    expect(normalized.legal_name).toBe('ABC LIMITED')
    expect(normalized.entity_category).toBe('GENERAL')
  })

  it('formats null-like values for UI display', () => {
    expect(formatLEIDisplayValue('NULL')).toBe('-')
    expect(formatLEIDisplayValue(' null ')).toBe('-')
    expect(formatLEIDisplayValue(undefined)).toBe('-')
    expect(formatLEIDisplayValue('ACTIVE')).toBe('ACTIVE')
    expect(formatLEIDisplayValue('0001-01-01T00:00:00Z')).toBe('-')
  })

  it('title-cases enum values for display', () => {
    expect(formatEnumDisplayValue('FUND')).toBe('Fund')
    expect(formatEnumDisplayValue('GENERAL')).toBe('General')
    expect(formatEnumDisplayValue('SOLE_PROPRIETOR')).toBe('Sole Proprietor')
    expect(formatEnumDisplayValue('NULL')).toBe('-')
    expect(formatEnumDisplayValue(undefined)).toBe('-')
  })

  it('maps status badge label and active branch correctly', () => {
    const nullStatus = getStatusBadgePresentation('NULL')
    expect(nullStatus.label).toBe('-')
    expect(nullStatus.isActive).toBe(false)

    const activeStatus = getStatusBadgePresentation('ACTIVE')
    expect(activeStatus.label).toBe('ACTIVE')
    expect(activeStatus.isActive).toBe(true)
  })

  it('formats LEI cell values for date and null-like paths', () => {
    expect(formatLEICellValue('2022-03-14T00:00:00Z', 'last_update_date')).toBe('2022-03-14')
    expect(formatLEICellValue('NULL', 'entity_status')).toBe('-')
    expect(formatLEICellValue('ACTIVE', 'entity_status')).toBe('ACTIVE')
  })

  it('title-cases entity_category and entity_sub_category cell values', () => {
    expect(formatLEICellValue('GENERAL', 'entity_category')).toBe('General')
    expect(formatLEICellValue('BRANCH', 'entity_sub_category')).toBe('Branch')
    expect(formatLEICellValue('NULL', 'entity_category')).toBe('-')
  })
})
