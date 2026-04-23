import { describe, expect, it } from 'vitest'
import {
  countActiveCodeMappingFilters,
  DEFAULT_CODE_MAPPING_FILTERS,
  filterCodeMappings,
  getCodeMappingFilterOptions,
  type CodeMapping,
} from './filtering'

const sampleMappings: CodeMapping[] = [
  {
    id: '1',
    from_system: 'ALERT',
    to_system: 'ISO',
    from_code_type: 'currency',
    to_code_type: 'currency',
    from_code: 'SWE',
    to_code: 'SEK',
    description: 'Swedish krona',
    active: true,
  },
  {
    id: '2',
    from_system: 'SWIFT',
    to_system: 'ISO',
    from_code_type: 'country',
    to_code_type: 'country',
    from_code: 'GBR',
    to_code: 'GB',
    description: 'United Kingdom',
    active: false,
  },
  {
    id: '3',
    from_system: 'ALERT',
    to_system: 'AXIOM',
    from_code_type: 'instrument',
    to_code_type: 'instrument',
    from_code: 'BOND_001',
    to_code: 'FI_BOND_001',
    description: '',
    active: true,
  },
]

describe('filterCodeMappings', () => {
  it('applies free-text search and column filters together using AND logic', () => {
    const result = filterCodeMappings(sampleMappings, 'alert', {
      ...DEFAULT_CODE_MAPPING_FILTERS,
      toSystem: 'AXIOM',
      fromCode: 'bond',
    })

    expect(result.map((item) => item.id)).toEqual(['3'])
  })

  it('supports status-only filtering', () => {
    const result = filterCodeMappings(sampleMappings, '', {
      ...DEFAULT_CODE_MAPPING_FILTERS,
      status: 'inactive',
    })

    expect(result.map((item) => item.id)).toEqual(['2'])
  })

  it('returns empty result when combined filters conflict', () => {
    const result = filterCodeMappings(sampleMappings, 'alert', {
      ...DEFAULT_CODE_MAPPING_FILTERS,
      status: 'inactive',
    })

    expect(result).toEqual([])
  })
})

describe('code mapping filter helpers', () => {
  it('counts only non-empty filters as active', () => {
    const count = countActiveCodeMappingFilters({
      ...DEFAULT_CODE_MAPPING_FILTERS,
      fromSystem: 'ALERT',
      toCode: 'SEK',
      status: 'active',
    })

    expect(count).toBe(3)
  })

  it('returns sorted distinct dropdown options', () => {
    const options = getCodeMappingFilterOptions(sampleMappings)

    expect(options.fromSystems).toEqual(['ALERT', 'SWIFT'])
    expect(options.toSystems).toEqual(['AXIOM', 'ISO'])
  })
})
