'use client'

import { useEffect, useState } from 'react'

const PREFERENCE_SAVE_ERROR_EVENT = 'axiom:preference-save-error'

interface PreferenceSaveErrorDetail {
  pageKey?: string
  preferenceKey?: string
  reason?: string
  status?: number
}

export default function PreferenceSaveErrorToast() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const handleError = (event: Event) => {
      const customEvent = event as CustomEvent<PreferenceSaveErrorDetail>
      const page = customEvent.detail?.pageKey
      const key = customEvent.detail?.preferenceKey
      const status = customEvent.detail?.status

      if (status === 401 || status === 403) {
        setMessage('Your session has expired. Please sign in again to save preferences.')
        return
      }

      if (page && key) {
        setMessage(`Couldn't save preference (${page}/${key}). Please try again.`)
        return
      }

      setMessage("Couldn't save your preference. Please try again.")
    }

    window.addEventListener(PREFERENCE_SAVE_ERROR_EVENT, handleError as EventListener)
    return () => {
      window.removeEventListener(PREFERENCE_SAVE_ERROR_EVENT, handleError as EventListener)
    }
  }, [])

  useEffect(() => {
    if (!message) {
      return
    }

    const timer = setTimeout(() => setMessage(null), 8000)
    return () => clearTimeout(timer)
  }, [message])

  if (!message) {
    return null
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-5 left-5 z-50 flex items-center gap-3 rounded-lg border border-red-400/50 bg-red-900/95 px-4 py-3 text-sm text-red-100 shadow-xl backdrop-blur-sm"
    >
      <span>{message}</span>
      <button
        onClick={() => setMessage(null)}
        className="rounded bg-red-200/15 px-3 py-1 text-xs font-semibold text-red-100 hover:bg-red-200/25 focus:outline-none focus:ring-2 focus:ring-red-200/50"
      >
        Dismiss
      </button>
    </div>
  )
}
