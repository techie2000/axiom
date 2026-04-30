'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { getAuthToken } from '../lib/auth-token'
import { readStoredUser } from '../lib/stored-user'
import { useUserPreference } from '../lib/useUserPreference'

interface NavItem {
  href: string
  icon: string
  labelKey: string
  requiresAuth?: boolean
  requiresAdmin?: boolean
}

interface NavSection {
  titleKey: string
  requiresAuth?: boolean
  requiresAdmin?: boolean
  items: NavItem[]
}

const DASHBOARD_ITEM: NavItem = {
  href: '/dashboard',
  icon: '🏠',
  labelKey: 'leftNav.items.dashboard',
  requiresAuth: true,
}

const ADMIN_ITEMS: NavItem[] = [
  { href: '/admin/users', icon: '👥', labelKey: 'leftNav.items.adminUsers', requiresAuth: true, requiresAdmin: true },
  {
    href: '/admin/user-entity-links',
    icon: '🔗',
    labelKey: 'leftNav.items.userEntityLinks',
    requiresAuth: true,
    requiresAdmin: true,
  },
  {
    href: '/admin/provisional-lei',
    icon: '🔖',
    labelKey: 'leftNav.items.provisionalLei',
    requiresAuth: true,
    requiresAdmin: true,
  },
  {
    href: '/admin/translations',
    icon: '🌐',
    labelKey: 'leftNav.items.adminTranslations',
    requiresAuth: true,
    requiresAdmin: true,
  },
]

const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: 'leftNav.sections.publicData',
    items: [
      { href: '/countries', icon: '🌍', labelKey: 'leftNav.items.countries' },
      { href: '/currencies', icon: '💱', labelKey: 'leftNav.items.currencies' },
      { href: '/languages', icon: '🗣️', labelKey: 'leftNav.items.languages' },
      { href: '/lei-records', icon: '🏢', labelKey: 'leftNav.items.leiRecords' },
    ],
  },
  {
    titleKey: 'leftNav.sections.masterData',
    requiresAuth: true,
    items: [
      { href: '/instruments', icon: '🎯', labelKey: 'leftNav.items.instruments', requiresAuth: true },
      { href: '/accounts', icon: '🏦', labelKey: 'leftNav.items.accounts', requiresAuth: true },
      { href: '/ssi', icon: '📋', labelKey: 'leftNav.items.ssi', requiresAuth: true },
      { href: '/code-mappings', icon: '🔄', labelKey: 'leftNav.items.codeMappings', requiresAuth: true },
    ],
  },
  {
    titleKey: 'leftNav.sections.dataAcquisition',
    requiresAuth: true,
    requiresAdmin: true,
    items: [
      { href: '/lei', icon: '⚙️', labelKey: 'leftNav.items.syncTriggers', requiresAuth: true, requiresAdmin: true },
    ],
  },
]

function parseFavoriteHrefs(rawValue: string): Set<string> {
  if (!rawValue) return new Set()

  try {
    const parsed = JSON.parse(rawValue)
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((item): item is string => typeof item === 'string'))
    }
  } catch {
    // Backward-compatible fallback in case an older comma-separated value exists.
    return new Set(
      rawValue
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    )
  }

  return new Set()
}

function serializeFavoriteHrefs(values: Set<string>): string {
  return JSON.stringify(Array.from(values).sort())
}

export default function LeftNavPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [storedFavoriteHrefs, setStoredFavoriteHrefs] = useUserPreference('global', 'nav_favorites', '[]')
  const [favoritesOnlyPreference, setFavoritesOnlyPreference] = useUserPreference('global', 'nav_favorites_only', 'false')
  const panelRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const { t } = useTranslation('common')

  useEffect(() => {
    setMounted(true)
    const token = getAuthToken()
    const hasToken = token !== null
    setIsLoggedIn(hasToken)
    const user = readStoredUser()
    setIsAdmin(hasToken && user?.role?.toLowerCase() === 'admin')
  }, [])

  // Close on route change
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Close on Escape key or outside click
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    const handleOutsideClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleOutsideClick)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen])

  // Don't render on server side
  if (!mounted) return null

  // Don't show on login/register pages
  if (pathname === '/login' || pathname === '/register') return null

  const favoritesOnlyEnabled = favoritesOnlyPreference === 'true'
  const favoriteHrefs = parseFavoriteHrefs(storedFavoriteHrefs)

  const isVisibleByRole = (item: NavItem) => (!item.requiresAuth || isLoggedIn) && (!item.requiresAdmin || isAdmin)
  const matchesFavoriteFilter = (item: NavItem) => !favoritesOnlyEnabled || favoriteHrefs.has(item.href)
  const isFavorite = (item: NavItem) => favoriteHrefs.has(item.href)

  const toggleFavorite = (href: string) => {
    const nextFavorites = new Set(favoriteHrefs)
    if (nextFavorites.has(href)) {
      nextFavorites.delete(href)
    } else {
      nextFavorites.add(href)
    }
    setStoredFavoriteHrefs(serializeFavoriteHrefs(nextFavorites))
  }

  const setFavoritesOnly = (nextValue: boolean) => {
    setFavoritesOnlyPreference(String(nextValue))
  }

  const visibleSections = NAV_SECTIONS
    .filter((section) => (!section.requiresAuth || isLoggedIn) && (!section.requiresAdmin || isAdmin))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isVisibleByRole(item) && matchesFavoriteFilter(item)),
    }))
    .filter((section) => section.items.length > 0)

  const visibleDashboard = isVisibleByRole(DASHBOARD_ITEM) && matchesFavoriteFilter(DASHBOARD_ITEM)
  const visibleAdminItems = isLoggedIn && isAdmin
    ? ADMIN_ITEMS.filter((item) => isVisibleByRole(item) && matchesFavoriteFilter(item))
    : []
  const hasVisibleLinks = visibleDashboard || visibleSections.length > 0 || visibleAdminItems.length > 0

  const renderNavItem = (item: NavItem, isActive: boolean) => {
    const itemTitle = t(item.labelKey)
    const favoriteLabel = isFavorite(item)
      ? t('leftNav.removeFavorite', { page: itemTitle })
      : t('leftNav.addFavorite', { page: itemTitle })

    return (
      <li key={item.href} className="flex items-center gap-1">
        <Link
          href={item.href}
          className={`
            flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors flex-1 min-w-0
            focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring-rgb))] focus-visible:ring-offset-1
            ${isActive
              ? 'bg-[rgb(var(--primary-rgb))] text-[rgb(var(--primary-foreground-rgb))]'
              : 'hover:bg-[rgb(var(--surface-muted-rgb))] text-[rgb(var(--foreground-rgb))]'
            }
          `}
          aria-current={isActive ? 'page' : undefined}
        >
          <span aria-hidden="true">{item.icon}</span>
          <span className="truncate">{itemTitle}</span>
        </Link>
        <button
          type="button"
          onClick={() => toggleFavorite(item.href)}
          className="h-8 w-8 shrink-0 rounded-md theme-btn-neutral theme-focus text-base"
          aria-label={favoriteLabel}
          aria-pressed={isFavorite(item)}
          title={favoriteLabel}
        >
          {isFavorite(item) ? '★' : '☆'}
        </button>
      </li>
    )
  }

  return (
    <div ref={panelRef} className="fixed left-0 top-0 h-full z-[45] flex items-center pointer-events-none">
      {/* Slide-out panel */}
      <div
        id="left-nav-panel"
        className={`
          pointer-events-auto
          h-full overflow-y-auto
          w-64
          theme-dropdown
          border-r border-[rgb(var(--border-rgb))]
          shadow-2xl
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          flex flex-col
        `}
        role="navigation"
        aria-label={t('leftNav.title')}
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        {/* Panel header */}
        <div className="p-4 border-b border-[rgb(var(--border-rgb))] shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold uppercase tracking-wide theme-text-muted">
              {t('leftNav.title')}
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="h-7 w-7 flex items-center justify-center rounded theme-btn-neutral theme-focus text-sm"
              aria-label={t('leftNav.close')}
            >
              ✕
            </button>
          </div>
          <label className="flex items-center justify-between gap-3 text-xs theme-text-muted">
            <span>{t('leftNav.favoritesOnly')}</span>
            <input
              type="checkbox"
              checked={favoritesOnlyEnabled}
              onChange={(event) => setFavoritesOnly(event.target.checked)}
              className="h-4 w-4 rounded border-[rgb(var(--border-rgb))] text-[rgb(var(--primary-rgb))] focus:ring-[rgb(var(--ring-rgb))]"
              aria-label={t('leftNav.favoritesOnly')}
            />
          </label>
        </div>

        {/* Dashboard link (when logged in) */}
        {visibleDashboard && (
          <div className="px-3 pt-3 pb-1 shrink-0">
            <ul className="space-y-0.5">
              {renderNavItem(DASHBOARD_ITEM, pathname === '/dashboard')}
            </ul>
          </div>
        )}

        {/* Navigation sections */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {favoritesOnlyEnabled && !hasVisibleLinks && (
            <div className="mx-1 mb-4 rounded-lg border border-[rgb(var(--border-rgb))] bg-[rgb(var(--surface-muted-rgb))] p-3">
              <p className="text-sm font-semibold text-[rgb(var(--foreground-rgb))]">{t('leftNav.favoritesEmptyTitle')}</p>
              <p className="mt-1 text-xs theme-text-muted">{t('leftNav.favoritesEmptyDescription')}</p>
              <button
                type="button"
                className="mt-3 h-8 px-3 text-xs rounded-md theme-btn-neutral theme-focus"
                onClick={() => setFavoritesOnly(false)}
              >
                {t('leftNav.showAllPages')}
              </button>
            </div>
          )}

          {visibleSections.map((section) => (
            <div key={section.titleKey} className="mb-4">
              <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wide theme-text-muted">
                {t(section.titleKey)}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                  return renderNavItem(item, isActive)
                })}
              </ul>
            </div>
          ))}

          {/* Admin section */}
          {visibleAdminItems.length > 0 && (
            <div className="mb-4">
              <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wide theme-text-muted">
                {t('leftNav.sections.admin')}
              </p>
              <ul className="space-y-0.5">
                {visibleAdminItems.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                  return renderNavItem(item, isActive)
                })}
              </ul>
            </div>
          )}
        </nav>
      </div>

      {/* Trigger tab - always visible on left edge */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`
          pointer-events-auto
          absolute
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-64' : 'translate-x-0'}
          h-12 w-10
          flex items-center justify-center
          rounded-r-xl
          bg-[rgb(var(--surface-rgb))]
          border border-l-0 border-[rgb(var(--border-rgb))]
          shadow-md
          hover:bg-[rgb(var(--surface-muted-rgb))]
          transition-colors
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring-rgb))]
        `}
        aria-label={isOpen ? t('leftNav.close') : t('leftNav.open')}
        aria-expanded={isOpen}
        aria-controls="left-nav-panel"
      >
        {/* Sidebar/panel icon - two vertical panels */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        >
          {/* Outer rectangle */}
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          {/* Left panel divider */}
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      </button>
    </div>
  )
}
