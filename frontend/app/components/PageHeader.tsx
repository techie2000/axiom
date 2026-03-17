'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import UserBadge from './UserBadge'
import ContextDocsLink from './ContextDocsLink'

interface PageHeaderProps {
  title: string
  subtitle?: string
  titleTooltip?: string
  subtitleTooltip?: string
  backHref?: string
  backLabel?: string
  showBackLink?: boolean
  docsHref?: string
  docsLabel?: string
  actions?: React.ReactNode
}

export function resolveHydrationSafeLabel(
  explicitLabel: string | undefined,
  hasHydrated: boolean,
  translatedLabel: string,
  fallbackLabel: string,
) {
  return explicitLabel ?? (hasHydrated ? translatedLabel : fallbackLabel)
}

export default function PageHeader({
  title,
  subtitle,
  titleTooltip,
  subtitleTooltip,
  backHref = '/home',
  backLabel,
  showBackLink = true,
  docsHref,
  docsLabel,
  actions,
}: PageHeaderProps) {
  const { t } = useTranslation('common')
  const [hasHydrated, setHasHydrated] = useState(false)

  useEffect(() => {
    setHasHydrated(true)
  }, [])

  const fallbackBackLabel = backHref === '/dashboard' ? '← Back to Dashboard' : '← Back to Home'
  const translatedBackLabel = backHref === '/dashboard' ? t('nav.backToDashboard') : t('nav.backToHome')
  const resolvedBackLabel = resolveHydrationSafeLabel(
    backLabel,
    hasHydrated,
    translatedBackLabel,
    fallbackBackLabel,
  )
  const resolvedDocsLabel = resolveHydrationSafeLabel(
    docsLabel,
    hasHydrated,
    t('nav.documentation'),
    'Documentation',
  )

  return (
    <div className="mb-8 flex justify-between items-start">
      <div>
        {showBackLink && (
          <Link href={backHref} className="text-blue-400 hover:text-blue-300 mb-4 inline-block">
            {resolvedBackLabel}
          </Link>
        )}
        <h1 className="text-4xl font-bold mb-2" title={titleTooltip}>{title}</h1>
        {subtitle && <p className="opacity-70" title={subtitleTooltip}>{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        {docsHref && <ContextDocsLink href={docsHref} label={resolvedDocsLabel} />}
        {actions}
        <UserBadge />
      </div>
    </div>
  )
}
