'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { getAuthToken } from '../lib/auth-token'
import { readStoredUser } from '../lib/stored-user'

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

export default function LeftNavPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mounted, setMounted] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const { t } = useTranslation('common')

  useEffect(() => {
    setMounted(true)
    const token = getAuthToken()
    setIsLoggedIn(token !== null)
    const user = readStoredUser()
    setIsAdmin(user?.role?.toLowerCase() === 'admin')
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

  const visibleSections = NAV_SECTIONS.filter(
    (section) =>
      (!section.requiresAuth || isLoggedIn) &&
      (!section.requiresAdmin || isAdmin),
  )

  return (
    <div ref={panelRef} className="fixed left-0 top-0 h-full z-[45] flex items-center pointer-events-none">
      {/* Slide-out panel */}
      <div
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
      >
        {/* Panel header */}
        <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border-rgb))] shrink-0">
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

        {/* Dashboard link (when logged in) */}
        {isLoggedIn && (
          <div className="px-3 pt-3 pb-1 shrink-0">
            <Link
              href="/dashboard"
              className={`
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                ${pathname === '/dashboard'
                  ? 'bg-[rgb(var(--primary-rgb))] text-[rgb(var(--primary-foreground-rgb))]'
                  : 'hover:bg-[rgb(var(--surface-muted-rgb))] text-[rgb(var(--foreground-rgb))]'
                }
              `}
            >
              <span aria-hidden="true">🏠</span>
              <span>{t('leftNav.items.dashboard')}</span>
            </Link>
          </div>
        )}

        {/* Navigation sections */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {visibleSections.map((section) => (
            <div key={section.titleKey} className="mb-4">
              <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wide theme-text-muted">
                {t(section.titleKey)}
              </p>
              <ul className="space-y-0.5">
                {section.items
                  .filter(
                    (item) =>
                      (!item.requiresAuth || isLoggedIn) &&
                      (!item.requiresAdmin || isAdmin),
                  )
                  .map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`
                          flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring-rgb))] focus-visible:ring-offset-1
                          ${isActive
                            ? 'bg-[rgb(var(--primary-rgb))] text-[rgb(var(--primary-foreground-rgb))]'
                            : 'hover:bg-[rgb(var(--surface-muted-rgb))] text-[rgb(var(--foreground-rgb))]'
                          }
                        `}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <span aria-hidden="true">{item.icon}</span>
                        <span>{t(item.labelKey)}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          {/* Admin section */}
          {isAdmin && (
            <div className="mb-4">
              <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wide theme-text-muted">
                {t('leftNav.sections.admin')}
              </p>
              <ul className="space-y-0.5">
                <li>
                  <Link
                    href="/admin/users"
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring-rgb))] focus-visible:ring-offset-1
                      ${pathname === '/admin/users'
                        ? 'bg-[rgb(var(--primary-rgb))] text-[rgb(var(--primary-foreground-rgb))]'
                        : 'hover:bg-[rgb(var(--surface-muted-rgb))] text-[rgb(var(--foreground-rgb))]'
                      }
                    `}
                    aria-current={pathname === '/admin/users' ? 'page' : undefined}
                  >
                    <span aria-hidden="true">👥</span>
                    <span>{t('leftNav.items.adminUsers')}</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/admin/translations"
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring-rgb))] focus-visible:ring-offset-1
                      ${pathname === '/admin/translations'
                        ? 'bg-[rgb(var(--primary-rgb))] text-[rgb(var(--primary-foreground-rgb))]'
                        : 'hover:bg-[rgb(var(--surface-muted-rgb))] text-[rgb(var(--foreground-rgb))]'
                      }
                    `}
                    aria-current={pathname === '/admin/translations' ? 'page' : undefined}
                  >
                    <span aria-hidden="true">🌐</span>
                    <span>{t('leftNav.items.adminTranslations')}</span>
                  </Link>
                </li>
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
