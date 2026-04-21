import { describe, expect, it } from 'vitest'
import { getDashboardPageSection, getDashboardSectionById } from './dashboard-sections'

describe('getDashboardSectionById', () => {
  it('returns section metadata for a known section id', () => {
    const section = getDashboardSectionById('master-data-management')

    expect(section?.titleKey).toBe('leftNav.sections.masterData')
    expect(section?.href).toBe('/dashboard?section=master-data-management')
  })

  it('returns null for unknown section ids', () => {
    expect(getDashboardSectionById('unknown')).toBeNull()
  })

  it('normalizes leading/trailing whitespace in the id', () => {
    const section = getDashboardSectionById('  master-data-management  ')

    expect(section?.id).toBe('master-data-management')
  })

  it('normalizes mixed-case ids', () => {
    const section = getDashboardSectionById('Master-Data-Management')

    expect(section?.id).toBe('master-data-management')
  })
})

describe('getDashboardPageSection', () => {
  it('maps dashboard page routes to section and page title keys', () => {
    const page = getDashboardPageSection('/code-mappings')

    expect(page?.section.id).toBe('master-data-management')
    expect(page?.pageTitleKey).toBe('leftNav.items.codeMappings')
  })

  it('returns null for routes that are not part of dashboard sections', () => {
    expect(getDashboardPageSection('/login')).toBeNull()
  })
})
