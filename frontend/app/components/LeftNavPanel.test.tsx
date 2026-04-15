// @vitest-environment jsdom
import React from 'react'
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import LeftNavPanel from './LeftNavPanel'

;(globalThis as { React?: typeof React }).React = React

const mocks = vi.hoisted(() => ({
  pathname: '/countries',
  token: null as string | null,
  user: null as { role: string } | null,
  favoriteHrefs: '[]',
  favoritesOnly: 'false',
  setFavoriteHrefs: vi.fn((value: string) => {
    mocks.favoriteHrefs = value
  }),
  setFavoritesOnly: vi.fn((value: string) => {
    mocks.favoritesOnly = value
  }),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className, 'aria-current': ariaCurrent }: {
    href: string
    children: React.ReactNode
    className?: string
    'aria-current'?: string
  }) =>
    React.createElement('a', { href, className, 'aria-current': ariaCurrent }, children),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('../lib/auth-token', () => ({
  getAuthToken: () => mocks.token,
}))

vi.mock('../lib/stored-user', () => ({
  readStoredUser: () => mocks.user,
}))

vi.mock('../lib/useUserPreference', () => ({
  useUserPreference: (_pageKey: string, prefKey: string, defaultValue: string) => {
    if (prefKey === 'nav_favorites') {
      return [mocks.favoriteHrefs, mocks.setFavoriteHrefs, false] as const
    }
    if (prefKey === 'nav_favorites_only') {
      return [mocks.favoritesOnly, mocks.setFavoritesOnly, false] as const
    }
    return [defaultValue, vi.fn(), false] as const
  },
}))

describe('LeftNavPanel', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    mocks.pathname = '/countries'
    mocks.token = null
    mocks.user = null
    mocks.favoriteHrefs = '[]'
    mocks.favoritesOnly = 'false'
    mocks.setFavoriteHrefs.mockClear()
    mocks.setFavoritesOnly.mockClear()
  })

  it('renders the trigger button', () => {
    const { container } = render(<LeftNavPanel />)
    const btn = container.querySelector('button[aria-expanded]')
    expect(btn).not.toBeNull()
  })

  it('panel is hidden initially (translate-x-full)', () => {
    const { container } = render(<LeftNavPanel />)
    // The slide panel should have -translate-x-full class when closed
    const nav = container.querySelector('[role="navigation"]')
    expect(nav?.className).toContain('-translate-x-full')
  })

  it('opens the panel on trigger click', async () => {
    const { container } = render(<LeftNavPanel />)
    const btn = container.querySelector('button[aria-expanded]') as HTMLButtonElement
    fireEvent.click(btn)
    await waitFor(() => {
      const nav = container.querySelector('[role="navigation"]')
      expect(nav?.className).not.toContain('-translate-x-full')
    })
  })

  it('closes the panel on Escape key', async () => {
    const { container } = render(<LeftNavPanel />)
    const btn = container.querySelector('button[aria-expanded]') as HTMLButtonElement
    fireEvent.click(btn)
    await waitFor(() => {
      const nav = container.querySelector('[role="navigation"]')
      expect(nav?.className).not.toContain('-translate-x-full')
    })
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      const nav = container.querySelector('[role="navigation"]')
      expect(nav?.className).toContain('-translate-x-full')
    })
  })

  it('marks the current page link as aria-current=page', () => {
    mocks.pathname = '/countries'
    const { container } = render(<LeftNavPanel />)
    const activeLink = container.querySelector('a[aria-current="page"]') as HTMLAnchorElement | null
    expect(activeLink).not.toBeNull()
    expect(activeLink?.getAttribute('href')).toBe('/countries')
  })

  it('marks dashboard as current when pathname is /dashboard', () => {
    mocks.token = 'some-jwt-token'
    mocks.pathname = '/dashboard'
    const { container } = render(<LeftNavPanel />)
    const activeLink = container.querySelector('a[href="/dashboard"][aria-current="page"]') as HTMLAnchorElement | null
    expect(activeLink).not.toBeNull()
  })

  it('does not show Master Data section when not logged in', () => {
    mocks.token = null
    const { queryByText } = render(<LeftNavPanel />)
    expect(queryByText('leftNav.sections.masterData')).toBeNull()
  })

  it('shows Master Data section when logged in', () => {
    mocks.token = 'some-jwt-token'
    const { getByText } = render(<LeftNavPanel />)
    expect(getByText('leftNav.sections.masterData')).toBeTruthy()
  })

  it('shows Admin section when user is admin', () => {
    mocks.token = 'some-jwt-token'
    mocks.user = { role: 'admin' }
    const { getByText } = render(<LeftNavPanel />)
    expect(getByText('leftNav.sections.admin')).toBeTruthy()
    expect(getByText('leftNav.sections.dataAcquisition')).toBeTruthy()
    expect(getByText('leftNav.items.syncTriggers')).toBeTruthy()
  })

  it('hides Admin section when user is not admin', () => {
    mocks.token = 'some-jwt-token'
    mocks.user = { role: 'user' }
    const { queryByText } = render(<LeftNavPanel />)
    expect(queryByText('leftNav.sections.admin')).toBeNull()
    expect(queryByText('leftNav.sections.dataAcquisition')).toBeNull()
    expect(queryByText('leftNav.items.syncTriggers')).toBeNull()
  })

  it('does not render on /login page', () => {
    mocks.pathname = '/login'
    const { container } = render(<LeftNavPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('does not render on /register page', () => {
    mocks.pathname = '/register'
    const { container } = render(<LeftNavPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('closes the panel on route change', async () => {
    const { container, rerender } = render(<LeftNavPanel />)
    const btn = container.querySelector('button[aria-expanded]') as HTMLButtonElement

    fireEvent.click(btn)
    await waitFor(() => {
      const nav = container.querySelector('[role="navigation"]')
      expect(nav?.className).not.toContain('-translate-x-full')
    })

    mocks.pathname = '/languages'
    rerender(<LeftNavPanel />)

    await waitFor(() => {
      const nav = container.querySelector('[role="navigation"]')
      expect(nav?.className).toContain('-translate-x-full')
    })
  })

  it('closes the panel on outside click', async () => {
    const { container } = render(<LeftNavPanel />)
    const btn = container.querySelector('button[aria-expanded]') as HTMLButtonElement

    fireEvent.click(btn)
    await waitFor(() => {
      const nav = container.querySelector('[role="navigation"]')
      expect(nav?.className).not.toContain('-translate-x-full')
    })

    fireEvent.mouseDown(document.body)

    await waitFor(() => {
      const nav = container.querySelector('[role="navigation"]')
      expect(nav?.className).toContain('-translate-x-full')
    })
  })

  it('saves favourite href when starring a navigation item', async () => {
    const { container } = render(<LeftNavPanel />)
    const favoriteButtons = container.querySelectorAll('button[aria-label="leftNav.addFavorite"]')
    expect(favoriteButtons.length).toBeGreaterThan(0)

    fireEvent.click(favoriteButtons[0])

    expect(mocks.setFavoriteHrefs).toHaveBeenCalled()
    const latestCall = mocks.setFavoriteHrefs.mock.calls.at(-1)?.[0] as string
    const parsed = JSON.parse(latestCall) as string[]
    expect(parsed.length).toBeGreaterThan(0)
  })

  it('filters navigation items when favourites-only is enabled', () => {
    mocks.favoritesOnly = 'true'
    mocks.favoriteHrefs = '["/languages"]'

    const { queryByText, getByText } = render(<LeftNavPanel />)
    expect(getByText('leftNav.items.languages')).toBeTruthy()
    expect(queryByText('leftNav.items.countries')).toBeNull()
  })

  it('shows empty-state and resets to all pages when no favourites are visible', () => {
    mocks.favoritesOnly = 'true'
    mocks.favoriteHrefs = '[]'

    const { getByText } = render(<LeftNavPanel />)
    expect(getByText('leftNav.favoritesEmptyTitle')).toBeTruthy()

    fireEvent.click(getByText('leftNav.showAllPages'))
    expect(mocks.setFavoritesOnly).toHaveBeenCalledWith('false')
  })
})
