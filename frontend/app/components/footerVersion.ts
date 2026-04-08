export type FooterVersionInfo = {
  version: string
  gitCommit?: string
  buildDate?: string
}

function normalizeMetadataValue(value?: string): string | null {
  if (!value) {
    return null
  }

  const normalized = value.trim()
  if (!normalized || normalized.toLowerCase() === 'unknown') {
    return null
  }

  return normalized
}

export function buildFooterVersionTooltip(versionInfo: FooterVersionInfo): string | undefined {
  const version = normalizeMetadataValue(versionInfo.version)
  if (!version) {
    return undefined
  }

  const lines = [`Axiom v${version}`]
  const gitCommit = normalizeMetadataValue(versionInfo.gitCommit)
  const buildDate = normalizeMetadataValue(versionInfo.buildDate)

  if (gitCommit) {
    lines.push(`Commit: ${gitCommit}`)
  }

  if (buildDate) {
    lines.push(`Built: ${buildDate}`)
  }

  return lines.join('\n')
}