'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { readStoredUser, StoredUser } from '../lib/stored-user'
import { resetPreferencesCache } from '../lib/useUserPreference'

export default function UserBadge() {
  const router = useRouter()
  const [user, setUser] = useState<StoredUser | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setUser(readStoredUser())
  }, [])

  const handleSignOut = () => {
    localStorage.removeItem('axiom_token')
    localStorage.removeItem('axiom_user')
    // Clear in-memory preference cache so the next login starts fresh.
    resetPreferencesCache()
    router.replace('/')
  }

  if (!mounted || !user) return null

  const displayName = user.full_name || user.username || user.email
  const isAdmin = user.role?.toLowerCase() === 'admin'
  const rolePillClasses = isAdmin
    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-white/10 border border-white/20 text-sm">
        <span className="text-base leading-none" aria-hidden="true">👤</span>
        <span className="font-medium text-gray-900 dark:text-white">{displayName}</span>
        <span
          className={`px-1.5 py-0.5 text-xs font-semibold rounded capitalize ${rolePillClasses}`}
        >
          {user.role}
        </span>
      </div>
      <button
        onClick={handleSignOut}
        className="h-9 px-3 text-sm rounded-lg bg-white/10 border border-white/20 hover:bg-red-500/20 hover:border-red-400/40 hover:text-red-300 transition-colors text-gray-700 dark:text-gray-300"
        title="Sign out"
      >
        Sign out
      </button>
    </div>
  )
}
