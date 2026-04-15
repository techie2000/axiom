import { describe, expect, it } from 'vitest'
import {
  formatEnumDisplayValue,
  formatLEICellValue,
  formatLEIDisplayValue,
  getStatusBadgePresentation,
  getRegistrationStatusBadgePresentation,
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
    expect(formatLEICellValue('NOT_AVAILABLE', 'registration_status')).toBe('Not Available')
    expect(formatLEICellValue('NULL', 'entity_category')).toBe('-')
  })
})

describe('getRegistrationStatusBadgePresentation', () => {
  it('returns green badge for ISSUED status', () => {
    const result = getRegistrationStatusBadgePresentation('ISSUED')
    expect(result).toEqual({
      label: 'ISSUED',
      variant: 'success',
    })
  })

  it('returns red badge for LAPSED status', () => {
    const result = getRegistrationStatusBadgePresentation('LAPSED')
    expect(result).toEqual({
      label: 'Lapsed',
      variant: 'destructive',
    })
  })

  it('returns red badge for RETIRED status', () => {
    const result = getRegistrationStatusBadgePresentation('RETIRED')
    expect(result).toEqual({
      label: 'Retired',
      variant: 'destructive',
    })
  })

  it('returns red badge for ANNULLED status', () => {
    const result = getRegistrationStatusBadgePresentation('ANNULLED')
    expect(result).toEqual({
      label: 'Annulled',
      variant: 'destructive',
    })
  })

  it('returns red badge for DUPLICATE status', () => {
    const result = getRegistrationStatusBadgePresentation('DUPLICATE')
    expect(result).toEqual({
      label: 'Duplicate',
      variant: 'destructive',
    })
  })

  it('returns amber badge for PENDING_TRANSFER status', () => {
    const result = getRegistrationStatusBadgePresentation('PENDING_TRANSFER')
    expect(result).toEqual({
      label: 'Pending Transfer',
      variant: 'warning',
    })
  })

  it('returns amber badge for PENDING_ARCHIVAL status', () => {
    const result = getRegistrationStatusBadgePresentation('PENDING_ARCHIVAL')
    expect(result).toEqual({
      label: 'Pending Archival',
      variant: 'warning',
    })
  })

  it('returns grey badge for unknown status', () => {
    const result = getRegistrationStatusBadgePresentation('UNKNOWN_STATUS')
    expect(result).toEqual({
      label: 'Unknown Status',
      variant: 'muted',
    })
  })

  it('handles lowercase input correctly', () => {
    const result = getRegistrationStatusBadgePresentation('issued')
    expect(result).toEqual({
      label: 'ISSUED',
      variant: 'success',
    })
  })

  it('handles empty string', () => {
    const result = getRegistrationStatusBadgePresentation('')
    expect(result.variant).toBe('muted')
  })

  it('handles null value', () => {
    const result = getRegistrationStatusBadgePresentation(null)
    expect(result.variant).toBe('muted')
  })
})
