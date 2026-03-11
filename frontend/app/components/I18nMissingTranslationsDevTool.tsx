'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import i18n from '../lib/i18n'

type MissingTranslationDraft = {
  key: string
  englishDefault: string
  value: string
  notes: string
  submitting: boolean
  error: string
}

const API_BASE_URL =
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18080'
    : 'http://backend:8080'

const normalizeLanguageCode = (languageCode: string): string =>
  String(languageCode || '').trim().toLowerCase().split('-')[0]

const isLikelyI18nKey = (value: string): boolean => {
  if (!value || value.includes(' ')) return false
  if (!value.includes('.')) return false
  if (value.includes('${')) return false
  return /^[a-zA-Z0-9_.-]+$/.test(value)
}

const extractPlaceholders = (value: string): string[] => {
  const matches = value.matchAll(/{{\s*([^}]+?)\s*}}/g)
  const names = new Set<string>()

  for (const match of matches) {
    const token = String(match[1] || '')
      .split(',')[0]
      .trim()
      .toLowerCase()
    if (token) {
      names.add(token)
    }
  }

  return Array.from(names).sort()
}

const removePlaceholdersForDisplay = (value: string): string => {
  return value
    .replace(/{{\s*[^}]+?\s*}}/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const containsEmoji = (value: string): boolean => /\p{Extended_Pictographic}/u.test(value)

const splitEmojiAffixes = (value: string): { prefix: string; core: string; suffix: string } => {
  const withoutPlaceholders = removePlaceholdersForDisplay(value)
  // Positional capture groups used instead of named groups for ES2017 compatibility.
  // [1] = leading emoji/whitespace, [2] = core text, [3] = trailing emoji/whitespace
  const match = withoutPlaceholders.match(
    /^([\p{Extended_Pictographic}\uFE0F\u200D\s]*)?(.*?)([\p{Extended_Pictographic}\uFE0F\u200D\s]*)?$/u
  )

  const prefix = match?.[1] ?? ''
  const core = (match?.[2] ?? withoutPlaceholders).trim()
  const suffix = match?.[3] ?? ''

  return { prefix, core, suffix }
}

const removeDecorationsForDisplay = (value: string): string => {
  const { core } = splitEmojiAffixes(value)
  return core || removePlaceholdersForDisplay(value)
}

const applyEmojiAffixesIfNeeded = (input: string, englishDefault: string): string => {
  if (!input || containsEmoji(input)) {
    return input
  }

  const { prefix, suffix } = splitEmojiAffixes(englishDefault)
  if (!prefix && !suffix) {
    return input
  }

  return `${prefix}${input}${suffix}`.trim()
}

const extractPlaceholderSuffix = (value: string): string => {
  const segments = value.match(/(?:\s*[([{]?\s*{{\s*[^}]+?\s*}}\s*[)\]}]?)/g) ?? []
  return segments.join('')
}

const sameStringArray = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false
  }
  return true
}

export default function I18nMissingTranslationsDevTool() {
  const [isOpen, setIsOpen] = useState(false)
  const [entries, setEntries] = useState<Record<string, MissingTranslationDraft>>({})
  const [isEnabled, setIsEnabled] = useState(false)
  const [activeLanguage, setActiveLanguage] = useState(() =>
    normalizeLanguageCode(i18n.resolvedLanguage || i18n.language || '')
  )
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const seenKeys = useRef<Set<string>>(new Set())
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    setIsEnabled(process.env.NODE_ENV !== 'production' && isLocalHost)
  }, [])

  // Reset entries when the user navigates to a different page so stale keys from
  // the previous route are not shown on the new page.  Also dispatch a translations-
  // updated event so the I18nProvider re-fetches any newly-approved translations from
  // the server, ensuring the new page renders with the latest approved values.
  useEffect(() => {
    if (!isEnabled) return
    seenKeys.current.clear()
    setEntries({})
    window.dispatchEvent(new CustomEvent('axiom:translations-updated'))
  }, [isEnabled, pathname])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  useEffect(() => {
    if (!isEnabled) return

    const onLanguageChanged = (languageCode: string) => {
      setActiveLanguage(normalizeLanguageCode(languageCode))
      seenKeys.current.clear()
      setEntries({})
    }

    i18n.on('languageChanged', onLanguageChanged)
    return () => {
      i18n.off('languageChanged', onLanguageChanged)
    }
  }, [isEnabled])

  useEffect(() => {
    if (!isEnabled) return

    const originalT = i18n.t.bind(i18n)
    const originalFn = i18n.t
    const pendingEntries: Record<string, MissingTranslationDraft> = {}
    let flushTimer: number | null = null

    const flushPendingEntries = () => {
      flushTimer = null
      const queuedEntries = Object.values(pendingEntries)
      if (queuedEntries.length === 0) return

      for (const entry of queuedEntries) {
        delete pendingEntries[entry.key]
      }

      setEntries((current) => {
        let next: Record<string, MissingTranslationDraft> | null = null

        for (const entry of queuedEntries) {
          const snapshot = next ?? current
          if (snapshot[entry.key]) continue

          if (!next) {
            next = { ...current }
          }
          next[entry.key] = entry
        }

        return next ?? current
      })
    }

    const queueEntry = (entry: MissingTranslationDraft) => {
      if (pendingEntries[entry.key]) return
      pendingEntries[entry.key] = entry

      if (flushTimer !== null) return
      flushTimer = window.setTimeout(flushPendingEntries, 0)
    }

    const collectMissingKeys = (keyInput: unknown) => {
      const keys = Array.isArray(keyInput) ? keyInput : [keyInput]
      const currentLanguage = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language || '')
      if (!currentLanguage || currentLanguage === 'en') {
        return
      }

      for (const rawKey of keys) {
        if (typeof rawKey !== 'string') continue
        const key = rawKey.trim()
        if (!isLikelyI18nKey(key)) continue
        if (seenKeys.current.has(key)) continue

        const existsInActiveLanguage = i18n.exists(key, {
          lng: currentLanguage,
          ns: 'common',
          fallbackLng: false,
        })
        if (existsInActiveLanguage) continue

        const englishDefault = originalT(key, {
          lng: 'en',
          ns: 'common',
          defaultValue: key,
        })
        if (!englishDefault || englishDefault === key) continue

        seenKeys.current.add(key)
        queueEntry({
          key,
          englishDefault,
          value: '',
          notes: '',
          submitting: false,
          error: '',
        })
      }
    }

    i18n.t = ((...args: Parameters<typeof i18n.t>) => {
      const result = originalT(...args)
      collectMissingKeys(args[0])
      return result
    }) as typeof i18n.t

    return () => {
      if (flushTimer !== null) {
        window.clearTimeout(flushTimer)
      }
      i18n.t = originalFn
    }
  }, [isEnabled])

  const sortedEntries = useMemo(
    () => Object.values(entries).sort((left, right) => left.key.localeCompare(right.key)),
    [entries]
  )

  const pendingCount = sortedEntries.length

  const setEntryField = (key: string, updates: Partial<MissingTranslationDraft>) => {
    setEntries((current) => {
      const existing = current[key]
      if (!existing) return current
      return {
        ...current,
        [key]: {
          ...existing,
          ...updates,
        },
      }
    })
  }

  const removeEntry = (key: string) => {
    setEntries((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
    seenKeys.current.delete(key)
  }

  const copyToClipboard = async (text: string, key: string) => {
    const value = text.trim()
    if (!value || typeof window === 'undefined') {
      return
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = value
        textarea.setAttribute('readonly', 'true')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }

      setCopiedKey(key)
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current))
      }, 1200)
    } catch {
      setEntryField(key, {
        error: 'Could not copy text to clipboard.',
      })
    }
  }

  useEffect(() => {
    if (!isEnabled) return

    const reconcileResolvedEntries = () => {
      const currentLanguage = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language || '')
      if (!currentLanguage || currentLanguage === 'en') return

      setEntries((current) => {
        let changed = false
        const next = { ...current }

        for (const key of Object.keys(current)) {
          const existsInActiveLanguage = i18n.exists(key, {
            lng: currentLanguage,
            ns: 'common',
            fallbackLng: false,
          })

          if (existsInActiveLanguage) {
            delete next[key]
            seenKeys.current.delete(key)
            changed = true
          }
        }

        return changed ? next : current
      })
    }

    // Reconcile periodically because approved overlay loading is async after page render.
    const intervalId = window.setInterval(reconcileResolvedEntries, 1500)
    i18n.on('loaded', reconcileResolvedEntries)
    i18n.on('languageChanged', reconcileResolvedEntries)
    window.addEventListener('axiom:translations-updated', reconcileResolvedEntries as EventListener)

    return () => {
      window.clearInterval(intervalId)
      i18n.off('loaded', reconcileResolvedEntries)
      i18n.off('languageChanged', reconcileResolvedEntries)
      window.removeEventListener('axiom:translations-updated', reconcileResolvedEntries as EventListener)
    }
  }, [isEnabled])

  const handleSubmit = async (entry: MissingTranslationDraft) => {
    const languageCode = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language || '')
    if (!languageCode || languageCode === 'en') {
      setEntryField(entry.key, {
        error: 'Switch to a non-English language before submitting translations.',
      })
      return
    }

    const tokenRaw = typeof window !== 'undefined' ? localStorage.getItem('axiom_token') : null
    const token = tokenRaw?.replace(/^Bearer\s+/i, '').trim() ?? ''
    if (!token) {
      setEntryField(entry.key, {
        error: 'Sign in first so this translation can be submitted.',
      })
      return
    }

    const trimmedValue = entry.value.trim()
    const trimmedNotes = entry.notes.trim()

    if (!trimmedValue) {
      setEntryField(entry.key, {
        error: 'Translation value is required.',
      })
      return
    }

    const expectedPlaceholders = extractPlaceholders(entry.englishDefault)
    const translatedPlaceholders = extractPlaceholders(trimmedValue)

    if (translatedPlaceholders.length > 0 && !sameStringArray(expectedPlaceholders, translatedPlaceholders)) {
      const expectedText = expectedPlaceholders.length ? expectedPlaceholders.map((token) => `{{${token}}}`).join(', ') : 'none'
      const foundText = translatedPlaceholders.length ? translatedPlaceholders.map((token) => `{{${token}}}`).join(', ') : 'none'
      setEntryField(entry.key, {
        error: `Keep placeholders unchanged. Expected: ${expectedText}. Found: ${foundText}.`,
      })
      return
    }

    const translationValue =
      expectedPlaceholders.length > 0 && translatedPlaceholders.length === 0
        ? `${applyEmojiAffixesIfNeeded(trimmedValue, entry.englishDefault)}${extractPlaceholderSuffix(entry.englishDefault) || ` ${expectedPlaceholders.map((token) => `{{${token}}}`).join(' ')}`}`.trim()
        : applyEmojiAffixesIfNeeded(trimmedValue, entry.englishDefault)

    setEntryField(entry.key, { submitting: true, error: '' })

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/translations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          translation_key: entry.key,
          language_code: languageCode,
          translation_value: translationValue,
          notes: trimmedNotes || 'submitted from in-page dev helper',
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: '' })) as { error?: string }
        throw new Error(payload.error || `Request failed (${response.status})`)
      }

      i18n.addResource(languageCode, 'common', entry.key, translationValue)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('axiom:translations-updated'))
      }

      setEntries((current) => {
        const next = { ...current }
        delete next[entry.key]
        return next
      })
    } catch (error) {
      setEntryField(entry.key, {
        submitting: false,
        error: error instanceof Error ? error.message : 'Failed to submit translation.',
      })
    }
  }

  if (!isEnabled) {
    return null
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="fixed bottom-4 right-4 z-[70] rounded-full border border-zinc-500 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-100 shadow-lg hover:bg-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
        title="Dev only: detect and submit missing translations from this page"
      >
        Missing Translations: {pendingCount}
      </button>

      {isOpen && (
        <div className="fixed bottom-16 right-4 z-[70] w-[32rem] max-h-[70vh] overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Missing translations (dev)</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Language: {activeLanguage || 'unknown'} · Found: {sortedEntries.length}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Close
            </button>
          </div>

          <div className="max-h-[58vh] overflow-y-auto p-3 space-y-3">
            {sortedEntries.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">No missing keys detected yet on this page.</p>
            ) : (
              sortedEntries.map((entry) => (
                <div key={entry.key} className="rounded border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <code className="break-all text-xs text-zinc-800 dark:text-zinc-100">{entry.key}</code>
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.key)}
                      className="rounded border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-600 hover:bg-white dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      Hide
                    </button>
                  </div>

                  <div className="group mb-2">
                    <p className="inline-flex items-center text-xs text-zinc-600 dark:text-zinc-300">
                      <span>English: {removeDecorationsForDisplay(entry.englishDefault)}</span>
                    <button
                      type="button"
                      onClick={() => void copyToClipboard(removeDecorationsForDisplay(entry.englishDefault), entry.key)}
                      className="ml-1 rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-700 focus:opacity-100 group-hover:opacity-100 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      title={copiedKey === entry.key ? 'Copied' : 'Copy English text'}
                      aria-label={copiedKey === entry.key ? 'Copied' : 'Copy English text'}
                    >
                      {copiedKey === entry.key ? (
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>
                    </p>
                  </div>

                  <textarea
                    rows={2}
                    value={entry.value}
                    onChange={(event) => setEntryField(entry.key, { value: event.target.value, error: '' })}
                    placeholder="Type translation"
                    className="mb-2 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                  />

                  <input
                    type="text"
                    value={entry.notes}
                    onChange={(event) => setEntryField(entry.key, { notes: event.target.value })}
                    placeholder="Optional notes"
                    className="mb-2 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                  />

                  {entry.error && <p className="mb-2 text-xs text-red-600">{entry.error}</p>}
                  <button
                    type="button"
                    disabled={entry.submitting}
                    onClick={() => void handleSubmit(entry)}
                    className="rounded bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                  >
                    {entry.submitting ? 'Submitting...' : 'Submit translation'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}
