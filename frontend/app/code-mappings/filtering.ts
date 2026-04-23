export interface CodeMapping {
  id: string
  from_system: string
  to_system: string
  from_code_type: string
  to_code_type: string
  from_code: string
  to_code: string
  description: string
  active: boolean
}

export interface CodeMappingColumnFilters {
  fromSystem: string
  fromType: string
  fromCode: string
  toSystem: string
  toType: string
  toCode: string
  status: '' | 'active' | 'inactive'
}

export const DEFAULT_CODE_MAPPING_FILTERS: CodeMappingColumnFilters = {
  fromSystem: '',
  fromType: '',
  fromCode: '',
  toSystem: '',
  toType: '',
  toCode: '',
  status: '',
}

const normalized = (value: string): string => value.trim().toLowerCase()

export function countActiveCodeMappingFilters(filters: CodeMappingColumnFilters): number {
  return Object.values(filters).filter((value) => value !== '').length
}

export function getCodeMappingFilterOptions(mappings: CodeMapping[]): { fromSystems: string[]; toSystems: string[] } {
  const fromSystems = Array.from(new Set(mappings.map((mapping) => mapping.from_system).filter(Boolean))).sort()
  const toSystems = Array.from(new Set(mappings.map((mapping) => mapping.to_system).filter(Boolean))).sort()

  return { fromSystems, toSystems }
}

function matchesSearch(mapping: CodeMapping, searchTerm: string): boolean {
  const search = normalized(searchTerm)
  if (!search) {
    return true
  }

  return (
    mapping.from_system.toLowerCase().includes(search) ||
    mapping.to_system.toLowerCase().includes(search) ||
    mapping.from_code_type.toLowerCase().includes(search) ||
    mapping.to_code_type.toLowerCase().includes(search) ||
    mapping.from_code.toLowerCase().includes(search) ||
    mapping.to_code.toLowerCase().includes(search) ||
    (!!mapping.description && mapping.description.toLowerCase().includes(search))
  )
}

function matchesFilters(mapping: CodeMapping, filters: CodeMappingColumnFilters): boolean {
  if (filters.fromSystem && mapping.from_system !== filters.fromSystem) {
    return false
  }
  if (filters.toSystem && mapping.to_system !== filters.toSystem) {
    return false
  }
  if (filters.status === 'active' && !mapping.active) {
    return false
  }
  if (filters.status === 'inactive' && mapping.active) {
    return false
  }
  if (filters.fromType && !mapping.from_code_type.toLowerCase().includes(normalized(filters.fromType))) {
    return false
  }
  if (filters.toType && !mapping.to_code_type.toLowerCase().includes(normalized(filters.toType))) {
    return false
  }
  if (filters.fromCode && !mapping.from_code.toLowerCase().includes(normalized(filters.fromCode))) {
    return false
  }
  if (filters.toCode && !mapping.to_code.toLowerCase().includes(normalized(filters.toCode))) {
    return false
  }
  return true
}

export function filterCodeMappings(
  mappings: CodeMapping[],
  searchTerm: string,
  filters: CodeMappingColumnFilters
): CodeMapping[] {
  return mappings.filter((mapping) => matchesSearch(mapping, searchTerm) && matchesFilters(mapping, filters))
}
