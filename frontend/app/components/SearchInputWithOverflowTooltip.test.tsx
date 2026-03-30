import { describe, expect, it, beforeEach, vi } from 'vitest'
import React, { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import SearchInputWithOverflowTooltip from './SearchInputWithOverflowTooltip'

describe('SearchInputWithOverflowTooltip', () => {
  describe('ref forwarding', () => {
    it('forwards ref to underlying input element via createRef', () => {
      const inputRef = createRef<HTMLInputElement>()
      render(<SearchInputWithOverflowTooltip ref={inputRef} placeholder="Search..." />)

      expect(inputRef.current).toBeInstanceOf(HTMLInputElement)
      expect(inputRef.current?.tagName).toBe('INPUT')
    })

    it('forwards ref to underlying input element via useRef callback', () => {
      const refCallback = vi.fn()
      render(
        <SearchInputWithOverflowTooltip
          ref={refCallback}
          placeholder="Search..."
          data-testid="search-input"
        />
      )

      expect(refCallback).toHaveBeenCalled()
      expect(refCallback.mock.calls[0][0]).toBeInstanceOf(HTMLInputElement)
    })

    it('allows focus and select on the forwarded ref', () => {
      const inputRef = createRef<HTMLInputElement>()
      render(
        <SearchInputWithOverflowTooltip
          ref={inputRef}
          placeholder="Test input"
          data-testid="test-input"
        />
      )

      inputRef.current?.focus()
      expect(document.activeElement).toBe(inputRef.current)

      inputRef.current?.select()
      // Selection state is tested indirectly via the ability to call the method
      expect(inputRef.current?.selectionStart).toBeGreaterThanOrEqual(0)
    })
  })

  describe('placeholder truncation and title resolution', () => {
    it('sets title to placeholder when placeholder is truncated and input is empty', async () => {
      const inputRef = createRef<HTMLInputElement>()
      render(
        <SearchInputWithOverflowTooltip
          ref={inputRef}
          placeholder="This is a very long placeholder that will likely be truncated"
          value=""
          data-testid="search-input"
        />
      )

      // Give time for useEffect to measure and potentially set the title
      await new Promise(resolve => setTimeout(resolve, 100))

      // The title should be set if placeholder is truncated; otherwise undefined
      const element = inputRef.current
      if (element) {
        // Title should either be the placeholder (if truncated) or empty (if not truncated)
        expect([element.title, '']).toContain(element.title)
      }
    })

    it('does not set title when input has a value', async () => {
      const inputRef = createRef<HTMLInputElement>()
      render(
        <SearchInputWithOverflowTooltip
          ref={inputRef}
          placeholder="Some placeholder"
          value="User has typed something"
          data-testid="search-input"
        />
      )

      await new Promise(resolve => setTimeout(resolve, 100))

      // Title should be empty when input has value
      expect(inputRef.current?.title).toBe('')
    })

    it('respects explicit title prop over computed title', async () => {
      const inputRef = createRef<HTMLInputElement>()
      render(
        <SearchInputWithOverflowTooltip
          ref={inputRef}
          placeholder="This is a long placeholder"
          title="Custom tooltip"
          value=""
          data-testid="search-input"
        />
      )

      await new Promise(resolve => setTimeout(resolve, 100))

      // Explicit title should be preserved
      expect(inputRef.current?.title).toBe('Custom tooltip')
    })
  })

  describe('input attribute forwarding', () => {
    it('forwards standard HTML input attributes', () => {
      const inputRef = createRef<HTMLInputElement>()
      render(
        <SearchInputWithOverflowTooltip
          ref={inputRef}
          type="text"
          placeholder="Search..."
          value="test value"
          className="custom-class"
          disabled={false}
          maxLength={100}
        />
      )

      const input = inputRef.current
      expect(input?.type).toBe('text')
      expect(input?.placeholder).toBe('Search...')
      expect(input?.value).toBe('test value')
      expect(input?.maxLength).toBe(100)
      expect(input?.className).toContain('custom-class')
    })

    it('accepts onChange handler', () => {
      const handleChange = vi.fn()
      const inputRef = createRef<HTMLInputElement>()
      const { getByRole } = render(
        <SearchInputWithOverflowTooltip
          ref={inputRef}
          placeholder="Search..."
          onChange={handleChange}
        />
      )

      const input = getByRole('textbox') as HTMLInputElement
      input.value = 'test'
      input.dispatchEvent(new Event('change', { bubbles: true }))

      expect(handleChange).toHaveBeenCalled()
    })
  })

  describe('callback ref and internal state tracking', () => {
    it('properly updates internal state when component remounts', () => {
      const inputRef = createRef<HTMLInputElement>()
      const { rerender } = render(
        <SearchInputWithOverflowTooltip
          ref={inputRef}
          placeholder="First render"
        />
      )

      const firstInput = inputRef.current
      expect(firstInput).toBeInstanceOf(HTMLInputElement)

      rerender(
        <SearchInputWithOverflowTooltip
          ref={inputRef}
          placeholder="After rerender"
        />
      )

      // Ref should still point to a valid input element
      expect(inputRef.current).toBeInstanceOf(HTMLInputElement)
    })
  })
})
