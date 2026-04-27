'use client'

import AdminLandingCard from './AdminLandingCard'
import { useEffect, useState } from 'react'
import { readStoredUser } from '../lib/stored-user'

/**
 * Renders the full Administration section on the landing page, including the
 * section header. Because the section is only relevant to admin users, the
 * entire block is hidden for non-admins and unauthenticated visitors.
 *
 * NOTE: this is UI-only protection. The actual admin API endpoints are
 * protected server-side by the AdminRequired middleware and require a valid
 * admin JWT. This component only avoids presenting irrelevant UI to non-admins.
 */
export default function AdminSection() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const user = readStoredUser()
    setIsAdmin(user?.role === 'admin')
  }, [])

  if (!mounted || !isAdmin) return null

  return (
    <section className="mb-12">
      <div className="flex items-center mb-6">
        <span className="text-2xl mr-3">⚙️</span>
        <div>
          <h2 className="text-2xl font-bold">Administration</h2>
          <p className="text-sm theme-text-muted">
            System configuration and user management • Admin access required
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AdminLandingCard
          href="/admin/users"
          title="User Management"
          description="Review registration requests, approve or deactivate accounts, and manage user roles"
          icon="👥"
        />
        <AdminLandingCard
          href="/admin/translations"
          title="Translations"
          description="Review community-contributed UI translations, approve or reject pending strings, and add new translations"
          icon="🌐"
        />
        <AdminLandingCard
          href="/admin/provisional-lei"
          title="Provisional LEI Records"
          description="Issue and manage Axiom-assigned provisional LEI codes for entities not yet registered with GLEIF, and link them to official LEIs when available"
          icon="🔖"
        />
        <AdminLandingCard
          href="/admin/user-entity-links"
          title="User–Entity Links"
          description="Grant and revoke entity-scoped access links that associate users with specific LEI entities and roles"
          icon="🔗"
        />
      </div>
    </section>
  )
}
