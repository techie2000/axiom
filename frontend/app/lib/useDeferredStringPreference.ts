'use client'

import { useCallback, useRef, useState } from 'react'
import { useUserPreference } from './useUserPreference'

// Session-scoped unsaved overrides survive component remounts/navigation
// but are intentionally cleared on logout via resetDeferredPreferenceSession.
const deferredSessionOverrides: Record<string, string> = {}

function getDeferredSessionKey(pageKey: string, preferenceKey: string): string {
  return `${pageKey}::${preferenceKey}`
}

export function resetDeferredPreferenceSession() {
  Object.keys(deferredSessionOverrides).forEach((key) => {
    delete deferredSessionOverrides[key]
  })
}

interface DeferredStringPreferenceOptions {
  pageKey: string
  preferenceKey: string
  defaultValue: string
}

interface DeferredStringPreference {
  value: string
  showPrompt: boolean
  promptResetKey: number
  /** True while the user has an in-session change that hasn't been persisted yet. */
  hasUnsavedChanges: boolean
  setValue: (next: string) => void
  save: () => void
  /**
   * Immediately persists the current effective value as the user's stored default,
   * regardless of whether a toast prompt is visible.
   */
  saveCurrentValue: () => void
  dismiss: () => void

  // ── Undo ────────────────────────────────────────────────────────────────
  /** True for 15 seconds after a successful save, allowing the user to revert. */
  showUndo: boolean
  /** Increment counter that resets the undo toast timer on repeated saves. */
  undoResetKey: number
  /** Restores the previous persisted value and hides the undo toast. */
  undo: () => void
  /** Hides the undo toast without reverting the saved value. */
  undoDismiss: () => void
}

export function useDeferredStringPreference({
  pageKey,
  preferenceKey,
  defaultValue,
}: DeferredStringPreferenceOptions): DeferredStringPreference {
  const sessionKey = getDeferredSessionKey(pageKey, preferenceKey)
  const sessionOverride = deferredSessionOverrides[sessionKey] ?? null
  const [storedValue, setStoredValue] = useUserPreference(pageKey, preferenceKey, defaultValue)
  const [localValue, setLocalValue] = useState<string | null>(sessionOverride)
  const [showPrompt, setShowPrompt] = useState(false)
  const [promptResetKey, setPromptResetKey] = useState(0)
  const pendingValue = useRef<string | null>(null)

  // Track the value that was persisted just before the most recent save so
  // that the user can undo the change within the 15-second window.
  const previousValue = useRef<string | null>(null)
  const [showUndo, setShowUndo] = useState(false)
  const [undoResetKey, setUndoResetKey] = useState(0)

  const value = localValue ?? storedValue

  const setValue = useCallback((next: string) => {
    deferredSessionOverrides[sessionKey] = next
    setLocalValue(next)
    pendingValue.current = next
    setShowPrompt(true)
    setPromptResetKey((version) => version + 1)
  }, [sessionKey])

  const save = useCallback(() => {
    if (pendingValue.current !== null) {
      // Snapshot the current persisted value as the undo target.
      previousValue.current = storedValue
      setStoredValue(pendingValue.current)
      delete deferredSessionOverrides[sessionKey]
      setLocalValue(null)
      pendingValue.current = null
    }
    setShowPrompt(false)
    // Show undo toast after saving.
    setShowUndo(true)
    setUndoResetKey((k) => k + 1)
  }, [setStoredValue, sessionKey, storedValue])

  const dismiss = useCallback(() => {
    setShowPrompt(false)
  }, [])

  const hasUnsavedChanges = localValue !== null

  const saveCurrentValue = useCallback(() => {
    previousValue.current = storedValue
    setStoredValue(value)
    delete deferredSessionOverrides[sessionKey]
    setLocalValue(null)
    pendingValue.current = null
    setShowPrompt(false)
    setShowUndo(true)
    setUndoResetKey((k) => k + 1)
  }, [setStoredValue, sessionKey, storedValue, value])

  const undo = useCallback(() => {
    if (previousValue.current !== null) {
      setStoredValue(previousValue.current)
      setLocalValue(null)
      previousValue.current = null
    }
    setShowUndo(false)
  }, [setStoredValue])

  const undoDismiss = useCallback(() => {
    setShowUndo(false)
  }, [])

  return {
    value,
    showPrompt,
    promptResetKey,
    hasUnsavedChanges,
    setValue,
    save,
    saveCurrentValue,
    dismiss,
    showUndo,
    undoResetKey,
    undo,
    undoDismiss,
  }
}
