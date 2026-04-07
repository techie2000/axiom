'use client'

import { forwardRef, InputHTMLAttributes, useCallback, useEffect, useState } from 'react'

type SearchInputWithOverflowTooltipProps = InputHTMLAttributes<HTMLInputElement>

const parsePx = (value: string) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const SearchInputWithOverflowTooltip = forwardRef<HTMLInputElement, SearchInputWithOverflowTooltipProps>(
  function SearchInputWithOverflowTooltip(props, forwardedRef) {
    const { placeholder = '', value, title, type = 'text', ...restProps } = props
    // Track the DOM node via state so effects re-run when the node mounts/unmounts.
    const [inputEl, setInputEl] = useState<HTMLInputElement | null>(null)
    const [placeholderTruncated, setPlaceholderTruncated] = useState(false)

    // Callback ref that wires up both the internal state and the forwarded ref.
    const callbackRef = useCallback(
      (node: HTMLInputElement | null) => {
        setInputEl(node)
        if (typeof forwardedRef === 'function') {
          forwardedRef(node)
        } else if (forwardedRef !== null) {
          forwardedRef.current = node
        }
      },
      [forwardedRef],
    )

    useEffect(() => {
      const input = inputEl
      if (!input || !placeholder) {
        setPlaceholderTruncated(false)
        return
      }

      const updateTruncationState = () => {
        if (!input || !placeholder) {
          setPlaceholderTruncated(false)
          return
        }

        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) {
          setPlaceholderTruncated(false)
          return
        }

        const styles = window.getComputedStyle(input)
        context.font = styles.font || `${styles.fontSize} ${styles.fontFamily}`

        const placeholderWidth = context.measureText(placeholder).width
        const horizontalChrome =
          parsePx(styles.paddingLeft) +
          parsePx(styles.paddingRight) +
          parsePx(styles.borderLeftWidth) +
          parsePx(styles.borderRightWidth)

        const availableWidth = Math.max(input.clientWidth - horizontalChrome - 2, 0)
        setPlaceholderTruncated(placeholderWidth > availableWidth)
      }

      updateTruncationState()

      const resizeObserver = new ResizeObserver(updateTruncationState)
      resizeObserver.observe(input)
      window.addEventListener('resize', updateTruncationState)

      return () => {
        resizeObserver.disconnect()
        window.removeEventListener('resize', updateTruncationState)
      }
    }, [inputEl, placeholder, value])

    const hasValue = typeof value === 'string' ? value.length > 0 : false
    const resolvedTitle = title || (!hasValue && placeholderTruncated ? placeholder : undefined)

    return <input ref={callbackRef} type={type} placeholder={placeholder} value={value} title={resolvedTitle} {...restProps} />
  }
)

export default SearchInputWithOverflowTooltip
