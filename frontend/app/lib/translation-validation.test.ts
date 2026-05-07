import { describe, expect, it } from 'vitest'
import { validateTranslationValue } from './translation-validation'

describe('validateTranslationValue', () => {
  describe('safe pointer patterns (should pass validation)', () => {
    it('accepts empty string', () => {
      const result = validateTranslationValue('')
      expect(result.valid).toBe(true)
      expect(result.errorKey).toBeUndefined()
    })

    it('accepts plain translation text without nesting', () => {
      const result = validateTranslationValue('Hello World')
      expect(result.valid).toBe(true)
      expect(result.errorKey).toBeUndefined()
    })

    it('accepts simple $t() pointer with single key', () => {
      const result = validateTranslationValue('$t(home.title)')
      expect(result.valid).toBe(true)
      expect(result.errorKey).toBeUndefined()
    })

    it('accepts $t() pointer with nested dot-separated key', () => {
      const result = validateTranslationValue('$t(reference.layout.header)')
      expect(result.valid).toBe(true)
      expect(result.errorKey).toBeUndefined()
    })

    it('accepts plain text with spaces and special characters', () => {
      const result = validateTranslationValue('Welcome to Axiom! Please sign in.')
      expect(result.valid).toBe(true)
      expect(result.errorKey).toBeUndefined()
    })

    it('accepts interpolation variables', () => {
      const result = validateTranslationValue('Hello {{name}}, welcome to {{appName}}')
      expect(result.valid).toBe(true)
      expect(result.errorKey).toBeUndefined()
    })

    it('accepts multiple $t() pointers in same string', () => {
      const result = validateTranslationValue('$t(prefix.label) - $t(suffix.label)')
      expect(result.valid).toBe(true)
      expect(result.errorKey).toBeUndefined()
    })
  })

  describe('unsafe nesting option patterns (should fail validation)', () => {
    it('rejects $t() with comma-separated arguments', () => {
      const result = validateTranslationValue('$t(key, "fallback")')
      expect(result.valid).toBe(false)
      expect(result.errorKey).toBe('admin.translations.errors.validation.unsafeNestingOptions')
    })

    it('rejects $t() with option object block', () => {
      const result = validateTranslationValue('$t(reference.key, {"x":"{{userInput}}"})')
      expect(result.valid).toBe(false)
      expect(result.errorKey).toBe('admin.translations.errors.validation.unsafeNestingOptions')
    })

    it('rejects $t() with array syntax', () => {
      const result = validateTranslationValue('$t(key, [1, 2, 3])')
      expect(result.valid).toBe(false)
      expect(result.errorKey).toBe('admin.translations.errors.validation.unsafeNestingOptions')
    })

    it('rejects $t() with nested curly braces for default value', () => {
      const result = validateTranslationValue('$t(key, {defaultValue: "text"})')
      expect(result.valid).toBe(false)
      expect(result.errorKey).toBe('admin.translations.errors.validation.unsafeNestingOptions')
    })

    it('rejects $t() with simple key and empty object', () => {
      const result = validateTranslationValue('$t(some.key, {})')
      expect(result.valid).toBe(false)
      expect(result.errorKey).toBe('admin.translations.errors.validation.unsafeNestingOptions')
    })

    it('rejects complex nesting with context object', () => {
      const result = validateTranslationValue('$t(key, {context: "plural"})')
      expect(result.valid).toBe(false)
      expect(result.errorKey).toBe('admin.translations.errors.validation.unsafeNestingOptions')
    })
  })

  describe('edge cases', () => {
    it('accepts $t() at start of string with plain text after', () => {
      const result = validateTranslationValue('$t(nav.home) or visit our website')
      expect(result.valid).toBe(true)
      expect(result.errorKey).toBeUndefined()
    })

    it('accepts mixed plain text and pointer', () => {
      const result = validateTranslationValue('See $t(help.docs) for more info')
      expect(result.valid).toBe(true)
      expect(result.errorKey).toBeUndefined()
    })

    it('handles whitespace within pointer', () => {
      const result = validateTranslationValue('$t( some . key )')
      expect(result.valid).toBe(true)
      expect(result.errorKey).toBeUndefined()
    })

    it('rejects even if unsafe pattern is in middle of string', () => {
      const result = validateTranslationValue('Please see $t(key, {option: "value"}) for details')
      expect(result.valid).toBe(false)
      expect(result.errorKey).toBe('admin.translations.errors.validation.unsafeNestingOptions')
    })
  })
})
