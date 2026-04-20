'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { readStoredUser, StoredUser } from '../lib/stored-user'
import { resetPreferencesCache } from '../lib/useUserPreference'
import { resetDeferredBooleanPreferenceSession } from '../lib/useDeferredBooleanPreference'
import { resetDeferredPreferenceSession } from '../lib/useDeferredStringPreference'
import { useEnglishTooltips } from '../lib/useEnglishTooltips'
import { useButtonEmojiMode, EmojiMode } from '../lib/useButtonEmojiMode'
import { getMapProvider, MAP_PROVIDERS, MapProviderId } from '../lib/map-providers'
import { useUserPreference } from '../lib/useUserPreference'
import { applyTheme, applyDarkMode } from '../lib/theme'
import MapProviderIcon from './MapProviderIcon'
import ThemeSelector from './ThemeSelector'
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
  const [storedMapProvider, setStoredMapProvider] = useUserPreference(
    'global',
    'map_provider',
    'openstreetmap',
  )
  const [favoritesOnlyNavigation, setFavoritesOnlyNavigation] = useUserPreference(
    'global',
    'nav_favorites_only',
    'false',
  )
  const normalizedMapProviderId = getMapProvider(storedMapProvider).id
  const favoritesOnlyEnabled = favoritesOnlyNavigation === 'true'

  // Eagerly apply theme and dark-mode preferences from the server as soon as
  // they are loaded into the cache (#267).  ThemeSelector / ThemeToggle are
  // rendered only when the menu is open, so without these effects the colour
  // palette and light/dark state were stale (localStorage values) until the
  // user opened the menu for the first time.
  const [themeValue] = useUserPreference('global', 'theme', 'default')
  const [darkModeValue] = useUserPreference('global', 'dark_mode', 'dark')

  useEffect(() => {
    applyTheme(themeValue || 'default')
  }, [themeValue])

  useEffect(() => {
    applyDarkMode(darkModeValue !== 'light')
  }, [darkModeValue])

  const emojiModeLabels: Record<EmojiMode, string> = {
    both: t('preferences.buttonEmojiMode.both'),
    text: t('preferences.buttonEmojiMode.text'),
    emoji: t('preferences.buttonEmojiMode.emoji'),
  }
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
    resetDeferredBooleanPreferenceSession()
    resetDeferredPreferenceSession()
    router.replace('/')
  }

  if (!mounted || !user) return null

  const displayName = user.full_name || user.username || user.email
  const isAdmin = user.role?.toLowerCase() === 'admin'
  const rolePillClasses = isAdmin
    ? 'theme-subtle'
    : 'theme-btn-neutral'

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        onClick={() => setMenuOpen((open) => !open)}
        className="theme-header-action rounded-lg theme-btn-neutral theme-focus"
        title={t('preferences.openUserMenu')}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <span className="text-base leading-none" aria-hidden="true">👤</span>
        <span className="max-w-[12rem] truncate">{displayName}</span>
        <span
          className={`px-1.5 py-0.5 text-xs font-semibold leading-none rounded capitalize ${rolePillClasses}`}
        >
          {user.role}
        </span>
        <span className="text-xs theme-text-muted" aria-hidden="true">
          {menuOpen ? '▲' : '▼'}
        </span>
      </button>

      {menuOpen && (
        <div
          className={`absolute mt-2 w-[320px] max-w-[calc(100vw-1rem)] rounded-xl theme-dropdown shadow-2xl p-4 z-50 ${menuAlign === 'right' ? 'right-0' : 'left-0'}`}
          role="menu"
          aria-label="User menu"
        >
          <p className="text-xs font-semibold uppercase tracking-wide theme-text-muted mb-3">
            {t('preferences.menuLabel')}
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm theme-text-muted">{t('preferences.language')}</span>
              <LanguageSelector className="justify-end" compact />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm theme-text-muted">{t('preferences.theme')}</span>
              <div className="flex items-center gap-1.5">
                <ThemeSelector />
                <ThemeToggle />
              </div>
            </div>
            <label className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block text-sm theme-text-muted">{t('preferences.englishTooltips')}</span>
                <span className="block text-xs theme-text-muted">{t('preferences.englishTooltipsDescription')}</span>
              </div>
              <input
                type="checkbox"
                checked={englishTooltipsPreferenceEnabled}
                onChange={(event) => setEnglishTooltipsPreferenceEnabled(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[rgb(var(--border-rgb))] text-[rgb(var(--primary-rgb))] focus:ring-[rgb(var(--ring-rgb))]"
              />
            </label>
            <label className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block text-sm theme-text-muted">{t('preferences.favoritesOnlyNavigation')}</span>
                <span className="block text-xs theme-text-muted">{t('preferences.favoritesOnlyNavigationDescription')}</span>
              </div>
              <input
                type="checkbox"
                checked={favoritesOnlyEnabled}
                onChange={(event) => setFavoritesOnlyNavigation(String(event.target.checked))}
                className="mt-1 h-4 w-4 rounded border-[rgb(var(--border-rgb))] text-[rgb(var(--primary-rgb))] focus:ring-[rgb(var(--ring-rgb))]"
                aria-label={t('preferences.favoritesOnlyNavigation')}
              />
            </label>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block text-sm theme-text-muted">{t('preferences.buttonEmoji')}</span>
                <span className="block text-xs theme-text-muted">{t('preferences.buttonEmojiDescription')}</span>
              </div>
              <div className="flex shrink-0 gap-1" role="group" aria-label={t('preferences.buttonEmoji')}>
                {(['both', 'text', 'emoji'] as EmojiMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setEmojiMode(mode)}
                    className={`px-2 py-1 text-xs rounded border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring-rgb))] ${
                      emojiMode === mode
                        ? 'theme-btn-primary'
                        : 'theme-btn-neutral'
                    }`}
                    aria-pressed={emojiMode === mode}
                  >
                    {emojiModeLabels[mode]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block text-sm theme-text-muted">{t('preferences.mapProvider')}</span>
                <span className="block text-xs theme-text-muted">{t('preferences.mapProviderDescription')}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <MapProviderIcon providerId={normalizedMapProviderId} className="w-3.5 h-3.5 shrink-0" />
                <select
                  value={normalizedMapProviderId}
                  onChange={(e) => {
                    const selected = e.target.value
                    if (MAP_PROVIDERS.some((p) => p.id === selected)) {
                      setStoredMapProvider(selected as MapProviderId)
                    }
                  }}
                  className="shrink-0 text-xs rounded border theme-btn-neutral theme-focus px-1.5 py-1 bg-[rgb(var(--surface-rgb))] text-[rgb(var(--foreground-rgb))]"
                  aria-label={t('preferences.mapProvider')}
                >
                  {MAP_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[rgb(var(--surface-rgb))] text-[rgb(var(--foreground-rgb))]">
                      {t(p.labelKey, { defaultValue: p.label })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/10">
            <button
              onClick={handleSignOut}
              className="w-full h-9 px-3 text-sm rounded-lg theme-btn-neutral"
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
