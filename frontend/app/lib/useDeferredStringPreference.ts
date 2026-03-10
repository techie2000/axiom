'use client'

import { useCallback, useRef, useState } from 'react'
import { useUserPreference } from './useUserPreference'

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
}

export function useDeferredStringPreference({
  pageKey,
  preferenceKey,
  defaultValue,
}: DeferredStringPreferenceOptions): DeferredStringPreference {
  const [storedValue, setStoredValue] = useUserPreference(pageKey, preferenceKey, defaultValue)
  const [localValue, setLocalValue] = useState<string | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [promptResetKey, setPromptResetKey] = useState(0)
  const pendingValue = useRef<string | null>(null)

  const value = localValue ?? storedValue

  const setValue = useCallback((next: string) => {
    setLocalValue(next)
    pendingValue.current = next
    setShowPrompt(true)
    setPromptResetKey((version) => version + 1)
  }, [])

  const save = useCallback(() => {
    if (pendingValue.current !== null) {
      setStoredValue(pendingValue.current)
      setLocalValue(null)
      pendingValue.current = null
    }
    setShowPrompt(false)
  }, [setStoredValue])

  const dismiss = useCallback(() => {
    setShowPrompt(false)
  }, [])

  const hasUnsavedChanges = localValue !== null

  const saveCurrentValue = useCallback(() => {
    setStoredValue(value)
    setLocalValue(null)
    pendingValue.current = null
    setShowPrompt(false)
  }, [setStoredValue, value])

  return {
    value,
    showPrompt,
    promptResetKey,
    hasUnsavedChanges,
    setValue,
    save,
    saveCurrentValue,
    dismiss,
  }
}
