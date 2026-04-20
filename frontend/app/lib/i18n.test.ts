import { describe, expect, it } from 'vitest'
import i18n from './i18n'

describe('i18n bootstrap', () => {
  it('provides bundled english fallback strings during initial render', () => {
    expect(i18n.t('leiRecords.loading')).toBe('Loading LEI records...')
  })
})