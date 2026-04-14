'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'

interface ReferenceRecordsCardProps {
  href: string
  title: string
  description: string
  badges: string[]
  icon: string
  totalRecords: number | null
  loading: boolean
}

export default function ReferenceRecordsCard({
  href,
  title,
  description,
  badges,
  icon,
  totalRecords,
  loading,
}: ReferenceRecordsCardProps) {
  const { t } = useTranslation('common')

  return (
    <Link href={href} className="group theme-panel theme-card-hover border-2 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all p-6 min-h-[240px] flex flex-col">
      <div className="flex items-stretch justify-between flex-1">
        <div className="flex flex-col flex-1 min-w-0">
          <h3 className="text-xl font-semibold mb-2 theme-card-title">
            {title} →
          </h3>
          <p className="theme-text-muted flex-1 mb-4">
            {description}
          </p>

          {loading ? (
            <div className="text-sm theme-text-muted mb-3">{t('referenceRecordsCard.loading')}</div>
          ) : (
            <div className="mb-3 text-sm">
              <span className="theme-text-muted">{t('referenceRecordsCard.totalRecords')} </span>
              <span className="font-semibold">{totalRecords !== null ? totalRecords.toLocaleString() : t('referenceRecordsCard.noData')}</span>
            </div>
          )}

          <div className="flex gap-2 mt-auto">
            {badges.map((badge) => (
              <span key={badge} className="px-2 py-1 theme-subtle text-xs rounded">{badge}</span>
            ))}
          </div>
        </div>
        <span className="text-3xl ml-4 shrink-0">{icon}</span>
      </div>
    </Link>
  )
}