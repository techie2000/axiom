import { describe, expect, it } from 'vitest'
import { computeChangedFields, formatSnapshotValue, valuesDifferSemantically } from './LEIAuditHistoryModal'

describe('formatSnapshotValue', () => {
  it('returns — for null', () => {
    expect(formatSnapshotValue(null)).toBe('—')
  })

  it('returns — for undefined', () => {
    expect(formatSnapshotValue(undefined)).toBe('—')
  })

  it('returns — for empty string', () => {
    expect(formatSnapshotValue('')).toBe('—')
  })

  it('returns — for an empty object (e.g. validation_sources stored as JSONB {})', () => {
    expect(formatSnapshotValue({})).toBe('—')
  })

  it('returns — for an empty-object JSON string "{}"', () => {
    expect(formatSnapshotValue('{}')).toBe('—')
  })

  it('returns — for an empty array', () => {
    expect(formatSnapshotValue([])).toBe('—')
  })

  it('returns the raw enum string for a non-empty validation_sources value', () => {
    // formatSnapshotValue returns the raw string; SnapshotValue applies underscore→space rendering
    expect(formatSnapshotValue('FULLY_CORROBORATED')).toBe('FULLY_CORROBORATED')
  })

  it('formats ISO date strings to yyyy-mm-dd', () => {
    expect(formatSnapshotValue('2026-04-11T00:00:00Z')).toBe('2026-04-11')
  })

  it('returns — for Go zero-date strings', () => {
    expect(formatSnapshotValue('0001-01-01T00:00:00Z')).toBe('—')
  })

  it('returns JSON for non-empty objects', () => {
    expect(formatSnapshotValue({ key: 'value' })).toBe('{"key":"value"}')
  })
})

describe('valuesDifferSemantically', () => {
  it('treats JSON object strings with different key order as equal', () => {
    const left = '{"name":"A","type":"LOCAL","language":"en"}'
    const right = '{"language":"en","type":"LOCAL","name":"A"}'

    expect(valuesDifferSemantically(left, right)).toBe(false)
  })

  it('detects real JSON value differences', () => {
    const left = '{"name":"A","type":"LOCAL","language":"en"}'
    const right = '{"name":"A","type":"ALT","language":"en"}'

    expect(valuesDifferSemantically(left, right)).toBe(true)
  })
})

describe('computeChangedFields', () => {
  it('does not flag JSON-like string fields changed only by key order', () => {
    const olderSnapshot = {
      other_names: '[{"name":"Alpha","type":"LOCAL","language":"en"}]',
      legal_name: 'Acme Ltd',
    }
    const newerSnapshot = {
      other_names: '[{"language":"en","type":"LOCAL","name":"Alpha"}]',
      legal_name: 'Acme Ltd',
    }

    expect(computeChangedFields(olderSnapshot, newerSnapshot)).toEqual({})
  })

  it('still flags non-JSON fields with real changes', () => {
    const olderSnapshot = {
      legal_name: 'Acme Ltd',
    }
    const newerSnapshot = {
      legal_name: 'Acme Holdings Ltd',
    }

    expect(computeChangedFields(olderSnapshot, newerSnapshot)).toEqual({
      legal_name: {
        old_value: 'Acme Ltd',
        new_value: 'Acme Holdings Ltd',
        field_name: 'legal_name',
      },
    })
  })
})
