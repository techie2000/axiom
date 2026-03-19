import { describe, expect, it } from 'vitest'
import { resolveHydrationSafeLabel } from './PageHeader'

describe('resolveHydrationSafeLabel', () => {
  it('prefers an explicit label when one is provided', () => {
    expect(resolveHydrationSafeLabel('Docs', false, 'Dokumentation', 'Documentation')).toBe('Docs')
  })

  it('uses the fallback label before hydration', () => {
    expect(resolveHydrationSafeLabel(undefined, false, 'Dokumentation', 'Documentation')).toBe('Documentation')
  })

  it('uses the translated label after hydration', () => {
    expect(resolveHydrationSafeLabel(undefined, true, 'Dokumentation', 'Documentation')).toBe('Dokumentation')
  })
})