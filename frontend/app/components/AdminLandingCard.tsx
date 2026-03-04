'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface AdminLandingCardProps {
  href: string
  title: string
  description: string
  icon: string
}

export default function AdminLandingCard({ href, title, description, icon }: AdminLandingCardProps) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const raw = localStorage.getItem('axiom_user')
      if (raw) {
        const user = JSON.parse(raw)
        setIsAdmin(user?.role === 'admin')
      }
    } catch {
      // ignore malformed data
    }
  }, [])

  if (!mounted || !isAdmin) return null

  return (
    <Link
      href={href}
      className="group bg-white border-2 border-gray-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all p-6 hover:border-amber-500 dark:hover:border-amber-400 min-h-[240px] flex flex-col"
    >
      <div className="flex items-stretch justify-between flex-1">
        <div className="flex flex-col flex-1 min-w-0">
          <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">
            {title} →
          </h3>
          <p className="text-gray-600 dark:text-gray-300 flex-1 mb-4 break-words whitespace-normal">
            {description}
          </p>
          <div className="mt-auto">
            <span className="px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs rounded">
              Admin Only
            </span>
          </div>
        </div>
        <span className="text-3xl ml-4 shrink-0">{icon}</span>
      </div>
    </Link>
  )
}
