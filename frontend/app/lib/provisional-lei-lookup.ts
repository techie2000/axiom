export type ProvisionalLeiLookupField = 'createParent' | 'createChild' | 'editParent' | 'editChild'

export function isCompleteLei(value: string): boolean {
  return /^[A-Z0-9]{20}$/.test(String(value || '').trim().toUpperCase())
}

export function getRelatedLeiNotFoundErrorKey(fieldKey: ProvisionalLeiLookupField): string {
  return fieldKey.toLowerCase().includes('parent')
    ? 'provisionalLei.errors.parentLeiNotFound'
    : 'provisionalLei.errors.childLeiNotFound'
}
