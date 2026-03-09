'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function AllModulesButton() {
  const [mounted, setMounted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const getAuthToken = (): string | null => {
    const rawToken = localStorage.getItem('axiom_token')
    if (!rawToken) return null

    const normalizedToken = rawToken.replace(/^Bearer\s+/i, '').trim()
    if (!normalizedToken || normalizedToken === 'undefined' || normalizedToken === 'null') {
      return null
    }

    return normalizedToken
  }

  useEffect(() => {
    setMounted(true)
    setIsLoggedIn(getAuthToken() !== null)
  }, [])

  if (!mounted || !isLoggedIn) return null

  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium transition-colors"
    >
      All Modules →
    </Link>
  )
}
