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
  setValue: (next: boolean) => void
  toggle: () => void
  save: () => void
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

  return {
    value,
    showPrompt,
    promptResetKey,
    setValue,
    toggle,
    save,
    dismiss,
  }
}
