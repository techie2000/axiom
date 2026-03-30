// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRef } from 'react'
import { useSearchFocusShortcut } from './useSearchFocusShortcut'

describe('useSearchFocusShortcut', () => {
  let addSpy: ReturnType<typeof vi.spyOn>
  let removeSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    addSpy = vi.spyOn(document, 'addEventListener')
    removeSpy = vi.spyOn(document, 'removeEventListener')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers a keydown listener on mount', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLInputElement>(null)
      useSearchFocusShortcut(ref)
      return ref
    })

    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(result.current).toBeDefined()
  })

  it('removes the keydown listener on unmount', () => {
    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLInputElement>(null)
      useSearchFocusShortcut(ref)
      return ref
    })

    unmount()

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
  })

  it('focuses and selects the input when Ctrl+F is pressed', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)

    const focusSpy = vi.spyOn(input, 'focus')
    const selectSpy = vi.spyOn(input, 'select')

    renderHook(() => {
      const ref = useRef<HTMLInputElement>(input as HTMLInputElement)
      useSearchFocusShortcut(ref)
    })

    const event = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true })
    document.dispatchEvent(event)

    expect(focusSpy).toHaveBeenCalled()
    expect(selectSpy).toHaveBeenCalled()

    document.body.removeChild(input)
  })

  it('focuses the input when Cmd+F is pressed', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)

    const focusSpy = vi.spyOn(input, 'focus')

    renderHook(() => {
      const ref = useRef<HTMLInputElement>(input as HTMLInputElement)
      useSearchFocusShortcut(ref)
    })

    const event = new KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true })
    document.dispatchEvent(event)

    expect(focusSpy).toHaveBeenCalled()

    document.body.removeChild(input)
  })

  it('does not focus the input for unrelated key presses', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)

    const focusSpy = vi.spyOn(input, 'focus')

    renderHook(() => {
      const ref = useRef<HTMLInputElement>(input as HTMLInputElement)
      useSearchFocusShortcut(ref)
    })

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', ctrlKey: true, bubbles: true }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }))

    expect(focusSpy).not.toHaveBeenCalled()

    document.body.removeChild(input)
  })
})
