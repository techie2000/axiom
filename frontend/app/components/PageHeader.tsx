'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import UserBadge from './UserBadge'

interface PageHeaderProps {
  title: string
  subtitle?: string
  backHref?: string
  backLabel?: string
  showBackLink?: boolean
  actions?: React.ReactNode
}

export default function PageHeader({
  title,
  subtitle,
  backHref = '/home',
  backLabel,
  showBackLink = true,
  actions,
}: PageHeaderProps) {
  const { t } = useTranslation('common')
  const resolvedBackLabel =
    backLabel ?? (backHref === '/dashboard' ? t('nav.backToDashboard') : t('nav.backToHome'))

  return (
    <div className="mb-8 flex justify-between items-start">
      <div>
        {showBackLink && (
          <Link href={backHref} className="text-blue-400 hover:text-blue-300 mb-4 inline-block">
            {resolvedBackLabel}
          </Link>
        )}
        <h1 className="text-4xl font-bold mb-2">{title}</h1>
        {subtitle && <p className="opacity-70">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        {actions}
        <UserBadge />
      </div>
    </div>
  )
}
