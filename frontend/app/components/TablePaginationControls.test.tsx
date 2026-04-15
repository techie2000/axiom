// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TablePaginationControls from './TablePaginationControls'

describe('TablePaginationControls', () => {
  it('renders pagination without page-size controls when those props are omitted', () => {
    render(
      <TablePaginationControls
        currentPage={2}
        isFirstPage={false}
        isLastPage={false}
        onPrevious={() => undefined}
        onNext={() => undefined}
        pageLabel="Page 2 of 10"
        previousLabel="Previous"
        nextLabel="Next"
      />,
    )

    expect(screen.getByText('Page 2 of 10')).toBeTruthy()
    expect(screen.queryByLabelText('Items per page')).toBeNull()
  })

  it('renders and wires the page-size select when page-size props are provided', () => {
    const onPageSizeChange = vi.fn()

    render(
      <TablePaginationControls
        currentPage={1}
        isFirstPage={true}
        isLastPage={false}
        onPrevious={() => undefined}
        onNext={() => undefined}
        pageSize={50}
        pageSizeOptions={[50, 100]}
        onPageSizeChange={onPageSizeChange}
        itemsPerPageLabel="Items per page"
        pageLabel="Page 1"
        previousLabel="Previous"
        nextLabel="Next"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Items per page' }))
    fireEvent.click(screen.getByRole('button', { name: '100' }))

    expect(onPageSizeChange).toHaveBeenCalledWith(100)
  })
})
