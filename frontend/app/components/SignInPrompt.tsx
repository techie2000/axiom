'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { isAuthenticated } from '../lib/auth-token'

/**
 * Renders a "Sign In" call-to-action when the user is not authenticated.
 */
export default function SignInPrompt() {
  const [mounted, setMounted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    setMounted(true)
    setIsLoggedIn(isAuthenticated())
  }, [])

  if (!mounted || isLoggedIn) return null

  return (
    <div className="mb-8 p-4 rounded-lg theme-panel border flex items-center justify-between gap-4">
      <p className="theme-text-muted text-sm">
        Sign in to access protected data and administration features.
      </p>
      <Link
        href="/login"
        className="shrink-0 px-4 py-2 rounded theme-btn-primary theme-focus text-sm font-medium"
      >
        Sign In →
      </Link>
    </div>
  )
}
