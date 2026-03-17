'use client'

import React, { useEffect, useState } from 'react'
import PreferenceSavePrompt from './PreferenceSavePrompt'
import { useDeferredStringPreference } from '../lib/useDeferredStringPreference'

export default function ThemeToggle() {
  const themePreference = useDeferredStringPreference({
    pageKey: 'global',
    preferenceKey: 'theme',
    defaultValue: 'dark',
  })
  const [mounted, setMounted] = useState(false)

  const effectiveTheme = (themePreference.value === 'light' ? 'light' : 'dark') as 'light' | 'dark'

  useEffect(() => {
    setMounted(true)
    const resolved = themePreference.value || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    localStorage.setItem('theme', resolved)
  }, [themePreference.value])

  useEffect(() => {
    if (!mounted) return
    document.documentElement.classList.toggle('dark', effectiveTheme === 'dark')
    localStorage.setItem('theme', effectiveTheme)
  }, [effectiveTheme, mounted])

  const toggleTheme = () => {
    const newTheme: 'light' | 'dark' = effectiveTheme === 'dark' ? 'light' : 'dark'
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
        aria-label={`Switch to ${effectiveTheme === 'dark' ? 'light' : 'dark'} mode`}
        title={`Switch to ${effectiveTheme === 'dark' ? 'light' : 'dark'} mode`}
      >
        <span className="text-base leading-none">{effectiveTheme === 'dark' ? '☀️' : '🌙'}</span>
      </button>
      <PreferenceSavePrompt
        visible={themePreference.showPrompt}
        resetKey={themePreference.promptResetKey}
        onSave={themePreference.save}
        onDismiss={themePreference.dismiss}
        label="Save theme as your default?"
      />
    </>
  )
}
