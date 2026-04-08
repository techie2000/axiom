// @vitest-environment jsdom
import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SyncedWideTable from './SyncedWideTable'

(globalThis as { React?: typeof React }).React = React

const rect = (width: number, top = 0, bottom = 400, left = 0) => ({
  x: left,
  y: top,
  top,
  bottom,
  left,
  right: left + width,
  width,
  height: bottom - top,
  toJSON: () => ({}),
})

describe('SyncedWideTable scrollbar sync', () => {
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect
  const originalDivClientWidth = Object.getOwnPropertyDescriptor(HTMLDivElement.prototype, 'clientWidth')
  const originalDivScrollWidth = Object.getOwnPropertyDescriptor(HTMLDivElement.prototype, 'scrollWidth')
  const originalTableScrollWidth = Object.getOwnPropertyDescriptor(HTMLTableElement.prototype, 'scrollWidth')

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })

    vi.spyOn(document, 'addEventListener')

    Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this instanceof HTMLTableCellElement) {
        return rect(160, 0, 44)
      }

      if (this instanceof HTMLTableSectionElement) {
        return rect(480, 0, 44)
      }

      if (this instanceof HTMLDivElement) {
        return rect(240)
      }

      return rect(480)
    }

    Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 240
      },
    })

    Object.defineProperty(HTMLDivElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        return 480
      },
    })

    Object.defineProperty(HTMLTableElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        return 480
      },
    })
  })

  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect

    if (originalDivClientWidth) {
      Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', originalDivClientWidth)
    }
    if (originalDivScrollWidth) {
      Object.defineProperty(HTMLDivElement.prototype, 'scrollWidth', originalDivScrollWidth)
    }
    if (originalTableScrollWidth) {
      Object.defineProperty(HTMLTableElement.prototype, 'scrollWidth', originalTableScrollWidth)
    }

    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('syncs top scrollbar movement to the table container without registering a document scroll capture listener', async () => {
    const { container } = render(
      <SyncedWideTable
        stickyTopOffset={0}
        headerRow={(
          <tr>
            <th>Name</th>
            <th>Code</th>
            <th>Region</th>
          </tr>
        )}
        bodyRows={(
          <tr>
            <td>Alpha</td>
            <td>AA</td>
            <td>Region A</td>
          </tr>
        )}
      />,
    )

    await waitFor(() => {
      expect(container.querySelectorAll('div.theme-scrollbar').length).toBeGreaterThanOrEqual(3)
    })

    const [topScrollbar, stickyScrollbar, tableContainer] = Array.from(
      container.querySelectorAll('div.theme-scrollbar'),
    ) as HTMLDivElement[]

    topScrollbar.scrollLeft = 120
    fireEvent.scroll(topScrollbar)

    expect(topScrollbar.scrollLeft).toBe(120)
    expect(tableContainer.scrollLeft).toBe(120)
    expect(stickyScrollbar.scrollLeft).toBe(120)
    expect(document.addEventListener).not.toHaveBeenCalledWith('scroll', expect.any(Function), true)
  })
})