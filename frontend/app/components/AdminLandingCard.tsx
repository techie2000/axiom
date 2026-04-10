'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import Badge from './Badge'
import { readStoredUser } from '../lib/stored-user'

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
    const user = readStoredUser()
    setIsAdmin(user?.role === 'admin')
  }, [])

  if (!mounted || !isAdmin) return null

  return (
    <Link
      href={href}
      className="group theme-panel theme-card-hover border-2 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all p-6 min-h-[240px] flex flex-col"
    >
      <div className="flex items-stretch justify-between flex-1">
        <div className="flex flex-col flex-1 min-w-0">
          <h3 className="text-xl font-semibold mb-2 theme-card-title">
            {title} →
          </h3>
          <p className="theme-text-muted flex-1 mb-4 break-words whitespace-normal">
            {description}
          </p>
          <div className="mt-auto">
            <Badge variant="orange">Admin Only</Badge>
          </div>
        </div>
        <span className="text-3xl ml-4 shrink-0">{icon}</span>
      </div>
    </Link>
  )
}
