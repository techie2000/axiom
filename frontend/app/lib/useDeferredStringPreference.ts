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
  setValue: (next: string) => void
  save: () => void
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

  return {
    value,
    showPrompt,
    promptResetKey,
    setValue,
    save,
    dismiss,
  }
}
