'use client'

import { useCallback, useRef, useState } from 'react'
import { useUserPreference } from './useUserPreference'

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
}

export function useDeferredBooleanPreference({
  pageKey,
  preferenceKey,
  defaultValue = false,
}: DeferredBooleanPreferenceOptions): DeferredBooleanPreference {
  const [storedValue, setStoredValue] = useUserPreference(pageKey, preferenceKey, String(defaultValue))
  const [localValue, setLocalValue] = useState<boolean | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [promptResetKey, setPromptResetKey] = useState(0)
  const pendingValue = useRef<boolean | null>(null)

  const value = localValue ?? (storedValue === 'true')

  const setValue = useCallback((next: boolean) => {
    setLocalValue(next)
    pendingValue.current = next
    setShowPrompt(true)
    setPromptResetKey((version) => version + 1)
  }, [])

  const toggle = useCallback(() => {
    setValue(!value)
  }, [setValue, value])

  const save = useCallback(() => {
    if (pendingValue.current !== null) {
      setStoredValue(String(pendingValue.current))
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
    setStoredValue(String(value))
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
    toggle,
    save,
    saveCurrentValue,
    dismiss,
  }
}
