import { describe, expect, it } from 'vitest'
import { computeChangedFields, valuesDifferSemantically } from './LEIAuditHistoryModal'

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
