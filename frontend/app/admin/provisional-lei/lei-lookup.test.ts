import { describe, expect, it } from 'vitest'

import { getRelatedLeiNotFoundErrorKey, isCompleteLei } from '../../lib/provisional-lei-lookup'

describe('isCompleteLei', () => {
  it('returns true for 20-char alphanumeric LEI', () => {
    expect(isCompleteLei('529900T8BM49AURSDO55')).toBe(true)
  })

  it('normalizes lowercase and surrounding whitespace', () => {
    expect(isCompleteLei(' 529900t8bm49aursdo55 ')).toBe(true)
  })

  it('returns false for incomplete LEI', () => {
    expect(isCompleteLei('529900T8BM49AURSDO5')).toBe(false)
  })
})

describe('getRelatedLeiNotFoundErrorKey', () => {
  it('maps parent fields to parent error key', () => {
    expect(getRelatedLeiNotFoundErrorKey('createParent')).toBe('provisionalLei.errors.parentLeiNotFound')
    expect(getRelatedLeiNotFoundErrorKey('editParent')).toBe('provisionalLei.errors.parentLeiNotFound')
  })

  it('maps child fields to child error key', () => {
    expect(getRelatedLeiNotFoundErrorKey('createChild')).toBe('provisionalLei.errors.childLeiNotFound')
    expect(getRelatedLeiNotFoundErrorKey('editChild')).toBe('provisionalLei.errors.childLeiNotFound')
  })
})
