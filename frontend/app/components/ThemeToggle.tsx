'use client'

/**
 * ThemeToggle — retained for backward compatibility.
 *
 * The primary theme-switching surface is now ThemeSelector, which exposes all
 * pre-defined themes.  ThemeToggle keeps the simple two-state (dark ↔ light)
 * toggle behaviour for any call-site that imports it directly.  It shares the
 * same preference key (global / theme) so both components stay in sync.
 */

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PreferenceSavePrompt from './PreferenceSavePrompt'
import { useDeferredStringPreference } from '../lib/useDeferredStringPreference'
import { applyTheme, resolveTheme } from '../lib/theme'

export default function ThemeToggle() {
  const { t } = useTranslation('common')
  const themePreference = useDeferredStringPreference({
    pageKey: 'global',
    preferenceKey: 'theme',
    defaultValue: 'dark',
  })
  const [mounted, setMounted] = useState(false)

  const effectiveTheme = resolveTheme(themePreference.value)
  const isDark = effectiveTheme.isDark

  useEffect(() => {
    setMounted(true)
    applyTheme(themePreference.value || 'dark')
  }, [themePreference.value])

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark'
    themePreference.setValue(newTheme)
  }

  // Avoid hydration mismatch
  if (!mounted) {
    return (
      <button className="h-9 w-9 flex items-center justify-center rounded-lg opacity-50 cursor-not-allowed">
        <span className="text-base leading-none">🌓</span>
      </button>
    )
  }

  return (
    <>
      <button
        onClick={toggleTheme}
        className="h-9 w-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 border border-gray-400/50 dark:border-white/20 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      >
        <span className="text-base leading-none">{isDark ? '☀️' : '🌙'}</span>
      </button>
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
