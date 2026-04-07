'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import UserBadge from './UserBadge'
import ContextDocsLink from './ContextDocsLink'
import { useButtonEmojiMode } from '../lib/useButtonEmojiMode'
import { resolveHydrationSafeLabel } from '../lib/hydrationSafeLabel'

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
  const { formatLabel } = useButtonEmojiMode()

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
    '📘 Documentation',
  )

  return (
    <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
      <div>
        {showBackLink && (
          <Link
            href={backHref}
            className="theme-link hover:opacity-80 mb-4 inline-block rounded theme-focus"
          >
            {resolvedBackLabel}
          </Link>
        )}
        <h1 className="text-4xl font-bold mb-2" title={titleTooltip}>{title}</h1>
        {subtitle && <p className="opacity-70" title={subtitleTooltip}>{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center justify-start gap-3 xl:justify-end">
        {docsHref && <ContextDocsLink href={docsHref} label={formatLabel(resolvedDocsLabel)} />}
        {actions}
        <UserBadge />
      </div>
    </div>
  )
}
