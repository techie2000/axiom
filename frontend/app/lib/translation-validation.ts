/**
 * Translation value validation utilities.
 *
 * Enforces safe i18next nesting patterns to prevent unsafe option blocks
 * like $t(key, {...}) from being stored in translation inputs.
 */

export const validateTranslationValue = (value: string): { valid: boolean; error?: string } => {
  if (!value) return { valid: true }

  // Check if value contains $t(...) nesting syntax
  if (value.includes('$t(')) {
    // Extract the content inside $t(...) to validate it's safe
    const nestingPattern = /\$t\(([^)]*)\)/
    const match = value.match(nestingPattern)

    if (match) {
      const content = match[1]
      // Check for unsafe patterns: commas or braces indicate option blocks like $t(key, {...})
      if (content.includes(',') || content.includes('{') || content.includes('[')) {
        return {
          valid: false,
          error:
            'Unsafe nesting options detected. Use simple pointer form: $t(key) or $t(some.nested.key). ' +
            'Option blocks like $t(key, {...}) are not allowed.',
        }
      }
    }
  }

  return { valid: true }
}
