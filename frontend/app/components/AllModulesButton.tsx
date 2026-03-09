'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function AllModulesButton() {
  const [mounted, setMounted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    setMounted(true)
    setIsLoggedIn(!!localStorage.getItem('axiom_token'))
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
