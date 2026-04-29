import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const LOCALE_FILE = path.join(ROOT, 'frontend', 'public', 'locales', 'en', 'common.json')

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function collectCommonStringValues(commonNode, prefix = 'common') {
  const byValue = new Map()

  function walk(node, currentPath) {
    if (!isPlainObject(node)) {
      return
    }

    for (const [key, value] of Object.entries(node)) {
      const nextPath = `${currentPath}.${key}`

      if (typeof value === 'string') {
        if (value.startsWith('$t(') || value.includes('{{') || value.trim().length === 0) {
          continue
        }

        // Keep first key as canonical alias target.
        if (!byValue.has(value)) {
          byValue.set(value, nextPath)
        }
        continue
      }

      walk(value, nextPath)
    }
  }

  walk(commonNode, prefix)
  return byValue
}

function aliasDuplicatesUsingCommon(root, valueToCommonPath) {
  let replacements = 0

  function walk(node, pathSegments = []) {
    if (!isPlainObject(node)) {
      return
    }

    for (const [key, value] of Object.entries(node)) {
      const nextPath = [...pathSegments, key]

      // Never rewrite values inside common.*
      if (nextPath[0] === 'common') {
        if (isPlainObject(value)) {
          walk(value, nextPath)
        }
        continue
      }

      if (typeof value === 'string') {
        if (value.startsWith('$t(') || value.includes('{{')) {
          continue
        }

        const aliasPath = valueToCommonPath.get(value)
        if (!aliasPath) {
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

if (!fs.existsSync(LOCALE_FILE)) {
  console.log(`[i18n:alias-common] File not found, skipping: ${LOCALE_FILE}`)
  process.exit(0)
}

const parsed = JSON.parse(fs.readFileSync(LOCALE_FILE, 'utf8'))
if (!isPlainObject(parsed) || !isPlainObject(parsed.common)) {
  console.error('[i18n:alias-common] Invalid locale structure: expected root.common object')
  process.exit(1)
}

const valueToCommonPath = collectCommonStringValues(parsed.common)
const replacements = aliasDuplicatesUsingCommon(parsed, valueToCommonPath)

if (replacements === 0) {
  console.log('[i18n:alias-common] No duplicate opportunities found')
  process.exit(0)
}

fs.writeFileSync(LOCALE_FILE, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
console.log(`[i18n:alias-common] Aliased ${replacements} duplicate value(s) to common.*`)