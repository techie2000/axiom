import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const APP_DIR = path.join(ROOT, 'app')
const LOCALES_DIR = path.join(ROOT, 'public', 'locales')
const SOURCE_LOCALE = 'en'
const NAMESPACE = 'common'
const EXTENSIONS = new Set(['.ts', '.tsx'])
const BLOCKED_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor'])

function getAllFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath))
      continue
    }

    if (EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath)
    }
  }

  return files
}

function extractKeysFromText(text) {
  const keys = new Set()

  // Captures common static forms: t('key'), t("key"), t(`key`)
  const directCall = /\bt\(\s*(['"`])((?:\\\1|(?!\1).)+)\1\s*[,)\]]/g
  let match
  while ((match = directCall.exec(text)) !== null) {
    keys.add(match[2])
  }

  // Captures explicit namespace usage: i18n.t('key')
  const namespacedCall = /\bi18n\.t\(\s*(['"`])((?:\\\1|(?!\1).)+)\1\s*[,)\]]/g
  while ((match = namespacedCall.exec(text)) !== null) {
    keys.add(match[2])
  }

  return keys
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function hasBlockedPathSegment(parts) {
  return parts.some((part) => BLOCKED_PATH_SEGMENTS.has(part))
}

function isSafeObject(obj) {
  if (obj === null || typeof obj !== 'object') return false
  if (Array.isArray(obj)) return false
  const proto = Object.getPrototypeOf(obj)
  return proto === Object.prototype || proto === null
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function getOwnValue(obj, key) {
  return hasOwn(obj, key) ? obj[key] : undefined
}

function setNestedValue(target, dottedKey, defaultValue) {
  const parts = dottedKey.split('.')
  if (hasBlockedPathSegment(parts)) {
    return false
  }

  if (!isSafeObject(target)) {
    return false
  }

  let cursor = target

  for (let i = 0; i < parts.length - 1; i += 1) {
    if (!isSafeObject(cursor)) {
      return false
    }
    const part = parts[i]
    const nextValue = getOwnValue(cursor, part)
    if (nextValue === undefined || nextValue === null || typeof nextValue !== 'object' || Array.isArray(nextValue)) {
      cursor[part] = Object.create(null)
    }

    const ownedChild = getOwnValue(cursor, part)
    if (!isSafeObject(ownedChild)) {
      return false
    }

    cursor = ownedChild
  }

  const leaf = parts[parts.length - 1]
  if (BLOCKED_PATH_SEGMENTS.has(leaf)) {
    return false
  }

  if (!hasOwn(cursor, leaf) || cursor[leaf] === undefined) {
    cursor[leaf] = defaultValue
    return true
  }

  return false
}

function getNestedValue(target, dottedKey) {
  const parts = dottedKey.split('.')
  if (hasBlockedPathSegment(parts)) {
    return undefined
  }

  return parts.reduce((current, part) => {
    if (current === undefined || current === null || typeof current !== 'object') {
      return undefined
    }

    if (!isSafeObject(current) || !hasOwn(current, part)) {
      return undefined
    }

    return current[part]
  }, target)
}

if (!fs.existsSync(APP_DIR)) {
  console.error(`[i18n:extract] Missing app directory: ${APP_DIR}`)
  process.exit(1)
}

if (!fs.existsSync(LOCALES_DIR)) {
  console.error(`[i18n:extract] Missing locales directory: ${LOCALES_DIR}`)
  process.exit(1)
}

const files = getAllFiles(APP_DIR)
const extractedKeys = new Set()
let blockedKeyCount = 0

for (const filePath of files) {
  const content = fs.readFileSync(filePath, 'utf8')
  for (const key of extractKeysFromText(content)) {
    extractedKeys.add(key)
  }
}

const keys = [...extractedKeys].sort()
const safeKeys = keys.filter((key) => {
  const blocked = hasBlockedPathSegment(key.split('.'))
  if (blocked) {
    blockedKeyCount += 1
  }
  return !blocked
})

if (keys.length === 0) {
  console.log('[i18n:extract] No static translation keys discovered in app/**/*.ts(x).')
  process.exit(0)
}

const localeDirs = fs.readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

const sourceFile = path.join(LOCALES_DIR, SOURCE_LOCALE, `${NAMESPACE}.json`)
if (!fs.existsSync(sourceFile)) {
  console.error(`[i18n:extract] Missing source locale file: ${sourceFile}`)
  process.exit(1)
}

const sourceJson = readJson(sourceFile)
let sourceAdded = 0
for (const key of safeKeys) {
  sourceAdded += setNestedValue(sourceJson, key, key) ? 1 : 0
}
if (sourceAdded > 0) {
  writeJson(sourceFile, sourceJson)
}

if (blockedKeyCount > 0) {
  console.warn(`[i18n:extract] Skipped ${blockedKeyCount} key(s) containing blocked path segments: ${[...BLOCKED_PATH_SEGMENTS].join(', ')}.`)
}

console.log(`[i18n:extract] Processed ${safeKeys.length} safe key(s) (${keys.length} total discovered); added ${sourceAdded} missing key(s) to ${SOURCE_LOCALE}/${NAMESPACE}.json only.`)
