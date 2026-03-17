const DOCS_USER_BASE_URL = 'https://techie2000.github.io/axiom/docs-user'

export function buildDocsUrl(relativePath: string): string {
  const sanitizedPath = relativePath.replace(/^\/+/, '')
  return `${DOCS_USER_BASE_URL}/${sanitizedPath}`
}
