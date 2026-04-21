'use client'

import { RefObject, useEffect } from 'react'

/**
 * Registers a global Ctrl+F / Cmd+F keyboard shortcut that focuses the given
 * search input and selects its current text. The browser's built-in find
 * dialog is suppressed whenever this shortcut is used so the custom search
 * field is focused and selected reliably instead.
 *
 * @param inputRef - A React ref pointing to the search `<input>` element.
 */
export function useSearchFocusShortcut(inputRef: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [inputRef])
}
