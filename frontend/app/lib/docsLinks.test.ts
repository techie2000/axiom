import { describe, expect, it } from 'vitest'
import { buildDocsUrl } from './docsLinks'

describe('buildDocsUrl', () => {
  it('returns the published docs root for the empty path', () => {
    expect(buildDocsUrl('')).toBe('https://techie2000.github.io/axiom/docs-user/')
  })

  it('returns trailing-slash URLs for index sections', () => {
    expect(buildDocsUrl('workflows')).toBe('https://techie2000.github.io/axiom/docs-user/workflows/')
    expect(buildDocsUrl('/admin/')).toBe('https://techie2000.github.io/axiom/docs-user/admin/')
  })

  it('returns html URLs for leaf pages', () => {
    expect(buildDocsUrl('workflows/currencies')).toBe('https://techie2000.github.io/axiom/docs-user/workflows/currencies.html')
    expect(buildDocsUrl('/admin/translation-review/')).toBe('https://techie2000.github.io/axiom/docs-user/admin/translation-review.html')
  })
})