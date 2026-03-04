'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * Renders a "Sign In" call-to-action on the landing page when the user is not
 * authenticated. Returns null once a token is detected so the prompt disappears
 * automatically after login without a page reload.
 */
export default function SignInPrompt() {
  const [mounted, setMounted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    setMounted(true)
    setIsLoggedIn(!!localStorage.getItem('axiom_token'))
  }, [])

  if (!mounted || isLoggedIn) return null

  return (
    <div className="mb-8 p-4 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-700 flex items-center justify-between gap-4">
      <p className="text-blue-800 dark:text-blue-300 text-sm">
        Sign in to access protected data and administration features.
      </p>
      <Link
        href="/login"
        className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
      >
        Sign In →
      </Link>
    </div>
  )
}
