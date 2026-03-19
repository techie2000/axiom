'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { readStoredUser, StoredUser } from '../lib/stored-user'
import { resetPreferencesCache } from '../lib/useUserPreference'
import { useEnglishTooltips } from '../lib/useEnglishTooltips'
import { useButtonEmojiMode, EmojiMode } from '../lib/useButtonEmojiMode'
import ThemeToggle from './ThemeToggle'
import LanguageSelector from './LanguageSelector'

export default function UserBadge() {
  const router = useRouter()
  const { t } = useTranslation('common')
  const {
    englishTooltipsPreferenceEnabled,
    setEnglishTooltipsPreferenceEnabled,
  } = useEnglishTooltips()
  const { emojiMode, setEmojiMode } = useButtonEmojiMode()
  const [user, setUser] = useState<StoredUser | null>(null)
  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuAlign, setMenuAlign] = useState<'left' | 'right'>('right')
  const menuRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    setMounted(true)
    setUser(readStoredUser())
  }, [])

  useEffect(() => {
    if (!menuOpen) return

    const buttonRect = buttonRef.current?.getBoundingClientRect()
    if (buttonRect) {
      // Open toward the viewport center to keep the panel visually inside content bounds.
      setMenuAlign(buttonRect.left > window.innerWidth / 2 ? 'right' : 'left')
    }

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
        ref={buttonRef}
        onClick={() => setMenuOpen((open) => !open)}
        className="flex items-center gap-2 h-9 px-3 rounded-lg bg-white/10 border border-gray-400/50 dark:border-white/20 text-sm hover:bg-white/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
        title={t('preferences.openUserMenu')}
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
          className={`absolute mt-2 w-[320px] max-w-[calc(100vw-1rem)] rounded-xl border border-gray-200 dark:border-white/20 bg-white dark:bg-gray-900 shadow-2xl p-4 z-50 ${menuAlign === 'right' ? 'right-0' : 'left-0'}`}
          role="menu"
          aria-label="User menu"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            {t('preferences.menuLabel')}
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('preferences.language')}</span>
              <LanguageSelector className="justify-end" compact />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('preferences.theme')}</span>
              <ThemeToggle />
            </div>
            <label className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block text-sm text-gray-700 dark:text-gray-300">{t('preferences.englishTooltips')}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{t('preferences.englishTooltipsDescription')}</span>
              </div>
              <input
                type="checkbox"
                checked={englishTooltipsPreferenceEnabled}
                onChange={(event) => setEnglishTooltipsPreferenceEnabled(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </label>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block text-sm text-gray-700 dark:text-gray-300">{t('preferences.buttonEmoji')}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{t('preferences.buttonEmojiDescription')}</span>
              </div>
              <div className="flex shrink-0 gap-1" role="group" aria-label={t('preferences.buttonEmoji')}>
                {(['both', 'text', 'emoji'] as EmojiMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setEmojiMode(mode)}
                    className={`px-2 py-1 text-xs rounded border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      emojiMode === mode
                        ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                        : 'border-gray-300 dark:border-white/20 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10'
                    }`}
                    aria-pressed={emojiMode === mode}
                  >
                    {t(`preferences.buttonEmojiMode.${mode}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/10">
            <button
              onClick={handleSignOut}
              className="w-full h-9 px-3 text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 dark:bg-red-600/20 dark:text-red-300 dark:border-red-500/30 dark:hover:bg-red-600/30 transition-colors"
              title={t('preferences.signOut')}
            >
              {t('preferences.signOut')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
