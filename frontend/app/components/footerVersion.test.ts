import { describe, expect, it } from 'vitest'

import { buildFooterVersionTooltip } from './footerVersion'

describe('buildFooterVersionTooltip', () => {
  it('includes version, commit, and build date when available', () => {
    expect(
      buildFooterVersionTooltip({
        version: '0.3.1',
        gitCommit: 'abc1234',
        buildDate: '2026-04-08T12:34:56Z',
      })
    ).toBe('Axiom v0.3.1\nCommit: abc1234\nBuilt: 2026-04-08T12:34:56Z')
  })

  it('omits unknown metadata values', () => {
    expect(
      buildFooterVersionTooltip({
        version: '0.3.1',
        gitCommit: 'unknown',
        buildDate: ' ',
      })
    ).toBe('Axiom v0.3.1')
  })

  it('returns undefined when the version is not usable', () => {
    expect(buildFooterVersionTooltip({ version: 'unknown' })).toBeUndefined()
    expect(buildFooterVersionTooltip({ version: '   ' })).toBeUndefined()
  })
})