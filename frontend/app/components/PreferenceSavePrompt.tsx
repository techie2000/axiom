'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  /** When true the prompt is shown. */
  visible: boolean
  /**
   * Increment this counter each time an additional change is made while the
   * prompt is already visible. The 8-second auto-dismiss timer restarts
   * whenever resetKey changes, so users always have 8 s from their *last*
   * change rather than their first.
   */
  resetKey?: number
  /** Called when the user confirms saving; caller should persist and dismiss. */
  onSave: () => void
  /** Called when the user dismisses without saving. */
  onDismiss: () => void
  /** Optional label shown in the prompt. Defaults to a generic message. */
  label?: string
}

/**
 * PreferenceSavePrompt renders an unobtrusive bottom-right toast that appears
 * when a UI preference has been changed. It asks the user whether to save the
 * change as their default without interrupting their workflow.
 *
 * The prompt auto-dismisses after 8 seconds if the user does not interact.
 */
export default function PreferenceSavePrompt({ visible, resetKey, onSave, onDismiss, label }: Props) {
  const [show, setShow] = useState(false)
  // Use refs to always call the latest callbacks, avoiding stale closure issues.
  const onDismissRef = useRef(onDismiss)
  const onSaveRef = useRef(onSave)
  onDismissRef.current = onDismiss
  onSaveRef.current = onSave

  useEffect(() => {
    if (visible) {
      setShow(true)
      const timer = setTimeout(() => {
        setShow(false)
        onDismissRef.current()
      }, 8000)
      return () => clearTimeout(timer)
    } else {
      setShow(false)
    }
  }, [visible, resetKey])

  if (!show) return null

  const handleSave = () => {
    setShow(false)
    onSaveRef.current()
  }

  const handleDismiss = () => {
    setShow(false)
    onDismissRef.current()
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-lg border border-white/20 bg-gray-800/95 px-4 py-3 text-sm text-white shadow-xl backdrop-blur-sm transition-all"
    >
      <span className="text-gray-300">
        {label ?? 'Save this as your default?'}
      </span>
      <button
        onClick={handleSave}
        className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        Save
      </button>
      <button
        onClick={handleDismiss}
        className="rounded bg-white/10 px-3 py-1 text-xs font-semibold text-gray-300 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
      >
        No thanks
      </button>
    </div>
  )
}
