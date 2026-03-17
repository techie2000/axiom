'use client'

import { CSSProperties, ReactNode, useEffect, useRef, useState } from 'react'

interface SyncedWideTableProps {
  stickyTopOffset: number
  headerRow: ReactNode
  bodyRows: ReactNode
  dependencyKey?: string | number
  headerHeight?: number
  tableClassName?: string
  stickyHeaderClassName?: string
  mainHeaderClassName?: string
  bodyClassName?: string
  containerClassName?: string
  containerStyle?: CSSProperties
  tableStyle?: CSSProperties
  topScrollbarClassName?: string
  stickyContainerClassName?: string
  onMainHeaderWidthsChange?: (widths: number[]) => void
}

export default function SyncedWideTable({
  stickyTopOffset,
  headerRow,
  bodyRows,
  dependencyKey,
  headerHeight = 44,
  tableClassName = 'table-fixed w-max min-w-full divide-y divide-gray-200 dark:divide-white/10',
  stickyHeaderClassName = 'bg-gray-50 dark:bg-gray-800',
  mainHeaderClassName = 'bg-gray-50 dark:bg-white/5',
  bodyClassName = 'bg-white dark:bg-white/5 divide-y divide-gray-200 dark:divide-white/10',
  containerClassName = 'overflow-x-auto',
  containerStyle,
  tableStyle,
  topScrollbarClassName = 'mb-1 overflow-x-auto bg-white border-b border-gray-200 dark:bg-white/5 dark:border-white/10 rounded-t-lg',
  stickyContainerClassName = 'fixed z-30 overflow-x-auto bg-white border-b-2 border-gray-200 dark:bg-gray-800 dark:border-white/10 shadow-lg transition-all duration-200',
  onMainHeaderWidthsChange,
}: SyncedWideTableProps) {
  const STICKY_ACTIVATION_BUFFER = 16
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const stickyTableRef = useRef<HTMLTableElement>(null)
  const stickyHeaderScrollRef = useRef<HTMLDivElement>(null)
  const topScrollbarRef = useRef<HTMLDivElement>(null)
  const isSyncingHorizontalScrollRef = useRef(false)
  const onMainHeaderWidthsChangeRef = useRef(onMainHeaderWidthsChange)

  const [showStickyHeader, setShowStickyHeader] = useState(false)
  const [stickyHeaderStyle, setStickyHeaderStyle] = useState<{ left: number, width: number }>({ left: 0, width: 0 })
  const [tableScrollWidth, setTableScrollWidth] = useState(0)
  const [tableClientWidth, setTableClientWidth] = useState(0)

  const syncHorizontalScroll = (source: 'table' | 'top' | 'sticky', scrollLeft: number) => {
    if (isSyncingHorizontalScrollRef.current) {
      return
    }

    isSyncingHorizontalScrollRef.current = true

    if (source !== 'table' && tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = scrollLeft
    }

    if (source !== 'top' && topScrollbarRef.current) {
      topScrollbarRef.current.scrollLeft = scrollLeft
    }

    if (source !== 'sticky' && stickyHeaderScrollRef.current) {
      stickyHeaderScrollRef.current.scrollLeft = scrollLeft
    }

    requestAnimationFrame(() => {
      isSyncingHorizontalScrollRef.current = false
    })
  }

  const handleTableHorizontalScroll = () => {
    if (!tableContainerRef.current) return
    syncHorizontalScroll('table', tableContainerRef.current.scrollLeft)
  }

  const handleTopScrollbarScroll = () => {
    if (!topScrollbarRef.current) return
    syncHorizontalScroll('top', topScrollbarRef.current.scrollLeft)
  }

  const handleStickyHeaderHorizontalScroll = () => {
    if (!stickyHeaderScrollRef.current) return
    syncHorizontalScroll('sticky', stickyHeaderScrollRef.current.scrollLeft)
  }

  useEffect(() => {
    onMainHeaderWidthsChangeRef.current = onMainHeaderWidthsChange
  }, [onMainHeaderWidthsChange])

  useEffect(() => {
    const updateDimensions = () => {
      if (!tableContainerRef.current || !tableRef.current) return

      const containerRect = tableContainerRef.current.getBoundingClientRect()
      const mainHeaderElement = tableRef.current.querySelector('thead')
      const headerRect = mainHeaderElement?.getBoundingClientRect()

      setStickyHeaderStyle({
        left: containerRect.left,
        width: containerRect.width,
      })

      setShowStickyHeader(
        Boolean(headerRect) &&
        headerRect!.top <= stickyTopOffset + STICKY_ACTIVATION_BUFFER &&
        containerRect.bottom > stickyTopOffset + headerHeight
      )

      setTableClientWidth(tableContainerRef.current.clientWidth)
      setTableScrollWidth(Math.max(tableContainerRef.current.scrollWidth, tableRef.current.scrollWidth))

      const headerCells = Array.from(tableRef.current.querySelectorAll<HTMLTableCellElement>('thead th'))
      const widths = headerCells.map((cell) => Math.round(cell.getBoundingClientRect().width))

      const stickyHeaderCells = stickyTableRef.current
        ? Array.from(stickyTableRef.current.querySelectorAll<HTMLTableCellElement>('thead th'))
        : []

      if (stickyHeaderCells.length === widths.length) {
        stickyHeaderCells.forEach((cell, index) => {
          const width = widths[index]
          cell.style.width = `${width}px`
          cell.style.minWidth = `${width}px`
          cell.style.maxWidth = `${width}px`
        })
      }

      onMainHeaderWidthsChangeRef.current?.(widths)

      syncHorizontalScroll('table', tableContainerRef.current.scrollLeft)
    }

    updateDimensions()

    window.addEventListener('scroll', updateDimensions)
    document.addEventListener('scroll', updateDimensions, true)
    window.addEventListener('resize', updateDimensions)
    return () => {
      window.removeEventListener('scroll', updateDimensions)
      document.removeEventListener('scroll', updateDimensions, true)
      window.removeEventListener('resize', updateDimensions)
    }
  }, [stickyTopOffset, headerHeight, dependencyKey, onMainHeaderWidthsChange])

  return (
    <>
      {tableScrollWidth > tableClientWidth + 1 && (
        <div
          ref={topScrollbarRef}
          onScroll={handleTopScrollbarScroll}
          className={topScrollbarClassName}
        >
          <div style={{ width: `${tableScrollWidth}px`, height: '1px' }} />
        </div>
      )}

      <div
        ref={stickyHeaderScrollRef}
        onScroll={handleStickyHeaderHorizontalScroll}
        className={`${stickyContainerClassName} ${
          showStickyHeader ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
        style={{
          top: `${stickyTopOffset}px`,
          left: `${stickyHeaderStyle.left}px`,
          width: `${stickyHeaderStyle.width}px`,
        }}
      >
        <div style={{ width: `${tableScrollWidth}px` }}>
          <table ref={stickyTableRef} className={tableClassName} style={tableStyle}>
            <thead className={stickyHeaderClassName}>{headerRow}</thead>
          </table>
        </div>
      </div>

      <div ref={tableContainerRef} onScroll={handleTableHorizontalScroll} className={containerClassName} style={containerStyle}>
        <table ref={tableRef} className={tableClassName} style={tableStyle}>
          <thead className={mainHeaderClassName}>{headerRow}</thead>
          <tbody className={bodyClassName}>{bodyRows}</tbody>
        </table>
      </div>
    </>
  )
}
