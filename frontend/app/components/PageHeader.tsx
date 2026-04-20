'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import UserBadge from './UserBadge'
import ContextDocsLink from './ContextDocsLink'
import { useButtonEmojiMode } from '../lib/useButtonEmojiMode'
import { resolveHydrationSafeLabel } from '../lib/hydrationSafeLabel'
import { getDashboardPageSection } from '../lib/dashboard-sections'

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
  const pathname = usePathname()
  const [hasHydrated, setHasHydrated] = useState(false)
  const { formatLabel } = useButtonEmojiMode()
  const dashboardPageSection = getDashboardPageSection(pathname)

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
        {dashboardPageSection && (
          <nav
            aria-label={t('leftNav.title')}
            className="mb-3 overflow-x-auto"
          >
            <ol className="flex min-w-max items-center gap-2 text-xs sm:text-sm theme-text-muted">
              <li>
                <Link href="/dashboard" className="theme-link hover:opacity-80 rounded theme-focus">
                  {t('leftNav.items.dashboard')}
                </Link>
              </li>
              <li aria-hidden="true">›</li>
              <li>
                <Link
                  href={dashboardPageSection.section.href}
                  className="theme-link hover:opacity-80 rounded theme-focus"
                >
                  {t(dashboardPageSection.section.titleKey)}
                </Link>
              </li>
              <li aria-hidden="true">›</li>
              <li className="font-medium text-[rgb(var(--foreground-rgb))]" aria-current="page">
                {t(dashboardPageSection.pageTitleKey)}
              </li>
            </ol>
          </nav>
        )}

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
