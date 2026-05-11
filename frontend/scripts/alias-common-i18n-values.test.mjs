import { describe, it, expect } from 'vitest'
import {
  collectStringPathsByValue,
  buildAliasPlan,
  applyAliasPlan,
  aliasDuplicateValues,
} from './alias-common-i18n-values.mjs'

describe('i18n alias helpers', () => {
  describe('collectStringPathsByValue', () => {
    it('collects string values and maps them to paths', () => {
      const root = {
        common: {
          save: 'Save',
          cancel: 'Cancel',
        },
        admin: {
          save: 'Save',
        },
      }

      const result = collectStringPathsByValue(root)

      expect(result.get('Save')).toContain('common.save')
      expect(result.get('Save')).toContain('admin.save')
      expect(result.get('Cancel')).toContain('common.cancel')
    })

    it('skips values starting with $t(', () => {
      const root = {
        admin: {
          title: '$t(common.save)',
        },
      }

      const result = collectStringPathsByValue(root)

      expect(result.has('$t(common.save)')).toBe(false)
    })

    it('skips values with {{interpolation}}', () => {
      const root = {
        admin: {
          message: 'Hello {{name}}',
        },
      }

      const result = collectStringPathsByValue(root)

      expect(result.has('Hello {{name}}')).toBe(false)
    })

    it('skips empty strings', () => {
      const root = {
        admin: {
          empty: '',
        },
      }

      const result = collectStringPathsByValue(root)

      expect(result.has('')).toBe(false)
    })

    it('handles nested objects', () => {
      const root = {
        filters: {
          status: {
            active: 'Active',
          },
        },
      }

      const result = collectStringPathsByValue(root)

      expect(result.get('Active')).toContain('filters.status.active')
    })
  })

  describe('buildAliasPlan', () => {
    it('creates alias plan from duplicates', () => {
      const root = {
        common: {
          save: 'Save',
        },
        admin: {
          save: 'Save',
        },
      }

      const plan = buildAliasPlan(root)

      expect(plan.get('admin.save')).toBe('common.save')
    })

    it('prefers common.* as canonical target', () => {
      const root = {
        admin: {
          status: 'Status',
        },
        common: {
          status: 'Status',
        },
        filters: {
          status: 'Status',
        },
      }

      const plan = buildAliasPlan(root)

      expect(plan.get('admin.status')).toBe('common.status')
      expect(plan.get('filters.status')).toBe('common.status')
    })

    it('prevents self-alias', () => {
      const root = {
        common: {
          save: 'Save',
        },
        admin: {
          save: 'Save',
        },
      }

      const plan = buildAliasPlan(root)

      // common.save should not alias to itself
      expect(plan.has('common.save')).toBe(false)
    })

    it('ignores single occurrences', () => {
      const root = {
        admin: {
          unique: 'Unique value',
        },
      }

      const plan = buildAliasPlan(root)

      expect(plan.size).toBe(0)
    })
  })

  describe('applyAliasPlan', () => {
    it('applies aliases to non-common values', () => {
      const root = {
        common: {
          save: 'Save',
        },
        admin: {
          save: 'Save',
        },
      }

      const plan = new Map([['admin.save', 'common.save']])
      const count = applyAliasPlan(root, plan)

      expect(root.admin.save).toBe('$t(common.save)')
      expect(count).toBe(1)
    })

    it('does not rewrite common.* values', () => {
      const root = {
        common: {
          save: 'Save',
        },
      }

      const plan = new Map()
      applyAliasPlan(root, plan)

      // common.* should never be rewritten
      expect(root.common.save).toBe('Save')
    })

    it('skips values already containing $t(', () => {
      const root = {
        admin: {
          save: '$t(common.save)',
        },
      }

      const plan = new Map([['admin.save', 'common.save']])
      const count = applyAliasPlan(root, plan)

      // Should not double-wrap
      expect(root.admin.save).toBe('$t(common.save)')
      expect(count).toBe(0)
    })

    it('skips values with {{interpolation}}', () => {
      const root = {
        admin: {
          message: 'Hello {{name}}',
        },
      }

      const plan = new Map([['admin.message', 'common.message']])
      const count = applyAliasPlan(root, plan)

      // Should not alias interpolated values
      expect(root.admin.message).toBe('Hello {{name}}')
      expect(count).toBe(0)
    })

    it('handles nested paths', () => {
      const root = {
        common: {
          filters: {
            status: 'Status',
          },
        },
        admin: {
          filters: {
            status: 'Status',
          },
        },
      }

      const plan = new Map([['admin.filters.status', 'common.filters.status']])
      const count = applyAliasPlan(root, plan)

      expect(root.admin.filters.status).toBe('$t(common.filters.status)')
      expect(count).toBe(1)
    })

    it('counts multiple replacements', () => {
      const root = {
        common: {
          save: 'Save',
          cancel: 'Cancel',
        },
        admin: {
          save: 'Save',
          cancel: 'Cancel',
        },
      }

      const plan = new Map([
        ['admin.save', 'common.save'],
        ['admin.cancel', 'common.cancel'],
      ])
      const count = applyAliasPlan(root, plan)

      expect(count).toBe(2)
    })
  })

  describe('aliasDuplicateValues', () => {
    it('orchestrates full aliasing workflow', () => {
      const root = {
        common: {
          save: 'Save',
          cancel: 'Cancel',
        },
        admin: {
          save: 'Save',
          cancel: 'Cancel',
          other: 'Other',
        },
        filters: {
          cancel: 'Cancel',
        },
      }

      const count = aliasDuplicateValues(root)

      // Should alias both save and cancel to common, prefer common over admin
      expect(root.admin.save).toBe('$t(common.save)')
      expect(root.admin.cancel).toBe('$t(common.cancel)')
      expect(root.filters.cancel).toBe('$t(common.cancel)')
      expect(root.admin.other).toBe('Other')
      expect(root.common.save).toBe('Save')
      expect(count).toBe(3)
    })

    it('handles empty root gracefully', () => {
      const root = {}

      const count = aliasDuplicateValues(root)

      expect(count).toBe(0)
    })

    it('handles root with only common section', () => {
      const root = {
        common: {
          save: 'Save',
          cancel: 'Cancel',
        },
      }

      const count = aliasDuplicateValues(root)

      expect(count).toBe(0)
    })

    it('regression test: does not self-alias', () => {
      const root = {
        common: {
          save: 'Save',
        },
        admin: {
          save: 'Save',
        },
      }

      const count = aliasDuplicateValues(root)

      // Verify common.save is not aliased to itself
      expect(root.common.save).toBe('Save')
      expect(root.admin.save).toBe('$t(common.save)')
      expect(count).toBe(1)
    })
  })
})
