'use client'

import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  /** When true the "Save as default?" prompt is shown. */
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

  // ── Undo phase ───────────────────────────────────────────────────────────
  /**
   * When true, the component switches to "undo available" mode: the save
   * prompt is hidden and an "Undo" toast is shown for up to 15 seconds.
   */
  showUndo?: boolean
  /**
   * Increment this key to restart the 15-second undo timer (useful if the
   * user triggers another save while the undo toast is visible).
   */
  undoResetKey?: number
  /**
   * Called when the user clicks "Undo". The caller should restore the
   * previous preference value and dismiss the undo toast.
   */
  onUndo?: () => void
  /** Called when the undo toast auto-dismisses or is manually dismissed. */
  onUndoDismiss?: () => void
  /** Optional label shown inside the undo toast. */
  undoLabel?: string
}

/**
 * PreferenceSavePrompt renders an unobtrusive bottom-right toast that appears
 * when a UI preference has been changed. It asks the user whether to save the
 * change as their default without interrupting their workflow.
 *
 * After the user saves, it optionally transitions to an "Undo" phase that
 * stays visible for 15 seconds and lets the user revert the saved value.
 *
 * The save prompt auto-dismisses after 8 seconds if the user does not interact.
 * The undo toast auto-dismisses after 15 seconds.
 */
export default function PreferenceSavePrompt({
  visible,
  resetKey,
  onSave,
  onDismiss,
  label,
  showUndo = false,
  undoResetKey,
  onUndo,
  onUndoDismiss,
  undoLabel,
}: Props) {
  const { t } = useTranslation('common')
  // Use refs to always call the latest callbacks, avoiding stale closure issues.
  const onDismissRef = useRef(onDismiss)
  const onSaveRef = useRef(onSave)
  const onUndoRef = useRef(onUndo)
  const onUndoDismissRef = useRef(onUndoDismiss)
  onDismissRef.current = onDismiss
  onSaveRef.current = onSave
  onUndoRef.current = onUndo
  onUndoDismissRef.current = onUndoDismiss

  // Auto-dismiss the save prompt after 8 seconds.
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onDismissRef.current()
      }, 8000)
      return () => clearTimeout(timer)
    }
  }, [visible, resetKey])

  // Auto-dismiss the undo toast after 15 seconds.
  useEffect(() => {
    if (showUndo) {
      const timer = setTimeout(() => {
        onUndoDismissRef.current?.()
      }, 15000)
      return () => clearTimeout(timer)
    }
  }, [showUndo, undoResetKey])

  const handleSave = () => {
    onSaveRef.current()
  }

  const handleDismiss = () => {
    onDismissRef.current()
  }

  const handleUndo = () => {
    onUndoRef.current?.()
  }

  const handleUndoDismiss = () => {
    onUndoDismissRef.current?.()
  }

  const savePromptLabel = label ?? t('preferences.saveAsDefaultPrompt')
  const undoPromptLabel = undoLabel ?? t('preferences.promptSaved')
  const saveButtonLabel = t('common.save')
  const undoButtonLabel = t('preferences.undo')
  const dismissButtonLabel = t('preferences.dismiss')
  const noThanksButtonLabel = t('preferences.noThanks')

  // Undo toast: shown after the user saves, giving them 15s to revert.
  if (showUndo && !visible) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-2.5rem)] items-center gap-3 rounded-lg border border-white/20 bg-gray-800/95 px-4 py-3 text-sm text-white shadow-xl backdrop-blur-sm transition-all"
      >
        <span className="text-gray-300">
          {undoPromptLabel}
        </span>
        {onUndo && (
          <button
            onClick={handleUndo}
            className="rounded bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {undoButtonLabel}
          </button>
        )}
        <button
          onClick={handleUndoDismiss}
          className="rounded bg-white/10 px-3 py-1 text-xs font-semibold text-gray-300 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
          aria-label={dismissButtonLabel}
        >
          ✕
        </button>
      </div>
    )
  }

  // Save prompt: shown when the user has an unsaved change.
  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-2.5rem)] items-center gap-3 rounded-lg border border-white/20 bg-gray-800/95 px-4 py-3 text-sm text-white shadow-xl backdrop-blur-sm transition-all"
    >
      <span className="text-gray-300">
        {savePromptLabel}
      </span>
      <button
        onClick={handleSave}
        className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        {saveButtonLabel}
      </button>
      <button
        onClick={handleDismiss}
        className="rounded bg-white/10 px-3 py-1 text-xs font-semibold text-gray-300 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
      >
        {noThanksButtonLabel}
      </button>
    </div>
  )
}
