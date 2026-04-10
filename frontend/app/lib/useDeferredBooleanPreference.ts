'use client'

import { useCallback, useRef, useState } from 'react'
import { useUserPreference } from './useUserPreference'

// Session-scoped unsaved overrides survive component remounts/navigation
// but are intentionally cleared on logout via resetDeferredBooleanPreferenceSession.
const deferredBooleanSessionOverrides: Record<string, boolean> = {}

function getDeferredBooleanSessionKey(pageKey: string, preferenceKey: string): string {
  return `${pageKey}::${preferenceKey}`
}

export function resetDeferredBooleanPreferenceSession() {
  Object.keys(deferredBooleanSessionOverrides).forEach((key) => {
    delete deferredBooleanSessionOverrides[key]
  })
}

interface DeferredBooleanPreferenceOptions {
  pageKey: string
  preferenceKey: string
  defaultValue?: boolean
}

interface DeferredBooleanPreference {
  value: boolean
  showPrompt: boolean
  promptResetKey: number
  /** True while the user has an in-session change that hasn't been persisted yet. */
  hasUnsavedChanges: boolean
  setValue: (next: boolean) => void
  toggle: () => void
  save: () => void
  /**
   * Immediately persists the current effective value as the user's stored default,
   * regardless of whether a toast prompt is visible. Use this for explicit "Save as
   * my default" actions so users can save at any time without re-triggering a change.
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

export function useDeferredBooleanPreference({
  pageKey,
  preferenceKey,
  defaultValue = false,
}: DeferredBooleanPreferenceOptions): DeferredBooleanPreference {
  const sessionKey = getDeferredBooleanSessionKey(pageKey, preferenceKey)
  const sessionOverride = deferredBooleanSessionOverrides[sessionKey]
  const [storedValue, setStoredValue] = useUserPreference(pageKey, preferenceKey, String(defaultValue))
  const [localValue, setLocalValue] = useState<boolean | null>(
    typeof sessionOverride === 'boolean' ? sessionOverride : null,
  )
  const [showPrompt, setShowPrompt] = useState(false)
  const [promptResetKey, setPromptResetKey] = useState(0)
  const pendingValue = useRef<boolean | null>(null)

  // Track the value that was persisted just before the most recent save so
  // that the user can undo the change within the 15-second window.
  const previousValue = useRef<boolean | null>(null)
  const [showUndo, setShowUndo] = useState(false)
  const [undoResetKey, setUndoResetKey] = useState(0)

  const value = localValue ?? (storedValue === 'true')

  const setValue = useCallback((next: boolean) => {
    deferredBooleanSessionOverrides[sessionKey] = next
    setLocalValue(next)
    pendingValue.current = next
    setShowPrompt(true)
    setPromptResetKey((version) => version + 1)
  }, [sessionKey])

  const toggle = useCallback(() => {
    setValue(!value)
  }, [setValue, value])

  const save = useCallback(() => {
    if (pendingValue.current !== null) {
      // Snapshot the current persisted value as the undo target.
      previousValue.current = storedValue === 'true'
      setStoredValue(String(pendingValue.current))
      delete deferredBooleanSessionOverrides[sessionKey]
      setLocalValue(null)
      pendingValue.current = null
    }
    setShowPrompt(false)
    // Show undo toast after saving.
    setShowUndo(true)
    setUndoResetKey((k) => k + 1)
  }, [sessionKey, setStoredValue, storedValue])

  const dismiss = useCallback(() => {
    setShowPrompt(false)
  }, [])

  const hasUnsavedChanges = localValue !== null

  const saveCurrentValue = useCallback(() => {
    previousValue.current = storedValue === 'true'
    setStoredValue(String(value))
    delete deferredBooleanSessionOverrides[sessionKey]
    setLocalValue(null)
    pendingValue.current = null
    setShowPrompt(false)
    setShowUndo(true)
    setUndoResetKey((k) => k + 1)
  }, [sessionKey, setStoredValue, storedValue, value])

  const undo = useCallback(() => {
    if (previousValue.current !== null) {
      setStoredValue(String(previousValue.current))
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
    toggle,
    save,
    saveCurrentValue,
    dismiss,
    showUndo,
    undoResetKey,
    undo,
    undoDismiss,
  }
}
