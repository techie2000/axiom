const DOCS_USER_BASE_URL = 'https://techie2000.github.io/axiom/docs-user'

const INDEX_PATHS = new Set([
  '',
  'getting-started',
  'workflows',
  'admin',
  'reference',
  'troubleshooting',
])

export function buildDocsUrl(relativePath: string): string {
  const sanitizedPath = relativePath.replace(/^\/+|\/+$/g, '')

  if (INDEX_PATHS.has(sanitizedPath)) {
    return sanitizedPath ? `${DOCS_USER_BASE_URL}/${sanitizedPath}/` : `${DOCS_USER_BASE_URL}/`
  }

  return `${DOCS_USER_BASE_URL}/${sanitizedPath}.html`
}
