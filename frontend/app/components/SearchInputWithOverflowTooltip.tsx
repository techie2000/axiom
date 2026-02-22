'use client'

import { InputHTMLAttributes, useEffect, useRef, useState } from 'react'

type SearchInputWithOverflowTooltipProps = InputHTMLAttributes<HTMLInputElement>

const parsePx = (value: string) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function SearchInputWithOverflowTooltip(props: SearchInputWithOverflowTooltipProps) {
  const { placeholder = '', value, title, type = 'text', ...restProps } = props
  const inputRef = useRef<HTMLInputElement>(null)
  const [placeholderTruncated, setPlaceholderTruncated] = useState(false)

  useEffect(() => {
    const input = inputRef.current
    if (!input || !placeholder) {
      setPlaceholderTruncated(false)
      return
    }

    const updateTruncationState = () => {
      const element = inputRef.current
      if (!element || !placeholder) {
        setPlaceholderTruncated(false)
        return
      }

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) {
        setPlaceholderTruncated(false)
        return
      }

      const styles = window.getComputedStyle(element)
      context.font = styles.font || `${styles.fontSize} ${styles.fontFamily}`

      const placeholderWidth = context.measureText(placeholder).width
      const horizontalChrome =
        parsePx(styles.paddingLeft) +
        parsePx(styles.paddingRight) +
        parsePx(styles.borderLeftWidth) +
        parsePx(styles.borderRightWidth)

      const availableWidth = Math.max(element.clientWidth - horizontalChrome - 2, 0)
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
  }, [placeholder, value])

  const hasValue = typeof value === 'string' ? value.length > 0 : false
  const resolvedTitle = title || (!hasValue && placeholderTruncated ? placeholder : undefined)

  return <input ref={inputRef} type={type} placeholder={placeholder} value={value} title={resolvedTitle} {...restProps} />
}
