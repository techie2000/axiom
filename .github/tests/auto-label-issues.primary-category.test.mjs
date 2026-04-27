import test from 'node:test'
import assert from 'node:assert/strict'

const categoryPriority = ['bug', 'security', 'performance', 'enhancement', 'question']

function getPrimaryCategory(categories) {
  return [...categories]
    .sort((a, b) => {
      const aRank = categoryPriority.indexOf(a)
      const bRank = categoryPriority.indexOf(b)
      return (aRank === -1 ? Number.MAX_SAFE_INTEGER : aRank) - (bRank === -1 ? Number.MAX_SAFE_INTEGER : bRank)
    })
    .at(0)
}

test('prefers security over enhancement when both categories are present', () => {
  const primary = getPrimaryCategory(['enhancement', 'security'])
  assert.equal(primary, 'security')
})

test('prefers bug over all other categories', () => {
  const primary = getPrimaryCategory(['enhancement', 'question', 'bug'])
  assert.equal(primary, 'bug')
})
