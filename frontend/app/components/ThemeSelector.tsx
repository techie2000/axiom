'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PreferenceSavePrompt from './PreferenceSavePrompt'
import { useDeferredStringPreference } from '../lib/useDeferredStringPreference'
import { applyTheme, THEMES, resolveTheme } from '../lib/theme'
import type { ThemeId } from '../lib/theme'

/**
 * ThemeSelector renders a compact dropdown button that allows users to choose
 * from the set of pre-defined application themes.
 *
 * Theme preference is persisted via `useDeferredStringPreference` (global / theme),
 * matching the same preference key used by the original ThemeToggle so that
 * existing saved preferences are honoured transparently.
 */
export default function ThemeSelector() {
  const { t } = useTranslation('common')
  const themePreference = useDeferredStringPreference({
    pageKey: 'global',
    preferenceKey: 'theme',
    defaultValue: 'dark',
  })
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const effectiveTheme = resolveTheme(themePreference.value)

  // Apply the theme to <html> whenever the preference changes.
  useEffect(() => {
    setMounted(true)
    applyTheme(themePreference.value || 'dark')
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
      <button className="h-9 px-3 flex items-center gap-1.5 rounded-lg opacity-50 cursor-not-allowed text-sm">
        <span className="text-base leading-none">🌓</span>
        <span className="hidden sm:inline text-xs font-medium">Theme</span>
      </button>
    )
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          ref={buttonRef}
          onClick={() => setOpen((v) => !v)}
          className="h-9 px-2.5 flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-gray-400/50 dark:border-white/20 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 text-sm font-medium"
          aria-label={t('preferences.changeTheme')}
          aria-haspopup="listbox"
          aria-expanded={open}
          title={t('preferences.changeTheme')}
        >
          <span className="text-base leading-none" aria-hidden="true">{effectiveTheme.emoji}</span>
          <span className="hidden sm:inline text-xs font-medium text-gray-900 dark:text-white">
            {t(effectiveTheme.label)}
          </span>
          <span className="text-xs text-gray-700 dark:text-gray-300" aria-hidden="true">
            {open ? '▲' : '▼'}
          </span>
        </button>

        {open && (
          <div
            className="absolute right-0 mt-1 w-48 rounded-xl border border-gray-200 dark:border-white/20 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden z-50"
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
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-600/20 dark:text-blue-300 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
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
                    <span className="ml-auto text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true">✓</span>
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
