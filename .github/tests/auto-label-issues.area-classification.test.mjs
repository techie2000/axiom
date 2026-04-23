import test from 'node:test'
import assert from 'node:assert/strict'

const areaKeywordRules = [
  {
    label: 'area:lei',
    patterns: [/\blei\b/, /\bgleif\b/, /\blevel[- ]?2\b/, /\brelationship record\b/, /\breporting exception\b/]
  },
  { label: 'area:ci', patterns: [/\bgithub actions\b/, /\bworkflow\b/, /\bci\/cd\b/] },
  {
    label: 'area:database',
    patterns: [
      /\b(?:db|database|sql|schema|postgres(?:ql)?)\s+migrations?\b/,
      /\bmigrations?\s+table\b/,
      /\bpostgres\b/,
      /\bschema\b/
    ]
  },
  { label: 'area:infra', patterns: [/\bdocker\b/, /\bcontainer\b/, /\bcompose\b/, /\bnginx\b/] },
  { label: 'area:frontend', patterns: [/\breact\b/, /\bnext\.?js\b/, /\btailwind\b/, /\bi18n\b/] },
  { label: 'area:backend', patterns: [/\bgolang\b/, /\bgo service\b/, /\bgorm\b/] },
  { label: 'area:dependencies', patterns: [/\bdependabot\b/, /\bdependency\b/, /\bgo\.mod\b/, /\bpackage\.json\b/] },
  { label: 'area:docs', patterns: [/\badr\b/, /\barchitecture decision\b/] }
]

function inferArea(title, body) {
  const text = `${(title || '').toLowerCase()}\n${(body || '').toLowerCase()}`
  const match = areaKeywordRules.find((rule) => rule.patterns.some((pattern) => pattern.test(text)))
  return match ? match.label : ''
}

test('classifies GitHub Actions migration guidance issue as CI, not database', () => {
  const area = inferArea(
    'Remove non-standard FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 runtime variable usage',
    "Use GitHub's official migration guidance for JavaScript actions runtime deprecations in workflow files."
  )

  assert.equal(area, 'area:ci')
})

test('still classifies schema migration issues as database', () => {
  const area = inferArea(
    'Add database migration for retry tracking',
    'Create PostgreSQL schema migration and apply migration table updates.'
  )

  assert.equal(area, 'area:database')
})
