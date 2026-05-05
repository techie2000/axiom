import test from 'node:test'
import assert from 'node:assert/strict'

const labelRules = [
  {
    label: 'bug',
    patterns: [/\bbug\b/, /\berror\b/, /\bfail(?:ed|ure)?\b/, /\bbroken\b/, /\bregression\b/],
    negativePatterns: [/\bno regression\b/, /\bwithout regression\b/, /\bavoid regression\b/, /\bprevent regression\b/]
  },
  {
    label: 'enhancement',
    patterns: [/\bfeature\b/, /\benhancement\b/, /\bimprovement\b/, /\bproposal\b/, /\brequest\b/]
  },
  {
    label: 'security',
    patterns: [/\bsecurity\b/, /\bvulnerab(?:ility|le)\b/, /\bcve\b/, /\bauth(?:entication|orization)?\b/]
  },
  {
    label: 'performance',
    patterns: [/\bperformance\b/, /\bslow\b/, /\blatency\b/, /\bthroughput\b/, /\bmemory\b/]
  },
  {
    label: 'question',
    patterns: [/\bquestion\b/, /\?/]
  }
]

const actionIntentPatterns = [
  /\badd\b/,
  /\bimplement\b/,
  /\bcreate\b/,
  /\benable\b/,
  /\ballow\b/,
  /\bupdate\b/,
  /\brefactor\b/,
  /\bmigrate\b/,
  /\bremove\b/,
  /\bimprove\b/,
  /\bintroduce\b/,
  /\badd support\b/,
  /\bsupport for\b/
]

function inferCategoryLabels({ title, body }) {
  const issue = { title, body }
  const text = `${(title || '').toLowerCase()}\n${(body || '').toLowerCase()}`
  const inferred = []

  for (const rule of labelRules) {
    let hasPositiveMatch = rule.patterns.some((pattern) => pattern.test(text))
    let hasNegativeMatch = (rule.negativePatterns || []).some((pattern) => pattern.test(text))

    if (rule.label === 'bug') {
      const hasDirectBugSignal = [/\bbug\b/, /\berror\b/, /\bfail(?:ed|ure)?\b/, /\bbroken\b/].some((pattern) =>
        pattern.test(text)
      )
      const hasRegressionSignal = /\bregression\b/.test(text)
      const suppressRegressionSignal = (rule.negativePatterns || []).some((pattern) => pattern.test(text))

      hasPositiveMatch = hasDirectBugSignal || (hasRegressionSignal && !suppressRegressionSignal)
      hasNegativeMatch = false
    }

    if (rule.label === 'question') {
      const hasQuestionMark = /\?/.test(issue.title || '') || /\n##\s*question\b/i.test(issue.body || '')
      const hasQuestionKeyword = /\bquestion\b/.test(text)
      const hasActionIntent = actionIntentPatterns.some((pattern) => pattern.test(text))

      hasPositiveMatch = (hasQuestionMark || hasQuestionKeyword) && !hasActionIntent
      hasNegativeMatch = false
    }

    if (hasPositiveMatch && !hasNegativeMatch) {
      inferred.push(rule.label)
    }
  }

  return inferred
}

test('does not infer question for action-oriented feature request text', () => {
  const labels = inferCategoryLabels({
    title: 'Add per-column filtering to the code-mappings table',
    body:
      'Users need per-column filtering to narrow results by source system, code type, or status.\n\nAcceptance criteria:\n- Add a filter for each column.'
  })

  assert.equal(labels.includes('question'), false)
})

test('does infer question for explicit question-mark title', () => {
  const labels = inferCategoryLabels({
    title: 'How should we handle stale LEI records?',
    body: 'Need guidance on whether to archive or soft-delete.'
  })

  assert.equal(labels.includes('question'), true)
})

test('does infer question when support is used as a question verb', () => {
  const labels = inferCategoryLabels({
    title: 'Does the system support SSO?',
    body: 'Need to understand if this is already available.'
  })

  assert.equal(labels.includes('question'), true)
})

test('does not infer question when help text is action-oriented', () => {
  const labels = inferCategoryLabels({
    title: 'Add context help tooltip to code mappings filters',
    body: 'Implement helper tooltip content for first-time users.'
  })

  assert.equal(labels.includes('question'), false)
})
