'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { isAuthenticated } from '../lib/auth-token'

export default function AllModulesButton() {
  const [mounted, setMounted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    setMounted(true)
    setIsLoggedIn(isAuthenticated())
  }, [])

  if (!mounted || !isLoggedIn) return null

  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center justify-center rounded-md theme-btn-primary px-4 py-2 text-sm font-medium"
    >
      All Modules →
    </Link>
  )
}
