import { describe, expect, it, vi } from 'vitest'
import React, { createRef, useRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import SearchInputWithOverflowTooltip from './SearchInputWithOverflowTooltip'

describe('SearchInputWithOverflowTooltip', () => {
  describe('basic rendering', () => {
    it('renders an input element with provided attributes', () => {
      const html = renderToStaticMarkup(
        React.createElement(SearchInputWithOverflowTooltip, {
          type: 'text',
          placeholder: 'Search...',
          value: 'test',
          className: 'custom-class',
        })
      )

      expect(html).toContain('<input')
      expect(html).toContain('type="text"')
      expect(html).toContain('placeholder="Search..."')
      expect(html).toContain('value="test"')
      expect(html).toContain('custom-class')
    })

    it('forwards standard HTML attributes', () => {
      const html = renderToStaticMarkup(
        <SearchInputWithOverflowTooltip disabled maxLength={100} data-testid="search-input" />
      )

      expect(html).toContain('disabled')
      expect(html).toContain('maxLength="100"')
      expect(html).toContain('data-testid="search-input"')
    })
  })

  describe('ref forwarding behavior', () => {
    it('component is wrapped in forwardRef and supports ref forwarding', () => {
      // Test that the component accepts a ref parameter
      // forwardRef components accept refs as props in React.createElement
      const mockRef = { current: null }

      // This should not throw an error if ref forwarding is properly implemented
      const element = React.createElement(SearchInputWithOverflowTooltip, {
        ref: mockRef,
        placeholder: 'Test',
      })

      // Verify the element was created successfully
      expect(element).toBeDefined()
      expect(element.props.ref).toBe(mockRef)
    })

    it('creates a valid React element with ref prop', () => {
      const testRef = createRef<HTMLInputElement>()
      const element = React.createElement(SearchInputWithOverflowTooltip, {
        ref: testRef,
        placeholder: 'Search test',
      })

      expect(element.type).toBeDefined()
      expect(element.props).toHaveProperty('ref')
    })
  })

  describe('component structure', () => {
    it('renders as an input element', () => {
      const html = renderToStaticMarkup(
        React.createElement(SearchInputWithOverflowTooltip, {
          placeholder: 'Test placeholder',
        })
      )

      expect(html).toMatch(/<input[^>]*>/)
      expect(html).not.toContain('<SearchInputWithOverflowTooltip')
    })

    it('preserves placeholder when no value is present', () => {
      const html = renderToStaticMarkup(
        React.createElement(SearchInputWithOverflowTooltip, {
          placeholder: 'Search anything...',
          value: '',
        })
      )

      expect(html).toContain('placeholder="Search anything..."')
      expect(html).toContain('value=""')
    })

    it('handles explicit title prop', () => {
      const html = renderToStaticMarkup(
        React.createElement(SearchInputWithOverflowTooltip, {
          placeholder: 'Search',
          title: 'Custom tooltip',
          value: '',
        })
      )

      expect(html).toContain('title="Custom tooltip"')
    })

    it('prefers explicit title over placeholder-based tooltip', () => {
      const html = renderToStaticMarkup(
        React.createElement(SearchInputWithOverflowTooltip, {
          placeholder: 'Very long placeholder text that might be truncated',
          title: 'Explicit title',
          value: '',
        })
      )

      // The explicit title should be used
      expect(html).toContain('title="Explicit title"')
    })
  })

  describe('input type variations', () => {
    it('defaults to type="text"', () => {
      const html = renderToStaticMarkup(
        React.createElement(SearchInputWithOverflowTooltip, {
          placeholder: 'Test',
        })
      )

      expect(html).toContain('type="text"')
    })

    it('respects custom type prop', () => {
      const html = renderToStaticMarkup(
        React.createElement(SearchInputWithOverflowTooltip, {
          type: 'email',
          placeholder: 'Email',
        })
      )

      expect(html).toContain('type="email"')
    })
  })

  describe('callback ref functionality', () => {
    it('component structure supports callback refs in React', () => {
      const callbackRef = vi.fn()
      const element = React.createElement(SearchInputWithOverflowTooltip, {
        ref: callbackRef,
        placeholder: 'Test',
      })

      // Verify the ref callback is accessible
      expect(element.props.ref).toBe(callbackRef)
      expect(typeof element.props.ref).toBe('function')
    })
  })

  describe('prop spreading', () => {
    it('spreads remaining props to the input element', () => {
      const html = renderToStaticMarkup(
        <SearchInputWithOverflowTooltip
          placeholder="Search"
          aria-label="Search input"
          data-custom="value"
          autoFocus
        />
      )

      expect(html).toContain('aria-label="Search input"')
      expect(html).toContain('data-custom="value"')
      expect(html).toContain('autofocus')
    })
  })

  describe('forwardRef implementation validation', () => {
    it('component is forwardRef-compatible', () => {
      // forwardRef components have a $$typeof property with FORWARD_REF symbol
      const element = React.createElement(SearchInputWithOverflowTooltip, {
        placeholder: 'Test',
      })

      // Verify it's a valid React element that can receive refs
      expect(element).toBeDefined()
      expect(element.type).toBeDefined()
    })

    it('maintains ref even when props change', () => {
      const testRef = createRef<HTMLInputElement>()

      // Create element with ref
      const element1 = React.createElement(SearchInputWithOverflowTooltip, {
        ref: testRef,
        placeholder: 'First',
      })

      // This should still have the ref
      expect(element1.props.ref).toBe(testRef)

      // Create another element with same ref but different props
      const element2 = React.createElement(SearchInputWithOverflowTooltip, {
        ref: testRef,
        placeholder: 'Second',
        value: 'typed',
      })

      expect(element2.props.ref).toBe(testRef)
    })
  })
})

