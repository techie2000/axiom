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

const normalizeFilterValue = (value: string): string => {
  if (!value) {
    return ''
  }
  return value.trim().toLowerCase()
}

export function countActiveCodeMappingFilters(filters: CodeMappingColumnFilters): number {
  let activeCount = 0

  if (normalizeFilterValue(filters.fromSystem)) {
    activeCount++
  }
  if (normalizeFilterValue(filters.fromType)) {
    activeCount++
  }
  if (normalizeFilterValue(filters.fromCode)) {
    activeCount++
  }
  if (normalizeFilterValue(filters.toSystem)) {
    activeCount++
  }
  if (normalizeFilterValue(filters.toType)) {
    activeCount++
  }
  if (normalizeFilterValue(filters.toCode)) {
    activeCount++
  }
  if (filters.status.trim() !== '') {
    activeCount++
  }

  return activeCount
}

export function getCodeMappingFilterOptions(mappings: CodeMapping[]): { fromSystems: string[]; toSystems: string[] } {
  const fromSystems = Array.from(new Set(mappings.map((mapping) => mapping.from_system).filter(Boolean))).sort()
  const toSystems = Array.from(new Set(mappings.map((mapping) => mapping.to_system).filter(Boolean))).sort()

  return { fromSystems, toSystems }
}

function matchesSearch(mapping: CodeMapping, searchTerm: string): boolean {
  const search = normalizeFilterValue(searchTerm)
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
  const normalizedFromSystem = normalizeFilterValue(filters.fromSystem)
  const normalizedToSystem = normalizeFilterValue(filters.toSystem)
  const normalizedFromType = normalizeFilterValue(filters.fromType)
  const normalizedToType = normalizeFilterValue(filters.toType)
  const normalizedFromCode = normalizeFilterValue(filters.fromCode)
  const normalizedToCode = normalizeFilterValue(filters.toCode)

  if (normalizedFromSystem && normalizeFilterValue(mapping.from_system) !== normalizedFromSystem) {
    return false
  }
  if (normalizedToSystem && normalizeFilterValue(mapping.to_system) !== normalizedToSystem) {
    return false
  }
  if (filters.status === 'active' && !mapping.active) {
    return false
  }
  if (filters.status === 'inactive' && mapping.active) {
    return false
  }
  if (normalizedFromType && !mapping.from_code_type.toLowerCase().includes(normalizedFromType)) {
    return false
  }
  if (normalizedToType && !mapping.to_code_type.toLowerCase().includes(normalizedToType)) {
    return false
  }
  if (normalizedFromCode && !mapping.from_code.toLowerCase().includes(normalizedFromCode)) {
    return false
  }
  if (normalizedToCode && !mapping.to_code.toLowerCase().includes(normalizedToCode)) {
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
