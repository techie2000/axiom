'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export interface ThemedSelectOption {
  value: string
  label: string
  title?: string
  disabled?: boolean
}

interface ThemedSelectProps {
  value: string
  onChange: (value: string) => void
  options: ThemedSelectOption[]
  ariaLabel: string
  title?: string
  className?: string
  buttonClassName?: string
  listClassName?: string
  disabled?: boolean
}

export default function ThemedSelect({
  value,
  onChange,
  options,
  ariaLabel,
  title,
  className = '',
  buttonClassName = '',
  listClassName = '',
  disabled = false,
}: ThemedSelectProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  )

  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : options[0]

  useEffect(() => {
    if (!open) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current) return
      if (event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const nextIndex = selectedIndex >= 0 ? selectedIndex : 0
    setActiveIndex(nextIndex)
    listRef.current?.focus()
  }, [open, selectedIndex])

  const commitAtIndex = (index: number) => {
    if (index < 0 || index >= options.length) return
    const candidate = options[index]
    if (!candidate || candidate.disabled) return
    onChange(candidate.value)
    setOpen(false)
  }

  const moveActive = (delta: number) => {
    if (options.length === 0) return

    let next = activeIndex >= 0 ? activeIndex : selectedIndex >= 0 ? selectedIndex : 0

    for (let attempts = 0; attempts < options.length; attempts += 1) {
      next = (next + delta + options.length) % options.length
      if (!options[next].disabled) {
        setActiveIndex(next)
        return
      }
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        className={`w-full px-4 py-2 border rounded-lg theme-select theme-focus text-left flex items-center justify-between gap-3 ${buttonClassName}`}
        aria-label={ariaLabel}
        title={title ?? selectedOption?.title ?? selectedOption?.label}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen((prev) => !prev)
        }}
        onKeyDown={(event) => {
          if (disabled) return

          if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (!open) {
              setOpen(true)
              return
            }
            moveActive(1)
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) {
              setOpen(true)
              return
            }
            moveActive(-1)
          }

          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (!open) {
              setOpen(true)
              return
            }
            commitAtIndex(activeIndex)
          }
        }}
      >
        <span className="truncate">{selectedOption?.label ?? ''}</span>
        <span className="theme-text-muted text-xs" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          className={`absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border theme-dropdown theme-scrollbar shadow-xl ${listClassName}`}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              moveActive(1)
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault()
              moveActive(-1)
            }

            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              commitAtIndex(activeIndex)
            }

            if (event.key === 'Escape') {
              event.preventDefault()
              setOpen(false)
            }
          }}
        >
          {options.map((option, index) => {
            const selected = option.value === value
            const active = index === activeIndex
            return (
              <li key={option.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  disabled={option.disabled}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                    selected ? 'theme-filterchip' : active ? 'theme-table-row-hover' : ''
                  } ${option.disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                  title={option.title ?? option.label}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => commitAtIndex(index)}
                >
                  {option.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
