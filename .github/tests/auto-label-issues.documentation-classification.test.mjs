import test from 'node:test'
import assert from 'node:assert/strict'

function allowPrefixOverride(existingTypedPrefix, hasExplicitTypedPrefix, needsRewrite, desiredPrefix, labelsToApply) {
  const typedPrefixCategoryMap = {
    bug: 'bug',
    feature: 'enhancement',
    security: 'security',
    performance: 'performance',
    question: 'question'
  }
  const existingTypedCategory = typedPrefixCategoryMap[existingTypedPrefix] || ''
  const hasStaleDocsPrefix = existingTypedPrefix === 'docs' && Boolean(desiredPrefix)
  const hasStaleTaskPrefix = existingTypedPrefix === 'task' && Boolean(desiredPrefix)
  const hasStaleTypedCategoryPrefix =
    hasStaleDocsPrefix ||
    hasStaleTaskPrefix ||
    (Boolean(existingTypedCategory) && !labelsToApply.includes(existingTypedCategory) && Boolean(desiredPrefix))

  return !hasExplicitTypedPrefix || needsRewrite || hasStaleTypedCategoryPrefix
}

test('allows overriding stale docs prefix when non-doc category is inferred', () => {
  const canOverride = allowPrefixOverride('docs', true, false, '[Feature]', ['enhancement'])
  assert.equal(canOverride, true)
})

test('does not force override for matching typed prefix category', () => {
  const canOverride = allowPrefixOverride('security', true, false, '[Security]', ['security'])
  assert.equal(canOverride, false)
})

test('allows overriding stale task prefix when strong category is inferred', () => {
  const canOverride = allowPrefixOverride('task', true, false, '[Bug]', ['bug'])
  assert.equal(canOverride, true)
})
