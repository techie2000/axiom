'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PreferenceSavePrompt from './PreferenceSavePrompt'
import { useDeferredStringPreference } from '../lib/useDeferredStringPreference'
import { applyTheme, THEMES, resolveTheme } from '../lib/theme'
import type { ThemeId } from '../lib/theme'

/**
 * ThemeSelector renders a compact dropdown that lets users choose a colour palette
 * from the pre-defined set.  Palette choice is independent of dark/light mode —
 * that is controlled separately by ThemeToggle.
 *
 * Preference: global / theme  (ThemeId — one of the palette IDs)
 */
export default function ThemeSelector() {
  const { t } = useTranslation('common')
  const themePreference = useDeferredStringPreference({
    pageKey: 'global',
    preferenceKey: 'theme',
    defaultValue: 'default',
  })
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const effectiveTheme = resolveTheme(themePreference.value)

  // Apply the palette to <html> whenever the preference changes.
  useEffect(() => {
    setMounted(true)
    applyTheme(themePreference.value || 'default')
  }, [themePreference.value])

  // Close dropdown on outside click or Escape key.
  useEffect(() => {
    if (!open) return

    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && e.target instanceof Node && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const selectTheme = (id: ThemeId) => {
    themePreference.setValue(id)
    setOpen(false)
  }

  // Pre-render placeholder to avoid hydration mismatch.
  if (!mounted) {
    return (
      <button className="h-9 px-3 inline-flex items-center gap-2 rounded-lg theme-btn-neutral text-sm opacity-60 cursor-not-allowed">
        <span className="text-base leading-none">🎨</span>
        <span className="hidden sm:inline font-medium">Theme</span>
      </button>
    )
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          ref={buttonRef}
          onClick={() => setOpen((v) => !v)}
          className="h-9 px-3 inline-flex items-center gap-2 rounded-lg theme-btn-neutral theme-focus text-sm font-medium"
          aria-label={t('preferences.changeTheme')}
          aria-haspopup="listbox"
          aria-expanded={open}
          title={t('preferences.changeTheme')}
        >
          <span className="text-base leading-none" aria-hidden="true">{effectiveTheme.emoji}</span>
          <span className="hidden sm:inline">
            {t(effectiveTheme.label)}
          </span>
          <span className="text-xs theme-text-muted" aria-hidden="true">
            {open ? '▲' : '▼'}
          </span>
        </button>

        {open && (
          <div
            className="absolute right-0 mt-1 w-52 rounded-xl theme-dropdown shadow-2xl overflow-hidden z-50"
            role="listbox"
            aria-label={t('preferences.theme')}
          >
            {THEMES.map((theme) => {
              const isActive = effectiveTheme.id === theme.id
              return (
                <button
                  key={theme.id}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => selectTheme(theme.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--ring-rgb))] ${
                    isActive
                      ? 'theme-subtle font-medium'
                      : 'hover:bg-[rgb(var(--surface-soft-rgb))]'
                  }`}
                >
                  <span className="text-base leading-none w-5 text-center" aria-hidden="true">
                    {theme.emoji}
                  </span>
                  <div className="min-w-0">
                    <span className="block truncate">{t(theme.label)}</span>
                    <span className="block text-xs opacity-60 truncate">{t(theme.description)}</span>
                  </div>
                  {isActive && (
                    <span className="ml-auto theme-link shrink-0" aria-hidden="true">✓</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <PreferenceSavePrompt
        visible={themePreference.showPrompt}
        resetKey={themePreference.promptResetKey}
        onSave={themePreference.save}
        onDismiss={themePreference.dismiss}
        label={t('preferences.saveThemeDefault')}
        showUndo={themePreference.showUndo}
        undoResetKey={themePreference.undoResetKey}
        onUndo={themePreference.undo}
        onUndoDismiss={themePreference.undoDismiss}
        undoLabel={t('preferences.savedUndo')}
      />
    </>
  )
}
