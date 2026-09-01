import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_FILE = fileURLToPath(import.meta.url)
const SCRIPT_DIR = path.dirname(SCRIPT_FILE)
const FRONTEND_ROOT = path.resolve(SCRIPT_DIR, '..')
const LOCALE_FILE = path.join(FRONTEND_ROOT, 'public', 'locales', 'en', 'common.json')

const SHOULD_SKIP_VALUE = (value) =>
  value.startsWith('$t(') || value.includes('{{') || value.trim().length === 0

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export function collectStringPathsByValue(root, prefix = '') {
  const byValue = new Map()

  function walk(node, currentPath) {
    if (!isPlainObject(node)) {
      return
    }

    for (const [key, value] of Object.entries(node)) {
      const nextPath = currentPath ? `${currentPath}.${key}` : key

      if (typeof value === 'string') {
        if (SHOULD_SKIP_VALUE(value)) {
          continue
        }

        if (!byValue.has(value)) {
          byValue.set(value, [])
        }
        byValue.get(value).push(nextPath)
        continue
      }

      walk(value, nextPath)
    }
  }

  walk(root, prefix)
  return byValue
}

function pickCanonicalPath(paths) {
  const commonPath = paths.find((candidate) => candidate.startsWith('common.'))
  return commonPath ?? paths[0]
}

export function buildAliasPlan(root) {
  const valueToPaths = collectStringPathsByValue(root)
  const byPath = new Map()

  for (const paths of valueToPaths.values()) {
    if (paths.length < 2) {
      continue
    }

    const canonicalPath = pickCanonicalPath(paths)

    for (const pathToAlias of paths) {
      if (pathToAlias === canonicalPath) {
        continue
      }
      byPath.set(pathToAlias, canonicalPath)
    }
  }

  return byPath
}

export function applyAliasPlan(root, aliasPlan) {
  let replacements = 0

  function walk(node, pathSegments = []) {
    if (!isPlainObject(node)) {
      return
    }

    for (const [key, value] of Object.entries(node)) {
      const nextPath = [...pathSegments, key]

      if (nextPath[0] === 'common') {
        if (isPlainObject(value)) {
          walk(value, nextPath)
        }
        continue
      }

      if (typeof value === 'string') {
        if (SHOULD_SKIP_VALUE(value)) {
          continue
        }

        const dottedPath = nextPath.join('.')
        const aliasPath = aliasPlan.get(dottedPath)
        if (!aliasPath) {
          continue
        }
        if (aliasPath === dottedPath) {
          continue
        }

        const aliasValue = `$t(${aliasPath})`
        if (node[key] !== aliasValue) {
          node[key] = aliasValue
          replacements += 1
        }
        continue
      }

      walk(value, nextPath)
    }
  }

  walk(root)
  return replacements
}

export function aliasDuplicateValues(root) {
  const aliasPlan = buildAliasPlan(root)
  return applyAliasPlan(root, aliasPlan)
}

function runCli() {
  if (!fs.existsSync(LOCALE_FILE)) {
    console.log(`[i18n:alias-common] File not found, skipping: ${LOCALE_FILE}`)
    process.exit(0)
  }

  const parsed = JSON.parse(fs.readFileSync(LOCALE_FILE, 'utf8'))
  if (!isPlainObject(parsed) || !isPlainObject(parsed.common)) {
    console.error('[i18n:alias-common] Invalid locale structure: expected root.common object')
    process.exit(1)
  }

  const replacements = aliasDuplicateValues(parsed)

  if (replacements === 0) {
    console.log('[i18n:alias-common] No duplicate opportunities found')
    process.exit(0)
  }

  fs.writeFileSync(LOCALE_FILE, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
  console.log(`[i18n:alias-common] Aliased ${replacements} duplicate value(s)`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) {
  runCli()
}