import { defineConfig } from 'vitepress'

const rawDocsBase = process.env.DOCS_BASE || '/docs-user/'

function normalizeBase(base: string): string {
  let normalized = base.trim()

  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }

  if (!normalized.endsWith('/')) {
    normalized = `${normalized}/`
  }

  return normalized
}

const docsBase = normalizeBase(rawDocsBase)

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Axiom User Documentation',
  description: 'End-user documentation for the Axiom financial services static data platform.',
  base: docsBase,

  // Ignore dead links pointing to engineering docs outside this site root
  ignoreDeadLinks: [
    /\/docs\//,
    /\.\.\/docs/,
  ],

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/logo.png',

    nav: [
      { text: 'Getting Started', link: '/getting-started/' },
      { text: 'Workflows', link: '/workflows/' },
      { text: 'Admin', link: '/admin/' },
      { text: 'Reference', link: '/reference/' },
      { text: 'Troubleshooting', link: '/troubleshooting/' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        collapsed: false,
        items: [
          { text: 'Introduction', link: '/getting-started/' },
          { text: 'Sign In & Access', link: '/getting-started/sign-in-and-access' },
          { text: 'Navigation Basics', link: '/getting-started/navigation-basics' },
        ],
      },
      {
        text: 'Core Workflows',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/workflows/' },
          { text: 'LEI Records', link: '/workflows/lei-records' },
          { text: 'Settlement Instructions (SSI)', link: '/workflows/ssi' },
          { text: 'Countries', link: '/workflows/countries' },
          { text: 'Currencies', link: '/workflows/currencies' },
          { text: 'Languages', link: '/workflows/languages' },
          { text: 'Entities', link: '/workflows/entities' },
          { text: 'Instruments', link: '/workflows/instruments' },
          { text: 'Accounts', link: '/workflows/accounts' },
        ],
      },
      {
        text: 'Admin Workflows',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/admin/' },
          { text: 'Provisional LEI', link: '/admin/provisional-lei' },
          { text: 'User Approvals', link: '/admin/user-approvals' },
          { text: 'Translation Review', link: '/admin/translation-review' },
          { text: 'Sync Triggers', link: '/admin/sync-triggers' },
        ],
      },
      {
        text: 'Reference',
        collapsed: true,
        items: [
          { text: 'Overview', link: '/reference/' },
          { text: 'Data Dictionary', link: '/reference/data-dictionary' },
          { text: 'Statuses & States', link: '/reference/statuses-and-states' },
          { text: 'Permissions & Roles', link: '/reference/permissions-and-roles' },
        ],
      },
      {
        text: 'Troubleshooting',
        collapsed: true,
        items: [
          { text: 'Overview', link: '/troubleshooting/' },
          { text: 'Common Errors', link: '/troubleshooting/common-errors' },
          { text: 'FAQ', link: '/troubleshooting/faq' },
        ],
      },
    ],

    search: {
      provider: 'local',
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/techie2000/axiom' },
    ],

    footer: {
      message: 'Axiom Financial Services Static Data Platform',
      copyright: 'User Documentation — see <a href="../GOVERNANCE">Governance</a> for review and contribution guidance.',
    },

    editLink: {
      pattern: 'https://github.com/techie2000/axiom/edit/main/docs-user/:path',
      text: 'Edit this page on GitHub',
    },

    lastUpdated: {
      text: 'Last updated',
    },
  },

  markdown: {
    lineNumbers: false,
  },
})
