export type DashboardSectionId =
  | 'public-reference-data'
  | 'master-data-management'
  | 'data-acquisition-processing'
  | 'administration'

export interface DashboardSectionMeta {
  id: DashboardSectionId
  titleKey: string
  href: string
}

export interface DashboardPageSectionMeta {
  section: DashboardSectionMeta
  pageTitleKey: string
}

const DASHBOARD_SECTIONS: Record<DashboardSectionId, DashboardSectionMeta> = {
  'public-reference-data': {
    id: 'public-reference-data',
    titleKey: 'leftNav.sections.publicData',
    href: '/dashboard?section=public-reference-data',
  },
  'master-data-management': {
    id: 'master-data-management',
    titleKey: 'leftNav.sections.masterData',
    href: '/dashboard?section=master-data-management',
  },
  'data-acquisition-processing': {
    id: 'data-acquisition-processing',
    titleKey: 'leftNav.sections.dataAcquisition',
    href: '/dashboard?section=data-acquisition-processing',
  },
  administration: {
    id: 'administration',
    titleKey: 'leftNav.sections.admin',
    href: '/dashboard?section=administration',
  },
}

const DASHBOARD_PAGE_SECTION_MAP: Record<string, { sectionId: DashboardSectionId; pageTitleKey: string }> = {
  '/countries': { sectionId: 'public-reference-data', pageTitleKey: 'leftNav.items.countries' },
  '/currencies': { sectionId: 'public-reference-data', pageTitleKey: 'leftNav.items.currencies' },
  '/languages': { sectionId: 'public-reference-data', pageTitleKey: 'leftNav.items.languages' },
  '/lei-records': { sectionId: 'public-reference-data', pageTitleKey: 'leftNav.items.leiRecords' },

  '/instruments': { sectionId: 'master-data-management', pageTitleKey: 'leftNav.items.instruments' },
  '/accounts': { sectionId: 'master-data-management', pageTitleKey: 'leftNav.items.accounts' },
  '/ssi': { sectionId: 'master-data-management', pageTitleKey: 'leftNav.items.ssi' },
  '/code-mappings': { sectionId: 'master-data-management', pageTitleKey: 'leftNav.items.codeMappings' },

  '/lei': { sectionId: 'data-acquisition-processing', pageTitleKey: 'leftNav.items.syncTriggers' },

  '/admin/users': { sectionId: 'administration', pageTitleKey: 'leftNav.items.adminUsers' },
  '/admin/translations': { sectionId: 'administration', pageTitleKey: 'leftNav.items.adminTranslations' },
}

export function getDashboardSectionById(id: string | null | undefined): DashboardSectionMeta | null {
  if (!id) {
    return null
  }

  const normalized = id.trim().toLowerCase() as DashboardSectionId
  return DASHBOARD_SECTIONS[normalized] ?? null
}

export function getDashboardPageSection(pathname: string | null | undefined): DashboardPageSectionMeta | null {
  if (!pathname) {
    return null
  }

  const route = DASHBOARD_PAGE_SECTION_MAP[pathname]
  if (!route) {
    return null
  }

  return {
    section: DASHBOARD_SECTIONS[route.sectionId],
    pageTitleKey: route.pageTitleKey,
  }
}
