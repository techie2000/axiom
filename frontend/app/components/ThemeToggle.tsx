'use client'

import React, { useEffect, useState } from 'react'
import { useUserPreference } from '../lib/useUserPreference'

export default function ThemeToggle() {
  const [storedTheme, setStoredTheme] = useUserPreference('global', 'theme', 'dark')
  const [mounted, setMounted] = useState(false)

  const theme = storedTheme as 'light' | 'dark'

  useEffect(() => {
    setMounted(true)
    // Apply the stored / system preference on first render.
    const resolved = storedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    // Keep legacy localStorage key in sync so existing code still works.
    localStorage.setItem('theme', resolved)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!mounted) return
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme, mounted])

  const toggleTheme = () => {
    const newTheme: 'light' | 'dark' = theme === 'dark' ? 'light' : 'dark'
    // setStoredTheme persists to server (when logged in) and localStorage automatically.
    setStoredTheme(newTheme)
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
    <button
      onClick={toggleTheme}
      className="h-9 w-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition-all"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <span className="text-base leading-none">{theme === 'dark' ? '☀️' : '🌙'}</span>
    </button>
  )
}
