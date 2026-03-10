'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { readStoredUser, StoredUser } from '../lib/stored-user'
import { resetPreferencesCache } from '../lib/useUserPreference'
import ThemeToggle from './ThemeToggle'
import LanguageSelector from './LanguageSelector'

export default function UserBadge() {
  const router = useRouter()
  const [user, setUser] = useState<StoredUser | null>(null)
  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMounted(true)
    setUser(readStoredUser())
  }, [])

  useEffect(() => {
    if (!menuOpen) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current) return
      if (event.target instanceof Node && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menuOpen])

  const handleSignOut = () => {
    localStorage.removeItem('axiom_token')
    localStorage.removeItem('axiom_user')
    // Clear in-memory preference cache so the next login starts fresh.
    resetPreferencesCache()
    router.replace('/')
  }

  if (!mounted || !user) return null

  const displayName = user.full_name || user.username || user.email
  const isAdmin = user.role?.toLowerCase() === 'admin'
  const rolePillClasses = isAdmin
    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen((open) => !open)}
        className="flex items-center gap-2 h-9 px-3 rounded-lg bg-white/10 border border-white/20 text-sm hover:bg-white/20 transition-colors"
        title="Open user menu"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <span className="text-base leading-none" aria-hidden="true">👤</span>
        <span className="font-medium text-gray-900 dark:text-white">{displayName}</span>
        <span
          className={`px-1.5 py-0.5 text-xs font-semibold rounded capitalize ${rolePillClasses}`}
        >
          {user.role}
        </span>
        <span className="text-xs text-gray-700 dark:text-gray-300" aria-hidden="true">
          {menuOpen ? '▲' : '▼'}
        </span>
      </button>

      {menuOpen && (
        <div
          className="absolute right-0 mt-2 w-[320px] rounded-xl border border-gray-200 dark:border-white/20 bg-white dark:bg-gray-900 shadow-2xl p-4 z-50"
          role="menu"
          aria-label="User menu"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            Global Preferences
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700 dark:text-gray-300">Language</span>
              <LanguageSelector className="justify-end" compact />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700 dark:text-gray-300">Theme</span>
              <ThemeToggle />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/10">
            <button
              onClick={handleSignOut}
              className="w-full h-9 px-3 text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 dark:bg-red-600/20 dark:text-red-300 dark:border-red-500/30 dark:hover:bg-red-600/30 transition-colors"
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
