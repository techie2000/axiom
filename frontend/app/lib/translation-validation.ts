/**
 * Translation value validation utilities.
 *
 * Enforces safe i18next nesting patterns to prevent unsafe option blocks
 * like $t(key, {...}) from being stored in translation inputs.
 */

export const validateTranslationValue = (value: string): { valid: boolean; errorKey?: string } => {
  if (!value) return { valid: true }

  // Check if value contains $t(...) nesting syntax
  if (value.includes('$t(')) {
    // Extract all $t(...) occurrences to validate they're safe
    const nestingPattern = /\$t\(([^)]*)\)/g
    const matches = Array.from(value.matchAll(nestingPattern))

    for (const match of matches) {
      const content = match[1]
      // Check for unsafe patterns: commas or braces indicate option blocks like $t(key, {...})
      if (content.includes(',') || content.includes('{') || content.includes('[')) {
        return {
          valid: false,
          errorKey: 'admin.translations.errors.validation.unsafeNestingOptions',
        }
      }
    }
  }

  return { valid: true }
}
