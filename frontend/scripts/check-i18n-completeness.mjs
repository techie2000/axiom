import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const LOCALES_DIR = path.join(ROOT, 'public', 'locales')
const SOURCE_LOCALE = 'en'
const NAMESPACE = 'common'

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function flattenKeys(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : []
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key
    if (child !== null && typeof child === 'object' && !Array.isArray(child)) {
      return flattenKeys(child, next)
    }
    return [next]
  })
}

if (!fs.existsSync(LOCALES_DIR)) {
  console.error(`[i18n:check] Missing locales directory: ${LOCALES_DIR}`)
  process.exit(1)
}

const localeDirs = fs.readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

if (localeDirs.length === 0) {
  console.error('[i18n:check] No locale directories found under public/locales')
  process.exit(1)
}

const sourceFile = path.join(LOCALES_DIR, SOURCE_LOCALE, `${NAMESPACE}.json`)
if (!fs.existsSync(sourceFile)) {
  console.error(`[i18n:check] Missing source locale file: ${sourceFile}`)
  process.exit(1)
}

const sourceKeys = new Set(flattenKeys(readJson(sourceFile)))
const warnings = []

for (const locale of localeDirs) {
  if (locale === SOURCE_LOCALE) {
    continue
  }

  const localeFile = path.join(LOCALES_DIR, locale, `${NAMESPACE}.json`)
  if (!fs.existsSync(localeFile)) {
    warnings.push(`[${locale}] Missing file: public/locales/${locale}/${NAMESPACE}.json (English fallback will be used)`)
    continue
  }

  const localeKeys = new Set(flattenKeys(readJson(localeFile)))

  const missing = [...sourceKeys].filter((key) => !localeKeys.has(key))
  if (missing.length > 0) {
    warnings.push(
      `[${locale}] Missing ${missing.length} key(s): ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ', ...' : ''} (English fallback will be used)`,
    )
  }
}

if (warnings.length > 0) {
  console.warn('[i18n:check] Non-English locale gaps detected; continuing because English fallback is intentional:')
  for (const message of warnings) {
    console.warn(`- ${message}`)
  }
}

console.log(`[i18n:check] OK: ${SOURCE_LOCALE}/${NAMESPACE}.json is the source of truth; ${localeDirs.length - 1} non-English locale(s) checked for optional coverage.`)
