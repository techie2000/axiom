'use client'

/**
 * ThemeToggle — controls the dark / light mode independently of the colour palette.
 *
 * Preference key: global / dark_mode  ('dark' | 'light')
 *
 * This component is intentionally decoupled from the colour palette (ThemeSelector).
 * Both components can be mounted side-by-side; ThemeToggle only touches the `dark`
 * CSS class on <html> while ThemeSelector only touches the `data-theme` attribute.
 */

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PreferenceSavePrompt from './PreferenceSavePrompt'
import { useDeferredStringPreference } from '../lib/useDeferredStringPreference'
import { applyDarkMode } from '../lib/theme'

export default function ThemeToggle() {
  const { t } = useTranslation('common')
  const darkModePreference = useDeferredStringPreference({
    pageKey: 'global',
    preferenceKey: 'dark_mode',
    defaultValue: 'dark',
  })
  const [mounted, setMounted] = useState(false)

  const isDark = darkModePreference.value === 'dark' || darkModePreference.value === ''

  useEffect(() => {
    setMounted(true)
    applyDarkMode(darkModePreference.value !== 'light')
  }, [darkModePreference.value])

  const toggleDarkMode = () => {
    darkModePreference.setValue(isDark ? 'light' : 'dark')
  }

  // Avoid hydration mismatch.
  if (!mounted) {
    return (
      <button className="h-9 w-9 inline-flex items-center justify-center rounded-lg theme-btn-neutral opacity-60 cursor-not-allowed">
        <span className="text-base leading-none">🌓</span>
      </button>
    )
  }

  return (
    <>
      <button
        onClick={toggleDarkMode}
        className="h-9 w-9 inline-flex items-center justify-center rounded-lg theme-btn-neutral theme-focus"
        aria-label={isDark ? t('preferences.switchToLight') : t('preferences.switchToDark')}
        title={isDark ? t('preferences.switchToLight') : t('preferences.switchToDark')}
      >
        <span className="text-base leading-none">{isDark ? '☀️' : '🌙'}</span>
      </button>
      <PreferenceSavePrompt
        visible={darkModePreference.showPrompt}
        resetKey={darkModePreference.promptResetKey}
        onSave={darkModePreference.save}
        onDismiss={darkModePreference.dismiss}
        label={t('preferences.saveDarkModeDefault')}
        showUndo={darkModePreference.showUndo}
        undoResetKey={darkModePreference.undoResetKey}
        onUndo={darkModePreference.undo}
        onUndoDismiss={darkModePreference.undoDismiss}
        undoLabel={t('preferences.savedUndo')}
      />
    </>
  )
}
